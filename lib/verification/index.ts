import "server-only";

/**
 * Pintu masuk modul verifikasi untuk E4. Dipanggil lewat mintaUsulan() di
 * lib/trust/verification-port.ts, yang mengimpor '@/lib/verification' dan
 * memakai suggestWithVertex — HANYA setelah semua pemeriksaan keaslian lolos,
 * satu kali per bukti.
 *
 * E4 menyimpan suggestions[].confidence ke draft_suggestion (yang tanpa
 * confidence dibuangnya), mengirim model_status ke klien, dan tidak pernah
 * mengirim confidence ke klien (aturan 5).
 *
 * Tidak pernah melempar: alur kontribusi tidak boleh bergantung pada model.
 * Env kosong → "off"; galat apa pun → "failed"; lewat VERTEX_TIMEOUT_MS → "timeout".
 * Setiap status selain "ok" membawa `reason`, supaya kegagalan tidak senyap.
 */

import { suggestAttributes, type ModelCaller, type SuggestInput, type SuggestResult } from "./core";
import { vertexCaller } from "./vertex-caller";

export { MEASURED, PROMPT_VERSION, publicSuggestions } from "./core";
export type { AttributeFlag, ModelStatus, SuggestInput, SuggestResult, Suggestion } from "./core";

let caller: ModelCaller | undefined;

export async function suggestWithVertex(input: SuggestInput): Promise<SuggestResult> {
  const { GCP_PROJECT_ID: project, VERTEX_LOCATION: location, VERTEX_MODEL: model } = process.env;
  if (!project || !location || !model) {
    return {
      status: "off",
      model: model ?? "",
      prompt_version: "",
      latency_ms: 0,
      suggestions: [],
      reason: "GCP_PROJECT_ID, VERTEX_LOCATION, atau VERTEX_MODEL belum diisi.",
    };
  }
  try {
    caller ??= vertexCaller({ project, location });
    // Batas waktu dari config (env VERTEX_TIMEOUT_MS), dibaca di core.ts.
    return await suggestAttributes(input, { call: caller, model });
  } catch (e) {
    return { status: "failed", model, prompt_version: "", latency_ms: 0, suggestions: [], reason: e instanceof Error ? e.message : String(e) };
  }
}
