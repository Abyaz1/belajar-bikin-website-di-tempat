/**
 * Pengukuran precision usulan model — docs-20 §5, docs-40 §2. Murni: tanpa
 * jaringan, tanpa berkas. Pemanggilan model dan baca-tulis berkas ada di
 * presisi.run.test.ts.
 *
 * Empat ketetapan docs-20 §5:
 *  1. step_count dibinerkan: ada anak tangga / tidak ada — bentuk yang dipakai rules engine.
 *  2. Kelas positif di arah yang BERBAHAYA: "nol anak tangga", "ada ramp", "ada jalur
 *     pemandu" yang keliru mendorong orang berangkat ke tempat yang tertutup.
 *  3. not_visible (dari label maupun model) dikeluarkan dari hitungan, dilaporkan
 *     terpisah sebagai cakupan.
 *  4. Prompt dibekukan sebelum mengukur; citra bagian "penyetelan" tidak pernah diukur.
 *
 * Yang sah jadi gerbang HANYA precision di himpunan uji berlabel. Tingkat koreksi
 * kontributor (was_corrected) mengukur kesepakatan, bukan kebenaran — bukan gerbang.
 */

import type { ModelStatus } from "./core";
import { MEASURED } from "./core";

export const AMBANG_GERBANG = 0.85;
export const SAMPEL_MINIMUM = 20;
const NOT_VISIBLE = "not_visible";

export type AtributTerukur = (typeof MEASURED)[number];

export const KELAS_BERBAHAYA: Record<AtributTerukur, string> = {
  step_count: "tidak_ada",
  ramp_wheelchair: "yes",
  tactile_paving: "yes",
};

const LABEL_SAH: Record<AtributTerukur, string[]> = {
  step_count: ["ada", "tidak_ada", NOT_VISIBLE],
  ramp_wheelchair: ["yes", "no", NOT_VISIBLE],
  tactile_paving: ["yes", "no", NOT_VISIBLE],
};

export interface EntriLabel {
  berkas: string;
  /** "ukur" dihitung; "penyetelan" hanya untuk menyetel prompt, tidak pernah diukur. */
  bagian: "ukur" | "penyetelan";
  pelabel?: string;
  sumber?: string;
  label: Partial<Record<string, string>>;
}

export interface BerkasLabel {
  /** PROMPT_VERSION yang dibekukan sebelum pengukuran. */
  prompt_dibekukan: string;
  citra: EntriLabel[];
}

export interface JawabanModel {
  berkas: string;
  status: ModelStatus;
  suggestions: { attribute_code: string; value: string | null }[];
  latency_ms?: number;
}

export interface HasilAtribut {
  attribute_code: AtributTerukur;
  kelas_positif: string;
  /** Label yang tidak bisa dinilai manusia. */
  label_tidak_terlihat: number;
  /** Model menjawab not_visible. */
  model_tidak_terlihat: number;
  /** Model menjawab nilai (bukan not_visible) pada citra yang labelnya jelas. */
  dijawab: number;
  benar: number;
  benar_positif: number;
  salah_positif: number;
  salah_negatif: number;
  label_positif: number;
  label_negatif: number;
  precision: number | null;
  interval: [number, number] | null;
  recall: number | null;
  cakupan: number | null;
  lolos_gerbang: boolean;
  peringatan: string[];
}

export interface HasilPengukuran {
  per_atribut: HasilAtribut[];
  dilewati_penyetelan: number;
  gagal_model: Partial<Record<ModelStatus, number>>;
  citra_diukur: number;
}

export function binerkan(code: string, value: string): string {
  if (code !== "step_count" || value === NOT_VISIBLE) return value;
  if (value === "ada" || value === "tidak_ada") return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n === 0 ? "tidak_ada" : "ada";
}

/** Interval kepercayaan Wilson 95%. Sampel kecil → interval lebar; itu yang dilaporkan. */
export function wilson(k: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = k / n;
  const penyebut = 1 + (z * z) / n;
  const tengah = (p + (z * z) / (2 * n)) / penyebut;
  const jarak = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / penyebut;
  return [Math.max(0, tengah - jarak), Math.min(1, tengah + jarak)];
}

