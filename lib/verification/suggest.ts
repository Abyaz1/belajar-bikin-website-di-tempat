import "server-only";

/**
 * Port usulan model untuk E4, sesuai kontrak `SuggestionPort` di
 * lib/trust/verification-port.ts. E4 memuat berkas ini lewat
 * `import("@/lib/verification/suggest")` dan memakai ekspor `port`.
 *
 * E4 memanggilnya HANYA setelah semua pemeriksaan keaslian lolos, dengan
 * atribut yang ai_suggestable-nya menyala di tabel. Yang kembali
 * membawa confidence untuk disimpan E4 di draft_suggestion; E4 yang
 * membuangnya sebelum respons ke klien (aturan 5).
 *
 * Tidak pernah melempar: env kosong, galat, atau lewat batas waktu = [].
 * Alur kontribusi tidak boleh bergantung pada model.
 */

import type { SuggestionPort } from "@/lib/trust/verification-port";
import { isVantage } from "@/lib/ui/api/types";
import { ATTRIBUTE_TYPES } from "@/lib/rules/reference";
import { MEASURED, suggestAttributes, type AttributeFlag, type ModelCaller } from "./core";
import { vertexCaller } from "./vertex-caller";

let caller: ModelCaller | undefined;

export const port: SuggestionPort = {
  async suggest({ imageBytes, vantage, attributeCodes, timeoutMs }) {
    const { GCP_PROJECT_ID: project, VERTEX_LOCATION: location, VERTEX_MODEL: model } = process.env;
    if (!project || !location || !model || !isVantage(vantage)) return [];

    // Kosakata dari kamus atribut; E4 hanya mengirim kode. Atribut di luar tiga
    // yang terukur tidak pernah ditanyakan (penjaga di core.ts).
    const attributes: AttributeFlag[] = ATTRIBUTE_TYPES.filter(
      (a) => attributeCodes.includes(a.code) && (MEASURED as readonly string[]).includes(a.code),
    ).map((a) => ({ attribute_code: a.code, ai_suggestable: true, allowed_values: a.allowed_values }));

    try {
      caller ??= vertexCaller({ project, location });
      const r = await suggestAttributes(
        { image: new Uint8Array(imageBytes), mimeType: "image/jpeg", vantage, attributes },
        { call: caller, model, timeoutMs },
      );
      if (r.status !== "ok") {
        console.warn(`Usulan model ${r.status} (${r.latency_ms} ms): ${r.reason ?? ""}`);
        return [];
      }
      // draft_suggestion.ai_confidence NOT NULL: jawaban tanpa angka keyakinan
      // yang sah dibuang, bukan diberi angka karangan.
      return r.suggestions.flatMap((s) =>
        s.active && s.value !== null && s.confidence !== null
          ? [{ attribute_code: s.attribute_code, value: s.value, confidence: s.confidence }]
          : [],
      );
    } catch (e) {
      console.warn("Usulan model gagal:", e);
      return [];
    }
  },
};
