/**
 * Pembacaan E1, E2, E3, E6 dari Server Component.
 *
 * Halaman baca memanggil endpoint lewat HTTP, bukan mengimpor modul
 * Verification langsung. Itu menjaga seam S-1: layar tidak tahu apa pun
 * tentang basis data. Kalau nanti mau memangkas satu lompatan jaringan, cukup
 * ganti isi fungsi di berkas ini — komponen tidak ikut berubah.
 */

import { headers } from "next/headers";
import { UI_FIXTURES } from "../brand";
import type { ApiErrorBody, AuditTrail, PlaceDetail, PlaceSummary, ProfileCode, ProfileInfo } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `Permintaan gagal (${status})`);
  }
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function get(path: string): Promise<Response> {
  if (UI_FIXTURES) {
    const { fixtureFetch } = await import("./fixtures");
    return fixtureFetch(path);
  }
  return fetch(`${await origin()}${path}`, { cache: "no-store", headers: { accept: "application/json" } });
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {}
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}

/** Terima larik langsung, atau dibungkus satu kunci. */
function unwrap<T>(json: unknown, key: string): T[] {
  if (Array.isArray(json)) return json as T[];
  const inner = (json as Record<string, unknown> | null)?.[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
}

export async function getPlaces(profile: ProfileCode): Promise<PlaceSummary[]> {
  const res = await get(`/api/places?profile=${encodeURIComponent(profile)}`);
  return unwrap<PlaceSummary>(await readJson(res), "places");
}

/** null bila 404. */
export async function getPlace(id: string, profile: ProfileCode): Promise<PlaceDetail | null> {
  const res = await get(`/api/places/${encodeURIComponent(id)}?profile=${encodeURIComponent(profile)}`);
  if (res.status === 404) return null;
  const place = await readJson<PlaceDetail>(res);
  return { ...place, profile, attributes: place.attributes ?? [], notes: place.notes ?? [] };
}

/**
 * Fakta tempat tanpa penilaian — untuk layar yang URL-nya tidak membawa
 * profil (rincian atribut, alur kontribusi). E2 mewajibkan `profile`, jadi
 * dipakai profil tetap dan penilaiannya disembunyikan dari tipe. Usulan ke Verification:
 * izinkan E2 tanpa profil (tanpa verdict); kalau itu terjadi, ganti di sini.
 */
export async function getPlaceFacts(id: string): Promise<Omit<PlaceDetail, "verdict" | "notes" | "profile"> | null> {
  // Tipe kembaliannya sengaja tidak memuat verdict: pemanggil tidak bisa
  // memakainya tanpa sengaja.
  return getPlace(id, "kursi_roda_manual");
}

export async function getAudit(placeId: string, code: string): Promise<AuditTrail | null> {
  const res = await get(`/api/places/${encodeURIComponent(placeId)}/attributes/${encodeURIComponent(code)}/audit`);
  if (res.status === 404) return null;
  const trail = await readJson<AuditTrail>(res);
  return { ...trail, entries: trail.entries ?? [] };
}

export async function getProfiles(): Promise<ProfileInfo[]> {
  const res = await get("/api/profiles");
  return unwrap<ProfileInfo>(await readJson(res), "profiles");
}
