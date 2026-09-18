import "server-only";

/**
 * Pintu masuk modul verifikasi untuk E4 (jalur Trust). Dipanggil HANYA setelah
 * semua pemeriksaan keaslian lolos, satu kali per bukti.
 *
 *   const hasil = await suggestWithVertex({ image, mimeType, vantage, attributes });
 *   // simpan hasil.suggestions[].confidence ke observation.ai_confidence di E5
 *   // kirim ke klien: publicSuggestions(hasil.suggestions) + model_status: hasil.status
 *
 * Tidak pernah melempar galat: alur kontribusi tidak boleh bergantung pada model.
 * Env yang kosong → status "off"; galat apa pun → "failed"; lewat 8 detik → "timeout".
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
    return await suggestAttributes(input, { call: caller, model });
  } catch (e) {
    return { status: "failed", model, prompt_version: "", latency_ms: 0, suggestions: [], reason: e instanceof Error ? e.message : String(e) };
  }
}