/**
 * Satu citra, satu label per atribut. Kalau dua pelabel sepakat, dipakai
 * sekali; kalau tidak sepakat, jadi not_visible — keraguan manusia yang
 * dipaksa jadi label membuat angkanya kotor (docs-40 §2).
 */
function gabungLabel(entri: EntriLabel[]): EntriLabel[] {
  const perBerkas = new Map<string, EntriLabel[]>();
  for (const e of entri) perBerkas.set(e.berkas, [...(perBerkas.get(e.berkas) ?? []), e]);
  return [...perBerkas.entries()].map(([berkas, daftar]) => {
    const label: EntriLabel["label"] = {};
    for (const code of MEASURED) {
      const nilai = daftar.map((d) => d.label[code]).filter((v): v is string => v !== undefined).map((v) => binerkan(code, v));
      if (nilai.length === 0) continue;
      label[code] = nilai.every((v) => v === nilai[0]) ? nilai[0] : NOT_VISIBLE;
    }
    return { berkas, bagian: daftar[0].bagian, label };
  });
}

export function hitungPresisi(labels: EntriLabel[], jawaban: JawabanModel[]): HasilPengukuran {
  const perBerkas = new Map(jawaban.map((j) => [j.berkas, j]));
  const diukur = gabungLabel(labels.filter((l) => l.bagian === "ukur"));
  const gagal_model: HasilPengukuran["gagal_model"] = {};
  const jawabanSah = new Map<string, JawabanModel>();
  const gagalDicatat = new Set<string>();
  for (const l of diukur) {
    const j = perBerkas.get(l.berkas);
    if (!j) continue;
    if (j.status !== "ok") {
      if (!gagalDicatat.has(l.berkas)) {
        gagal_model[j.status] = (gagal_model[j.status] ?? 0) + 1;
        gagalDicatat.add(l.berkas);
      }
      continue;
    }
    jawabanSah.set(l.berkas, j);
  }

  const per_atribut = MEASURED.map((code): HasilAtribut => {
    const pos = KELAS_BERBAHAYA[code];
    const h: HasilAtribut = {
      attribute_code: code,
      kelas_positif: pos,
      label_tidak_terlihat: 0,
      model_tidak_terlihat: 0,
      dijawab: 0,
      benar: 0,
      benar_positif: 0,
      salah_positif: 0,
      salah_negatif: 0,
      label_positif: 0,
      label_negatif: 0,
      precision: null,
      interval: null,
      recall: null,
      cakupan: null,
      lolos_gerbang: false,
      peringatan: [],
    };
    for (const l of diukur) {
      const mentah = l.label[code];
      if (mentah === undefined) continue;
      const L = binerkan(code, mentah);
      if (L === NOT_VISIBLE) {
        h.label_tidak_terlihat++;
        continue;
      }
      if (L === pos) h.label_positif++;
      else h.label_negatif++;

      const j = jawabanSah.get(l.berkas);
      if (!j) continue;
      const s = j.suggestions.find((x) => x.attribute_code === code);
      if (!s || s.value === null) continue;
      const S = binerkan(code, s.value);
      if (S === NOT_VISIBLE) {
        h.model_tidak_terlihat++;
        continue;
      }
      h.dijawab++;
      if (S === L) h.benar++;
      if (S === pos && L === pos) h.benar_positif++;
      else if (S === pos) h.salah_positif++;
      else if (L === pos) h.salah_negatif++;
    }

    const usulanPositif = h.benar_positif + h.salah_positif;
    h.precision = usulanPositif > 0 ? h.benar_positif / usulanPositif : null;
    h.interval = wilson(h.benar_positif, usulanPositif);
    const labelPositifDijawab = h.benar_positif + h.salah_negatif;
    h.recall = labelPositifDijawab > 0 ? h.benar_positif / labelPositifDijawab : null;
    const terlihat = h.dijawab + h.model_tidak_terlihat;
    h.cakupan = terlihat > 0 ? h.dijawab / terlihat : null;
    h.lolos_gerbang = h.precision !== null && h.precision >= AMBANG_GERBANG;

    if (h.precision === null)
      h.peringatan.push("Precision tidak terdefinisi: model tidak pernah mengusulkan kelas positif. Tidak bisa diaktifkan tanpa bukti.");
    if (h.dijawab < SAMPEL_MINIMUM) h.peringatan.push(`Sampel terjawab ${h.dijawab}, kurang dari ${SAMPEL_MINIMUM}: angka indikatif, interval lebar.`);
    if (h.label_negatif === 0) h.peringatan.push("Tidak ada contoh negatif berlabel: himpunan ini tidak mengukur salah positif.");
    if (h.label_positif === 0) h.peringatan.push("Tidak ada contoh positif berlabel.");
    return h;
  });

  const penyetelan = new Set(labels.filter((l) => l.bagian === "penyetelan").map((l) => l.berkas));
  return { per_atribut, dilewati_penyetelan: penyetelan.size, gagal_model, citra_diukur: diukur.length };
}

