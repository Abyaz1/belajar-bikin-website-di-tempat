/**
 * Modul verifikasi — docs-20 §4. Seam S-2: menerima gambar, mengembalikan
 * USULAN. Tidak pernah menulis ke basis data dan tidak mengimpornya. Yang
 * menyimpan observation hanya E5, setelah kontributor mengonfirmasi.
 *
 * Berkas ini murni (tanpa SDK, tanpa env) supaya bisa dites tanpa jaringan.
 * Pemanggil model disuntikkan; adapter Vertex ada di vertex-caller.ts.
 *
 *   usulan hanya untuk step_count, ramp_wheelchair, tactile_paving
 *   model boleh menjawab not_visible, dan jawaban itu diteruskan apa adanya
 *   keluaran JSON dibatasi skema — bentuk jawaban dibatasi, parser tidak ditambal
 *   gagal parse / timeout → status failed/timeout, checklist kosong, alur jalan terus
 *   timeout 8 detik, TANPA retry; satu panggilan per bukti
 *   confidence dikembalikan untuk disimpan, TIDAK untuk ditampilkan
 */

import type { Vantage } from "@/lib/ui/api/types";
import { verificationConfig } from "./config";

/** Satu-satunya atribut yang precision-nya diukur. Penjaga keras: walau tabel
 *  keliru menyalakan ai_suggestable untuk atribut lain, atribut itu tidak ditanyakan. */
export const MEASURED = ["step_count", "ramp_wheelchair", "tactile_paving"] as const;
/** Dari env VERTEX_TIMEOUT_MS (kontrak: 8 detik, tanpa retry). */
export const TIMEOUT_MS = verificationConfig.vertexTimeoutMs;
const NOT_VISIBLE = "not_visible";

/**
 * Versi prompt. Prompt DIBEKUKAN sebelum precision diukur (docs-20 §5): angka
 * precision hanya berlaku untuk pasangan model + versi prompt yang diukur.
 * Mengubah teks di buildPrompt = naikkan versi ini dan ukur ulang.
 */
export const PROMPT_VERSION = "2026-09-18.v1";

/** Satu atribut yang boleh diklaim dari titik pandang ini, dengan penanda tabelnya. */
export interface AttributeFlag {
  attribute_code: string;
  /** Kolom attribute_type.ai_suggestable — gerbang precision per atribut (docs-20 §1). */
  ai_suggestable: boolean;
  allowed_values: string[];
}

export interface SuggestInput {
  image: Uint8Array;
  mimeType: string;
  vantage: Vantage;
  /** Atribut yang boleh diklaim dari `vantage`, persis dari tabel attribute_type. */
  attributes: AttributeFlag[];
}

export interface Suggestion {
  attribute_code: string;
  value: string | null;
  /** Disimpan ke observation.ai_confidence. JANGAN dikirim ke klien. */
  confidence: number | null;
  active: boolean;
}

export type ModelStatus = "ok" | "off" | "failed" | "timeout";

export interface SuggestResult {
  status: ModelStatus;
  model: string;
  prompt_version: string;
  latency_ms: number;
  suggestions: Suggestion[];
  reason: string | null;
}

export interface ModelRequest {
  model: string;
  prompt: string;
  schema: object;
  image: Uint8Array;
  mimeType: string;
  signal: AbortSignal;
}

/** Mengembalikan teks JSON mentah dari model. */
export type ModelCaller = (req: ModelRequest) => Promise<string>;

const TEMPAT: Record<Vantage, string> = {
  entrance: "in front of the main entrance of a public building, looking at the door, any steps, and the sidewalk in front of it",
  interior: "inside the building, looking at an elevator",
  toilet: "at the door of a toilet",
};

const PERTANYAAN: Record<(typeof MEASURED)[number], string> = {
  step_count:
    'step_count: How many steps must be climbed from the sidewalk to reach the entrance door? Answer the number as a string ("0" to "20"). Answer "0" only if the approach to the door is clearly visible and level.',
  ramp_wheelchair: 'ramp_wheelchair: Is there a ramp at this entrance that a wheelchair could use? Answer "yes" or "no".',
  tactile_paving:
    'tactile_paving: Is there tactile paving (textured guidance tiles, usually yellow) on the sidewalk or in front of the door? Answer "yes" or "no".',
};

