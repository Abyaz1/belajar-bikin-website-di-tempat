"use client";

/**
 * Panggilan jalur tulis dari peramban: E7 sesi, E8 token, E4 draft, E5 konfirmasi.
 * Semua pengecekan keaslian terjadi di server. Tidak ada keputusan diambil di
 * sini — klien hanya mengirim dan menampilkan jawabannya apa adanya.
 */

import { UI_FIXTURES } from "../brand";
import type {
  ApiErrorBody,
  CaptureSession,
  ConfirmItem,
  ConfirmResult,
  DraftAccepted,
  DraftResult,
  StateChange,
  Vantage,
} from "./types";

async function call(path: string, init: RequestInit): Promise<Response> {
  if (UI_FIXTURES) {
    const { fixtureFetch } = await import("./fixtures");
    return fixtureFetch(path, init);
  }
  return fetch(path, { credentials: "same-origin", ...init });
}

async function errorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    const json = await res.json();
    if (json && typeof json.code === "string") return json as ApiErrorBody;
    if (Array.isArray(json?.errors) && json.errors[0]) return json.errors[0] as ApiErrorBody;
  } catch {}
  return null;
}

export class RequestFailed extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | null,
  ) {
    super(body?.message ?? (status === 0 ? "Tidak dapat menghubungi server." : `Permintaan gagal (${status}).`));
  }
}

const NETWORK: RequestFailed = new RequestFailed(0, null);

/**
 * E7 lalu E8. E8 tanpa sesi menjawab 400 SESSION_REQUIRED, jadi sesi dibuat
 * lebih dulu. E7 milik Trust idempoten: cookie sesi yang sah dipakai lagi,
 * sehingga memanggilnya setiap kali tidak membuat kontributor baru dan tidak
 * mengelabui hitungan penguat maupun rate limit C1.
 */
export async function openCaptureSession(placeId: string, vantage: Vantage): Promise<CaptureSession> {
  let res: Response;
  try {
    const s = await call("/api/session", { method: "POST" });
    if (!s.ok) throw new RequestFailed(s.status, await errorBody(s));
    res = await call("/api/capture-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ place_id: placeId, vantage }),
    });
  } catch (e) {
    if (e instanceof RequestFailed) throw e;
    throw NETWORK;
  }
  if (!res.ok) throw new RequestFailed(res.status, await errorBody(res));
  const json = (await res.json()) as CaptureSession;
  return { ...json, claimable: json.claimable ?? [] };
}

export interface DraftInput {
  image: Blob;
  captureToken: string;
  placeId: string;
  vantage: Vantage;
  fix: { lat: number; lon: number; accuracy: number; at: number } | null;
  capturedAt: Date;
  /** Dicatat server sebagai keterangan, BUKAN diperiksa (spek 10 §2.3).
   *  Kosakatanya sama dengan suite tests/rejection milik Trust. */
  captureMethod: "getusermedia" | "galeri";
  /** Hanya dibaca mode data contoh; server nyata mengabaikannya. */
  fixtureScenario?: string;
}

/** E4. 422 berarti ditolak — dan penolakan itu tetap tercatat di server. */
export async function submitDraft(input: DraftInput): Promise<DraftResult> {
  const form = new FormData();
  // Nama field `file` — sama dengan suite tests/rejection milik Trust.
  form.set("file", input.image, "tangkapan.jpg");
  form.set("capture_token", input.captureToken);
  form.set("place_id", input.placeId);
  form.set("vantage", input.vantage);
  form.set("capture_method", input.captureMethod);
  form.set("client_captured_at", input.capturedAt.toISOString());
  if (input.fix) {
    form.set("client_lat", String(input.fix.lat));
    form.set("client_lon", String(input.fix.lon));
    form.set("client_accuracy_m", String(Math.round(input.fix.accuracy * 10) / 10));
    form.set("client_fix_at", new Date(input.fix.at).toISOString());
  }
  if (input.fixtureScenario) form.set("ui_fixture_scenario", input.fixtureScenario);

  let res: Response;
  try {
    res = await call("/api/contributions/draft", { method: "POST", body: form });
  } catch {
    return { kind: "error", status: 0, error: null };
  }
  if (res.status === 422) {
    try {
      const json = await res.json();
      const errors: ApiErrorBody[] = Array.isArray(json?.errors) ? json.errors : json?.code ? [json] : [];
      return { kind: "rejected", errors };
    } catch {
      return { kind: "rejected", errors: [] };
    }
  }
  if (!res.ok) return { kind: "error", status: res.status, error: await errorBody(res) };
  const draft = (await res.json()) as DraftAccepted;
  return {
    kind: "accepted",
    draft: { ...draft, checks: draft.checks ?? [], suggestions: draft.suggestions ?? [], claimable: draft.claimable ?? [] },
  };
}

/** E5. Kontrak menyebut badannya larik `[{ attribute_code, confirmed_value }]`. */
export async function confirmDraft(draftId: string, items: ConfirmItem[]): Promise<ConfirmResult> {
  let res: Response;
  try {
    res = await call(`/api/contributions/${encodeURIComponent(draftId)}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(items),
    });
  } catch {
    return { kind: "error", status: 0, error: null };
  }
  if (!res.ok) return { kind: "error", status: res.status, error: await errorBody(res) };
  const json = await res.json();
  const changes: StateChange[] = Array.isArray(json) ? json : (json?.changes ?? []);
  return { kind: "saved", changes };
}
