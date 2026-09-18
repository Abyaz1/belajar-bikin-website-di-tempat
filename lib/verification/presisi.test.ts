/**
 * Pengukuran precision — docs-20 §5 dan docs-40 §2. Ditulis sebelum presisi.ts.
 */

import { describe, expect, it } from "vitest";
import {
  AMBANG_GERBANG,
  binerkan,
  hitungPresisi,
  kesepakatanPelabel,
  laporanMarkdown,
  ringkasLatensi,
  sqlGerbang,
  validasiBerkasLabel,
  wilson,
  type EntriLabel,
  type JawabanModel,
} from "./presisi";

const ukur = (berkas: string, label: EntriLabel["label"], pelabel = "A"): EntriLabel => ({ berkas, bagian: "ukur", pelabel, label });
const jawab = (berkas: string, usulan: Record<string, string>, status: JawabanModel["status"] = "ok"): JawabanModel => ({
  berkas,
  status,
  suggestions: Object.entries(usulan).map(([attribute_code, value]) => ({ attribute_code, value })),
});

describe("binerkan (docs-20 §5.1)", () => {
  it.each([
    ["0", "tidak_ada"],
    ["1", "ada"],
    ["12", "ada"],
    ["ada", "ada"],
    ["tidak_ada", "tidak_ada"],
    ["not_visible", "not_visible"],
  ])("step_count %s → %s", (v, h) => expect(binerkan("step_count", v)).toBe(h));

  it("atribut lain tidak diubah", () => {
    expect(binerkan("ramp_wheelchair", "yes")).toBe("yes");
  });
});