/** Gerbang per atribut: yang di bawah ambang dimatikan SATU PER SATU, bukan semuanya. */
export function sqlGerbang(per_atribut: HasilAtribut[]): string[] {
  return per_atribut
    .filter((h) => !h.lolos_gerbang)
    .map((h) => `update attribute_type set ai_suggestable = false where code = '${h.attribute_code}';`);
}

const persen = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1).replace(".", ",")}%`);
const desimal = (x: number | null) => (x === null ? "tidak terdefinisi" : x.toFixed(2).replace(".", ","));

export function laporanMarkdown(h: HasilPengukuran, meta: { model: string; prompt_version: string; tanggal: string }): string {
  const baris = [
    `# Precision usulan model — model ${meta.model}, prompt ${meta.prompt_version}`,
    "",
    `Diukur ${meta.tanggal}. ${h.citra_diukur} citra bagian "ukur"; ${h.dilewati_penyetelan} citra penyetelan prompt tidak diukur.`,
    Object.keys(h.gagal_model).length
      ? `Panggilan model yang tidak menghasilkan jawaban: ${Object.entries(h.gagal_model).map(([k, v]) => `${k} ${v}`).join(", ")}.`
      : "Semua panggilan model menghasilkan jawaban.",
    "",
    `Gerbang: precision kelas berbahaya ≥ ${desimal(AMBANG_GERBANG)} per atribut.`,
    "",
    "| atribut | precision (kelas berbahaya) | salah positif | recall | ketepatan semua usulan | cakupan | gerbang |",
    "|---|---|---|---|---|---|---|",
    ...h.per_atribut.map((a) => {
      const n = a.benar_positif + a.salah_positif;
      const iv = a.interval ? `95%: ${desimal(a.interval[0])}–${desimal(a.interval[1])}` : "95%: —";
      return `| ${a.attribute_code} | ${desimal(a.precision)} (n=${n}; ${iv}) | ${a.salah_positif} | ${desimal(a.recall)} | ${a.dijawab ? `${a.benar}/${a.dijawab}` : "—"} | ${persen(a.cakupan)} (not_visible model ${a.model_tidak_terlihat}, label ${a.label_tidak_terlihat}) | ${a.lolos_gerbang ? "lolos" : "**dimatikan**"} |`;
    }),
    "",
    "Kelas positif: step_count = tidak ada anak tangga · ramp_wheelchair = ada · tactile_paving = ada.",
    "",
  ];
  const peringatan = h.per_atribut.flatMap((a) => a.peringatan.map((p) => `- ${a.attribute_code}: ${p}`));
  if (peringatan.length) baris.push("## Peringatan", "", ...peringatan, "");
  const sql = sqlGerbang(h.per_atribut);
  baris.push("## Keputusan gerbang", "");
  baris.push(sql.length ? ["```sql", ...sql, "```"].join("\n") : "Semua atribut lolos; tidak ada yang dimatikan.", "");
  baris.push(
    "## Batas keberlakuan (wajib diucapkan bersama angkanya)",
    "",
    "- Sampel per atribut kecil, sehingga angkanya indikatif dengan interval lebar.",
    "- Precision berlaku untuk pasangan model dan versi prompt di judul. Mengganti salah satunya = ukur ulang.",
    "- Tingkat koreksi kontributor bukan gerbang: ia mengukur kesepakatan kontributor, bukan kebenaran model.",
  );
  return baris.join("\n");
}

