/**
 * PELAKSANA pengukuran precision (docs-20 §5) — bukan tes biasa. Dilewati
 * otomatis kecuali UJI_PRESISI_DIR diisi. Dijalankan lewat vitest supaya
 * tidak butuh dependency tambahan untuk TypeScript dan alias "@/".
 *
 * Susunan folder himpunan uji (dari problem owner, docs-40 §2):
 *
 *   <UJI_PRESISI_DIR>/labels.json
 *   <UJI_PRESISI_DIR>/<berkas citra>.jpg
 *
 *   labels.json:
 *   {
 *     "prompt_dibekukan": "2026-09-18.v1",          // = PROMPT_VERSION saat pengukuran
 *     "citra": [
 *       { "berkas": "pintu-01.jpg", "bagian": "ukur", "pelabel": "Nama", "sumber": "koridor",
 *         "label": { "step_count": "ada", "ramp_wheelchair": "no", "tactile_paving": "not_visible" } },
 *       { "berkas": "setel-01.jpg", "bagian": "penyetelan", "label": { ... } }
 *     ]
 *   }
 *
 *   step_count dilabeli "ada" / "tidak_ada" / "not_visible" — jangan angka.
 *   Label ditetapkan SEBELUM model melihat citranya. Ragu → "not_visible".
 *
 * Mengukur (butuh akses GCP, bash):
 *
 *   gcloud auth application-default login
 *   set -a && . ./.env.local && set +a
 *   UJI_PRESISI_DIR=tools/metrics/testset npx vitest run lib/verification/presisi.run.test.ts
 *
 * Menghitung ulang dari jawaban tersimpan, tanpa memanggil model lagi:
 *
 *   UJI_PRESISI_DIR=tools/metrics/testset UJI_PRESISI_JAWABAN=tools/metrics/testset/hasil/<berkas>.json npx vitest run lib/verification/presisi.run.test.ts
 *
 * Citra diperkecil ke sisi terpanjang 1600 px dan disandikan ulang JPEG 85
 * dengan sharp — sama seperti yang dikirim kamera produksi. Citra "penyetelan"
 * tidak pernah dikirim ke model.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ATTRIBUTE_TYPES } from "@/lib/rules/reference";
import { MEASURED, PROMPT_VERSION, TIMEOUT_MS, suggestAttributes } from "./core";
import {
  hitungPresisi,
  kesepakatanPelabel,
  laporanMarkdown,
  ringkasLatensi,
  sqlGerbang,
  validasiBerkasLabel,
  type BerkasLabel,
  type JawabanModel,
} from "./presisi";
import { vertexCaller } from "./vertex-caller";

const { UJI_PRESISI_DIR: DIR, UJI_PRESISI_JAWABAN: JAWABAN, GCP_PROJECT_ID, VERTEX_LOCATION, VERTEX_MODEL } = process.env;
const PARALEL = 3;

/** Ketiga atribut terukur SELALU ditanyakan saat mengukur, apa pun status gerbangnya sekarang. */
const ATRIBUT_UKUR = ATTRIBUTE_TYPES.filter((a) => (MEASURED as readonly string[]).includes(a.code)).map((a) => ({
  attribute_code: a.code,
  ai_suggestable: true,
  allowed_values: a.allowed_values,
}));