describe("hitungPresisi", () => {
  it("kelas positif di arah berbahaya: 'ada ramp' yang keliru adalah salah positif", () => {
    const labels = [
      ukur("a.jpg", { ramp_wheelchair: "yes" }),
      ukur("b.jpg", { ramp_wheelchair: "no" }),
      ukur("c.jpg", { ramp_wheelchair: "no" }),
      ukur("d.jpg", { ramp_wheelchair: "yes" }),
    ];
    const jawaban = [
      jawab("a.jpg", { ramp_wheelchair: "yes" }), // TP
      jawab("b.jpg", { ramp_wheelchair: "yes" }), // FP — berbahaya
      jawab("c.jpg", { ramp_wheelchair: "no" }), // TN
      jawab("d.jpg", { ramp_wheelchair: "no" }), // FN
    ];
    const r = hitungPresisi(labels, jawaban).per_atribut.find((a) => a.attribute_code === "ramp_wheelchair")!;
    expect(r).toMatchObject({ benar_positif: 1, salah_positif: 1, salah_negatif: 1, dijawab: 4, benar: 2 });
    expect(r.precision).toBe(0.5);
    expect(r.recall).toBe(0.5);
    expect(r.lolos_gerbang).toBe(false);
  });

  it("step_count: 'nol anak tangga' yang keliru adalah salah positif", () => {
    const r = hitungPresisi(
      [ukur("a.jpg", { step_count: "ada" }), ukur("b.jpg", { step_count: "tidak_ada" })],
      [jawab("a.jpg", { step_count: "0" }), jawab("b.jpg", { step_count: "0" })],
    ).per_atribut.find((a) => a.attribute_code === "step_count")!;
    expect(r).toMatchObject({ benar_positif: 1, salah_positif: 1 });
  });

  it("not_visible — dari label maupun dari model — dikeluarkan dari hitungan, dilaporkan sebagai cakupan", () => {
    const r = hitungPresisi(
      [ukur("a.jpg", { tactile_paving: "not_visible" }), ukur("b.jpg", { tactile_paving: "yes" }), ukur("c.jpg", { tactile_paving: "yes" })],
      [jawab("a.jpg", { tactile_paving: "yes" }), jawab("b.jpg", { tactile_paving: "not_visible" }), jawab("c.jpg", { tactile_paving: "yes" })],
    ).per_atribut.find((a) => a.attribute_code === "tactile_paving")!;
    expect(r).toMatchObject({ label_tidak_terlihat: 1, model_tidak_terlihat: 1, dijawab: 1, benar_positif: 1, salah_positif: 0 });
    expect(r.cakupan).toBe(0.5);
  });

  it("citra penyetelan prompt tidak pernah diukur (docs-20 §5.4)", () => {
    const h = hitungPresisi(
      [{ berkas: "t.jpg", bagian: "penyetelan", label: { ramp_wheelchair: "no" } }, ukur("a.jpg", { ramp_wheelchair: "yes" })],
      [jawab("t.jpg", { ramp_wheelchair: "yes" }), jawab("a.jpg", { ramp_wheelchair: "yes" })],
    );
    expect(h.dilewati_penyetelan).toBe(1);
    expect(h.per_atribut.find((a) => a.attribute_code === "ramp_wheelchair")!.salah_positif).toBe(0);
  });

  it("panggilan model yang gagal/timeout dihitung terpisah, tidak masuk precision", () => {
    const h = hitungPresisi([ukur("a.jpg", { ramp_wheelchair: "no" })], [jawab("a.jpg", {}, "timeout")]);
    expect(h.gagal_model).toEqual({ timeout: 1 });
    expect(h.per_atribut.find((a) => a.attribute_code === "ramp_wheelchair")!.dijawab).toBe(0);
  });

  it("model tidak pernah mengusulkan kelas positif → precision tidak terdefinisi → TIDAK lolos gerbang", () => {
    const r = hitungPresisi([ukur("a.jpg", { ramp_wheelchair: "no" })], [jawab("a.jpg", { ramp_wheelchair: "no" })]).per_atribut.find(
      (a) => a.attribute_code === "ramp_wheelchair",
    )!;
    expect(r.precision).toBeNull();
    expect(r.lolos_gerbang).toBe(false);
    expect(r.peringatan.join(" ")).toMatch(/tidak terdefinisi/);
  });

  it("citra yang dilabeli dua orang dihitung SEKALI; kalau label mereka berbeda, citra itu dianggap tidak terlihat", () => {
    const labels = [
      ukur("a.jpg", { ramp_wheelchair: "yes" }, "A"),
      ukur("a.jpg", { ramp_wheelchair: "yes" }, "B"),
      ukur("b.jpg", { ramp_wheelchair: "no" }, "A"),
      ukur("b.jpg", { ramp_wheelchair: "yes" }, "B"),
    ];
    const jawaban = [jawab("a.jpg", { ramp_wheelchair: "yes" }), jawab("b.jpg", { ramp_wheelchair: "yes" })];
    const r = hitungPresisi(labels, jawaban).per_atribut.find((a) => a.attribute_code === "ramp_wheelchair")!;
    expect(r).toMatchObject({ benar_positif: 1, salah_positif: 0, label_tidak_terlihat: 1, dijawab: 1 });
  });

  it("gerbang per atribut: 0,85 lolos, di bawahnya tidak", () => {
    expect(AMBANG_GERBANG).toBe(0.85);
    const labels = Array.from({ length: 20 }, (_, i) => ukur(`${i}.jpg`, { ramp_wheelchair: i < 17 ? "yes" : "no" }));
    const jawaban = Array.from({ length: 20 }, (_, i) => jawab(`${i}.jpg`, { ramp_wheelchair: "yes" }));
    const r = hitungPresisi(labels, jawaban).per_atribut.find((a) => a.attribute_code === "ramp_wheelchair")!;
    expect(r.precision).toBe(0.85);
    expect(r.lolos_gerbang).toBe(true);
  });

  it("peringatan: sampel di bawah 20, tanpa contoh negatif, atau tanpa contoh positif", () => {
    const r = hitungPresisi([ukur("a.jpg", { ramp_wheelchair: "yes" })], [jawab("a.jpg", { ramp_wheelchair: "yes" })]).per_atribut.find(
      (a) => a.attribute_code === "ramp_wheelchair",
    )!;
    const p = r.peringatan.join(" | ");
    expect(p).toMatch(/kurang dari 20/);
    expect(p).toMatch(/negatif/);
  });
});

describe("wilson", () => {
  it("interval 95% untuk 17/20", () => {
    const [lo, hi] = wilson(17, 20)!;
    expect(lo).toBeCloseTo(0.64, 2);
    expect(hi).toBeCloseTo(0.948, 2);
  });
  it("n = 0 → tidak terdefinisi", () => expect(wilson(0, 0)).toBeNull());
});

