/**
 * Uji langsung ke Vertex AI — syarat konfirmasi baris Verification di
 * 00-KONTRAK §10: satu foto 1600 px dari kamera produksi (/uji-kamera-produk)
 * harus dibalas JSON sesuai skema DI BAWAH 8 DETIK.
 *
 * Dilewati otomatis kalau env atau fotonya tidak ada. Menjalankan (bash):
 *
 *   gcloud auth application-default login
 *   set -a && . ./.env.local && set +a
 *   UJI_VERTEX_FOTO=/path/ke/pintu-masuk.jpg npx vitest run lib/verification/vertex.live.test.ts
 *
 * Catat angka latensi dan jawabannya di §10 bersama nama model dan PROMPT_VERSION.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ATTRIBUTE_TYPES } from "@/lib/rules/reference";
import { PROMPT_VERSION, TIMEOUT_MS, suggestAttributes } from "./core";
import { vertexCaller } from "./vertex-caller";

const { GCP_PROJECT_ID, VERTEX_LOCATION, VERTEX_MODEL, UJI_VERTEX_FOTO } = process.env;
const siap = Boolean(GCP_PROJECT_ID && VERTEX_LOCATION && VERTEX_MODEL && UJI_VERTEX_FOTO);

describe.skipIf(!siap)("Vertex AI langsung (syarat §10)", () => {
  it(
    `membalas JSON sesuai skema di bawah ${TIMEOUT_MS / 1000} detik`,
    async () => {
      const r = await suggestAttributes(
        {
          image: readFileSync(UJI_VERTEX_FOTO!),
          mimeType: "image/jpeg",
          vantage: "entrance",
          attributes: ATTRIBUTE_TYPES.filter((a) => a.vantage === "entrance").map((a) => ({
            attribute_code: a.code,
            ai_suggestable: a.ai_suggestable,
            allowed_values: a.allowed_values,
          })),
        },
        { call: vertexCaller({ project: GCP_PROJECT_ID!, location: VERTEX_LOCATION! }), model: VERTEX_MODEL! },
      );

      console.log(
        `\n[§10] model=${r.model} prompt=${PROMPT_VERSION} status=${r.status} latensi=${r.latency_ms} ms\n` +
          r.suggestions.map((s) => `  ${s.attribute_code}: ${s.value} (keyakinan ${s.confidence})`).join("\n") +
          (r.reason ? `\n  alasan: ${r.reason}` : ""),
      );

      expect(r.status, r.reason ?? "").toBe("ok");
      expect(r.latency_ms).toBeLessThan(TIMEOUT_MS);
      // Tiga atribut terukur semuanya dijawab dalam kosakata yang sah (termasuk not_visible).
      expect(r.suggestions.filter((s) => s.active).map((s) => s.attribute_code).sort()).toEqual([
        "ramp_wheelchair",
        "step_count",
        "tactile_paving",
      ]);
    },
    TIMEOUT_MS * 3,
  );
});