async function sepertiKameraProduksi(berkas: string): Promise<Buffer> {
  return sharp(readFileSync(berkas))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function tanyaModel(dir: string, berkas: string[]): Promise<JawabanModel[]> {
  if (!GCP_PROJECT_ID || !VERTEX_LOCATION || !VERTEX_MODEL)
    throw new Error("GCP_PROJECT_ID, VERTEX_LOCATION, dan VERTEX_MODEL wajib diisi untuk memanggil model.");
  const call = vertexCaller({ project: GCP_PROJECT_ID, location: VERTEX_LOCATION });
  const hasil: JawabanModel[] = [];
  let i = 0;
  async function pekerja() {
    while (i < berkas.length) {
      const b = berkas[i++];
      const r = await suggestAttributes(
        { image: await sepertiKameraProduksi(path.join(dir, b)), mimeType: "image/jpeg", vantage: "entrance", attributes: ATRIBUT_UKUR },
        { call, model: VERTEX_MODEL! },
      );
      hasil.push({ berkas: b, status: r.status, latency_ms: r.latency_ms, suggestions: r.suggestions.map(({ attribute_code, value }) => ({ attribute_code, value })) });
      console.log(`  ${hasil.length}/${berkas.length} ${b}: ${r.status} ${r.latency_ms} ms`);
    }
  }
  await Promise.all(Array.from({ length: PARALEL }, pekerja));
  return hasil;
}

describe.skipIf(!DIR)("pengukuran precision (pelaksana, bukan tes biasa)", () => {
  it(
    "mengukur himpunan uji berlabel dan menulis laporan",
    async () => {
      const dir = DIR!;
      const berkasLabel = JSON.parse(readFileSync(path.join(dir, "labels.json"), "utf8")) as BerkasLabel;

      const galat = validasiBerkasLabel(berkasLabel, PROMPT_VERSION);
      const ukur = [...new Set(berkasLabel.citra.filter((c) => c.bagian === "ukur").map((c) => c.berkas))];
      for (const b of ukur) if (!existsSync(path.join(dir, b))) galat.push(`Berkas citra tidak ada: ${b}`);
      expect(galat, "labels.json belum siap diukur").toEqual([]);

      let jawaban: JawabanModel[];
      let model: string;
      if (JAWABAN) {
        const simpanan = JSON.parse(readFileSync(JAWABAN, "utf8"));
        expect(simpanan.prompt_version, "jawaban tersimpan dibuat dengan prompt lain").toBe(PROMPT_VERSION);
        jawaban = simpanan.jawaban;
        model = simpanan.model;
      } else {
        console.log(`Menanyai ${VERTEX_MODEL} untuk ${ukur.length} citra (prompt ${PROMPT_VERSION}, paralel ${PARALEL})…`);
        jawaban = await tanyaModel(dir, ukur);
        model = VERTEX_MODEL!;
      }

      const tanggal = new Date().toISOString();
      const hasil = hitungPresisi(berkasLabel.citra, jawaban);
      const latensi = ringkasLatensi(
        jawaban.map((j) => j.latency_ms).filter((x): x is number => typeof x === "number"),
        TIMEOUT_MS,
      );
      const sepakat = kesepakatanPelabel(berkasLabel.citra.filter((c) => c.bagian === "ukur"));

      const md = [
        laporanMarkdown(hasil, { model, prompt_version: PROMPT_VERSION, tanggal }),
        "",
        "## Latensi (syarat 00-KONTRAK §10: di bawah 8 detik)",
        "",
        latensi
          ? `n=${latensi.n} · median ${latensi.median} ms · p95 ${latensi.p95} ms · maks ${latensi.maks} ms · ${latensi.lewat_batas} panggilan mencapai batas ${TIMEOUT_MS / 1000} detik`
          : "Tidak ada data latensi (dihitung ulang dari jawaban tanpa latensi).",
        "",
        "## Kesepakatan dua pelabel",
        "",
        Object.keys(sepakat).length
          ? Object.entries(sepakat)
              .map(([k, v]) => `- ${k}: ${v!.sepakat}/${v!.dibandingkan} citra sepakat`)
              .join("\n")
          : "Tidak ada citra yang dilabeli dua orang. docs-40 §2 menyarankan 10 citra dilabeli dua orang.",
      ].join("\n");

      const keluar = path.join(dir, "hasil");
      mkdirSync(keluar, { recursive: true });
      const nama = `presisi-${model}-${PROMPT_VERSION}-${tanggal.replace(/[:.]/g, "-")}`;
      writeFileSync(path.join(keluar, `${nama}.md`), md);
      writeFileSync(
        path.join(keluar, `${nama}.json`),
        JSON.stringify({ model, prompt_version: PROMPT_VERSION, tanggal, jawaban, hasil, latensi, sepakat, sql_gerbang: sqlGerbang(hasil.per_atribut) }, null, 2),
      );
      console.log(`\n${md}\n\nTersimpan: ${path.join(keluar, nama)}.{md,json}`);
    },
    30 * 60_000,
  );
});