describe("keputusan gerbang", () => {
  it("SQL hanya untuk atribut yang tidak lolos, satu per satu — bukan mematikan semuanya", () => {
    const labels = [ukur("a.jpg", { ramp_wheelchair: "no", step_count: "tidak_ada" })];
    const jawaban = [jawab("a.jpg", { ramp_wheelchair: "yes", step_count: "0" })];
    expect(sqlGerbang(hitungPresisi(labels, jawaban).per_atribut)).toEqual([
      "update attribute_type set ai_suggestion_enabled = false where code = 'ramp_wheelchair';",
      "update attribute_type set ai_suggestion_enabled = false where code = 'tactile_paving';",
    ]);
  });
});

describe("laporan", () => {
  it("setiap angka precision didampingi ukuran sampel dan interval", () => {
    const h = hitungPresisi([ukur("a.jpg", { ramp_wheelchair: "yes" })], [jawab("a.jpg", { ramp_wheelchair: "yes" })]);
    const md = laporanMarkdown(h, { model: "m", prompt_version: "v", tanggal: "2026-09-18T12:00:00Z" });
    const baris = md.split("\n").filter((l) => l.startsWith("| ramp_wheelchair"));
    expect(baris[0]).toMatch(/n=1/);
    expect(baris[0]).toMatch(/95%/);
    expect(md).toMatch(/indikatif/i);
    expect(md).toMatch(/model m/);
  });
});

describe("validasi berkas label", () => {
  const dasar = { prompt_dibekukan: "P1", citra: [ukur("a.jpg", { step_count: "ada", ramp_wheelchair: "no", tactile_paving: "not_visible" })] };

  it("berkas yang benar lolos", () => {
    expect(validasiBerkasLabel(dasar, "P1")).toEqual([]);
  });

  it("prompt berubah setelah dibekukan → ditolak, harus bekukan ulang", () => {
    expect(validasiBerkasLabel(dasar, "P2").join(" ")).toMatch(/prompt/i);
  });

  it("label angka untuk step_count ditolak — docs-40: jangan label angka", () => {
    const salah = { ...dasar, citra: [ukur("a.jpg", { step_count: "3" })] };
    expect(validasiBerkasLabel(salah, "P1").join(" ")).toMatch(/step_count/);
  });

  it("atribut tak dikenal, nilai tak sah, dan bagian tak dikenal ditolak", () => {
    const salah = {
      ...dasar,
      citra: [{ berkas: "a.jpg", bagian: "lain", label: { kerb: "raised", ramp_wheelchair: "mungkin" } }],
    };
    const g = validasiBerkasLabel(salah as never, "P1").join(" | ");
    expect(g).toMatch(/kerb/);
    expect(g).toMatch(/mungkin/);
    expect(g).toMatch(/bagian/);
  });

  it("berkas yang sama dilabeli dua kali oleh orang yang sama ditolak", () => {
    const dobel = { ...dasar, citra: [...dasar.citra, ...dasar.citra] };
    expect(validasiBerkasLabel(dobel, "P1").join(" ")).toMatch(/dua kali/);
  });
});

describe("kesepakatan dua pelabel (docs-40 §2)", () => {
  it("dihitung per atribut dari berkas yang dilabeli dua orang", () => {
    const k = kesepakatanPelabel([
      ukur("a.jpg", { ramp_wheelchair: "yes" }, "A"),
      ukur("a.jpg", { ramp_wheelchair: "yes" }, "B"),
      ukur("b.jpg", { ramp_wheelchair: "no" }, "A"),
      ukur("b.jpg", { ramp_wheelchair: "yes" }, "B"),
    ]);
    expect(k.ramp_wheelchair).toEqual({ dibandingkan: 2, sepakat: 1 });
  });
});

describe("ringkasLatensi (syarat §10: di bawah 8 detik)", () => {
  it("median, p95, maksimum, dan jumlah yang lewat batas", () => {
    const r = ringkasLatensi([1200, 900, 3000, 8100, 2500, 1800, 2200, 2600, 2400, 2000], 8000);
    expect(r).toEqual({ n: 10, median: 2300, p95: 8100, maks: 8100, lewat_batas: 1 });
  });
  it("kosong → null", () => expect(ringkasLatensi([], 8000)).toBeNull());
});