export function buildPrompt(vantage: Vantage, asked: string[]): string {
  return [
    `You are helping verify physical accessibility facts about a building from ONE photo taken by a person standing ${TEMPAT[vantage]}.`,
    'Report only what is clearly visible in THIS photo. If an item is not clearly visible, is cut off, or you are unsure, answer "not_visible". Do not guess from the type of building, the surroundings, or what is typical.',
    "",
    ...asked.map((c) => `- ${PERTANYAAN[c as keyof typeof PERTANYAAN]}`),
    "",
    "For each item also give confidence between 0 and 1. Answer only with the JSON object defined by the schema.",
  ].join("\n");
}

/** Skema JSON: satu properti per atribut, nilai dibatasi kosakata atribut itu + not_visible. */
export function responseSchema(asked: AttributeFlag[]): object {
  return {
    type: "object",
    properties: Object.fromEntries(
      asked.map((a) => [
        a.attribute_code,
        {
          type: "object",
          properties: {
            value: { type: "string", enum: [...a.allowed_values, NOT_VISIBLE] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["value", "confidence"],
        },
      ]),
    ),
    required: asked.map((a) => a.attribute_code),
  };
}

/** Bentuk yang boleh keluar ke klien lewat E4: tanpa angka keyakinan. */
export function publicSuggestions(s: Suggestion[]): { attribute_code: string; value: string | null; active: boolean }[] {
  return s.map(({ attribute_code, value, active }) => ({ attribute_code, value, active }));
}

class Timeout extends Error {}

export async function suggestAttributes(
  input: SuggestInput,
  deps: { call: ModelCaller; model: string; timeoutMs?: number; now?: () => number },
): Promise<SuggestResult> {
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
  const measured = input.attributes.filter((a) => (MEASURED as readonly string[]).includes(a.attribute_code));
  const asked = measured.filter((a) => a.ai_suggestable);
  const gated: Suggestion[] = measured
    .filter((a) => !a.ai_suggestable)
    .map((a) => ({ attribute_code: a.attribute_code, value: null, confidence: null, active: false }));
  const base = { model: deps.model, prompt_version: PROMPT_VERSION };

  if (asked.length === 0) {
    return { ...base, status: "off", latency_ms: 0, suggestions: gated, reason: "Tidak ada atribut yang boleh diusulkan dari titik pandang ini." };
  }

  const started = now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Timeout());
    }, timeoutMs);
  });

  let raw: string;
  try {
    // Satu panggilan, tanpa retry: satu retry menghabiskan separuh anggaran 60 detik.
    raw = await Promise.race([
      deps.call({
        model: deps.model,
        prompt: buildPrompt(input.vantage, asked.map((a) => a.attribute_code)),
        schema: responseSchema(asked),
        image: input.image,
        mimeType: input.mimeType,
        signal: controller.signal,
      }),
      deadline,
    ]);
  } catch (e) {
    const latency_ms = now() - started;
    if (e instanceof Timeout || controller.signal.aborted)
      return { ...base, status: "timeout", latency_ms, suggestions: gated, reason: `Model tidak menjawab dalam ${timeoutMs / 1000} detik.` };
    return { ...base, status: "failed", latency_ms, suggestions: gated, reason: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
  const latency_ms = now() - started;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...base, status: "failed", latency_ms, suggestions: gated, reason: "Jawaban model bukan JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ...base, status: "failed", latency_ms, suggestions: gated, reason: "Jawaban model bukan objek JSON." };
  }

  const answered: Suggestion[] = [];
  for (const a of asked) {
    const entry = (parsed as Record<string, unknown>)[a.attribute_code];
    if (typeof entry !== "object" || entry === null) continue;
    const { value, confidence } = entry as { value?: unknown; confidence?: unknown };
    // Nilai di luar kosakata dibuang, bukan ditebak ulang.
    if (typeof value !== "string" || (value !== NOT_VISIBLE && !a.allowed_values.includes(value))) continue;
    const conf = typeof confidence === "number" && confidence >= 0 && confidence <= 1 ? confidence : null;
    answered.push({ attribute_code: a.attribute_code, value, confidence: conf, active: true });
  }

  return { ...base, status: "ok", latency_ms, suggestions: [...answered, ...gated], reason: null };
}