export function validasiBerkasLabel(b: BerkasLabel, promptSekarang: string): string[] {
  const galat: string[] = [];
  if (b.prompt_dibekukan !== promptSekarang)
    galat.push(
      `Prompt yang dibekukan (${b.prompt_dibekukan}) berbeda dengan PROMPT_VERSION sekarang (${promptSekarang}). Prompt berubah setelah dibekukan: bekukan ulang dan catat di PERUBAHAN.md sebelum mengukur.`,
    );
  const sudah = new Set<string>();
  for (const [i, c] of (b.citra ?? []).entries()) {
    const di = `citra[${i}] ${c.berkas}`;
    if (c.bagian !== "ukur" && c.bagian !== "penyetelan") galat.push(`${di}: bagian harus "ukur" atau "penyetelan", bukan "${c.bagian}".`);
    const kunci = `${c.berkas}|${c.pelabel ?? ""}`;
    if (sudah.has(kunci)) galat.push(`${di}: dilabeli dua kali oleh pelabel yang sama.`);
    sudah.add(kunci);
    for (const [code, v] of Object.entries(c.label ?? {})) {
      if (!(code in LABEL_SAH)) {
        galat.push(`${di}: atribut ${code} tidak diukur — hanya step_count, ramp_wheelchair, tactile_paving.`);
        continue;
      }
      if (!LABEL_SAH[code as AtributTerukur].includes(v ?? ""))
        galat.push(
          `${di}: nilai "${v}" untuk ${code} tidak sah; pakai ${LABEL_SAH[code as AtributTerukur].join(" / ")}${code === "step_count" ? " (jangan label angka)" : ""}.`,
        );
    }
  }
  return galat;
}

export function kesepakatanPelabel(labels: EntriLabel[]): Partial<Record<AtributTerukur, { dibandingkan: number; sepakat: number }>> {
  const perBerkas = new Map<string, EntriLabel[]>();
  for (const l of labels) perBerkas.set(l.berkas, [...(perBerkas.get(l.berkas) ?? []), l]);
  const hasil: Partial<Record<AtributTerukur, { dibandingkan: number; sepakat: number }>> = {};
  for (const daftar of perBerkas.values()) {
    if (daftar.length < 2) continue;
    const [a, b] = daftar;
    for (const code of MEASURED) {
      const va = a.label[code];
      const vb = b.label[code];
      if (va === undefined || vb === undefined) continue;
      const h = (hasil[code] ??= { dibandingkan: 0, sepakat: 0 });
      h.dibandingkan++;
      if (binerkan(code, va) === binerkan(code, vb)) h.sepakat++;
    }
  }
  return hasil;
}

/** Ringkasan latensi panggilan model. p95 memakai metode nearest-rank. */
export function ringkasLatensi(
  ms: number[],
  batas: number,
): { n: number; median: number; p95: number; maks: number; lewat_batas: number } | null {
  if (ms.length === 0) return null;
  const u = [...ms].sort((a, b) => a - b);
  const tengah = u.length / 2;
  const median = u.length % 2 ? u[Math.floor(tengah)] : (u[tengah - 1] + u[tengah]) / 2;
  const p95 = u[Math.min(u.length - 1, Math.ceil(0.95 * u.length) - 1)];
  return { n: u.length, median, p95, maks: u[u.length - 1], lewat_batas: u.filter((x) => x >= batas).length };
}
