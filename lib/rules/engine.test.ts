/**
 * Tes rules engine — docs-20 §2.3 dan §2.4. Ditulis sebelum engine.ts.
 * Jalankan sebelum menyambungkan engine ke apa pun: npm test
 */

import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";
import { MINIMUM_ATTRIBUTES, RULE_GROUPS } from "./reference";
import type { AttributeFact, EvaluationInput, ProfileCode } from "./types";

const PROFIL: ProfileCode[] = ["kursi_roda_manual", "alat_bantu_jalan", "netra"];

const ok = (value: string, last_verified_at = "2026-09-18T03:00:00Z"): AttributeFact => ({
  value,
  status: "terverifikasi",
  last_verified_at,
});
const basi = (value: string, last_verified_at = "2025-05-03T03:00:00Z"): AttributeFact => ({
  value,
  status: "perlu_ditinjau_ulang",
  last_verified_at,
});
/** Nilai dari seed OSM: ada nilainya, tapi belum pernah diperiksa. */
const seedOsm = (value: string): AttributeFact => ({ value, status: "belum_terverifikasi", last_verified_at: null });

function nilai(
  profile: ProfileCode,
  attributes: EvaluationInput["attributes"],
  place: EvaluationInput["place"] = { layanan_di_atas_lantai_dasar: false },
) {
  return evaluate({ profile, place, attributes, rules: RULE_GROUPS, minimum: MINIMUM_ATTRIBUTES });
}

const ENTRANCE_BAIK = {
  step_count: ok("0"),
  ramp_wheelchair: ok("yes"),
  kerb: ok("lowered"),
  door_width_band: ok("gt90"),
  surface_condition: ok("good"),
  tactile_paving: ok("yes"),
};

// ── docs-20 §2.4, persis ────────────────────────────────────────────────────

describe("test case wajib §2.4", () => {
  const kasus: [string, EvaluationInput["attributes"], [string, string, string]][] = [
    ["nol atribut terverifikasi", {}, ["belum_dapat_dipastikan", "belum_dapat_dipastikan", "belum_dapat_dipastikan"]],
    [
      "step_count 0, ramp no, sisanya kosong",
      { step_count: ok("0"), ramp_wheelchair: ok("no") },
      ["belum_dapat_dipastikan", "belum_dapat_dipastikan", "belum_dapat_dipastikan"],
    ],
    [
      "surface uneven, step_count kosong",
      { surface_condition: ok("uneven") },
      ["belum_dapat_dipastikan", "belum_dapat_dipastikan", "belum_dapat_dipastikan"],
    ],
    ["6 atribut entrance lengkap, lantai dasar, semua baik", ENTRANCE_BAIK, ["dapat_diakses", "dapat_diakses", "dapat_diakses"]],
    [
      "idem tapi step_count 2, ramp no (dipakai saat demo ganti profil)",
      { ...ENTRANCE_BAIK, step_count: ok("2"), ramp_wheelchair: ok("no") },
      ["tidak_dapat_diakses", "dengan_catatan", "dapat_diakses"],
    ],
  ];

  for (const [nama, attrs, harapan] of kasus) {
    for (const [i, p] of PROFIL.entries()) {
      it(`${nama} → ${p}: ${harapan[i]}`, () => {
        expect(nilai(p, attrs).verdict).toBe(harapan[i]);
      });
    }
  }
});

describe("uji konsistensi §2.4", () => {
  it.each(PROFIL)("setiap atribut di grup aturan %s ada di himpunan minimumnya", (p) => {
    const minimum = new Set(MINIMUM_ATTRIBUTES.filter((m) => m.profile_code === p).map((m) => m.attribute_code));
    const dipakai = RULE_GROUPS.filter((g) => g.profile_code === p).flatMap((g) =>
      g.conditions.filter((c) => c.subject_type === "attribute").map((c) => c.subject_code),
    );
    for (const code of dipakai) expect(minimum, `${p}: ${code}`).toContain(code);
  });

  it("tidak ada profil dengan himpunan minimum kosong (bug entri 10 PERUBAHAN.md)", () => {
    for (const p of PROFIL) expect(MINIMUM_ATTRIBUTES.some((m) => m.profile_code === p)).toBe(true);
  });

  it("ada tepat dua belas aturan", () => {
    expect(RULE_GROUPS).toHaveLength(12);
  });
});

// ── Urutan evaluasi §2.3 ────────────────────────────────────────────────────

describe("urutan evaluasi §2.3", () => {
  it("langkah 2: nilai seed OSM (belum_terverifikasi) TIDAK PERNAH memenuhi kondisi", () => {
    const r = nilai("kursi_roda_manual", { ...ENTRANCE_BAIK, kerb: seedOsm("raised") });
    expect(r.verdict).toBe("belum_dapat_dipastikan");
    expect(r.unknown).toEqual(["kerb"]);
    expect(r.notes).toEqual([]);
  });

  it("langkah 2: seed OSM yang 'baik' pun tidak membuat tempat dapat diakses", () => {
    const semuaSeed = Object.fromEntries(Object.entries(ENTRANCE_BAIK).map(([k, v]) => [k, seedOsm(v.value!)]));
    for (const p of PROFIL) expect(nilai(p, semuaSeed).verdict).toBe("belum_dapat_dipastikan");
  });

  it("langkah 3: atribut perlu_ditinjau_ulang tetap dipakai, verdict tidak diturunkan, catatan kesegaran dibawa", () => {
    const r = nilai("kursi_roda_manual", { ...ENTRANCE_BAIK, kerb: basi("raised", "2025-05-03T03:00:00Z") });
    expect(r.verdict).toBe("tidak_dapat_diakses");
    expect(r.freshness).toContainEqual({ attribute_code: "kerb", last_verified_at: "2025-05-03T03:00:00Z" });
  });

  it("langkah 3: atribut minimum yang basi tetap dihitung diketahui, dengan catatan", () => {
    const r = nilai("netra", { ...ENTRANCE_BAIK, tactile_paving: basi("yes") });
    expect(r.verdict).toBe("dapat_diakses");
    expect(r.unknown).toEqual([]);
    expect(r.freshness.map((f) => f.attribute_code)).toEqual(["tactile_paving"]);
  });

  it("langkah 4 sebelum 5: satu blocker yang terbukti cukup, walau atribut lain belum diketahui", () => {
    const r = nilai("kursi_roda_manual", { kerb: ok("raised") });
    expect(r.verdict).toBe("tidak_dapat_diakses");
    expect(r.notes.map((n) => n.rule_id)).toEqual(["kursi_kerb_tinggi"]);
  });

  it("langkah 5 sebelum 6: caution menyala tapi yang menentukan belum diperiksa → belum_dapat_dipastikan + catatan", () => {
    const r = nilai("kursi_roda_manual", { surface_condition: ok("damaged") });
    expect(r.verdict).toBe("belum_dapat_dipastikan");
    expect(r.unknown).toEqual(["step_count", "ramp_wheelchair", "door_width_band", "kerb"]);
    expect(r.notes.map((n) => n.rule_id)).toEqual(["kursi_permukaan_buruk"]);
  });

  it("langkah 6: caution tanpa atribut yang belum diketahui → dengan_catatan", () => {
    const r = nilai("netra", { ...ENTRANCE_BAIK, tactile_paving: ok("no") });
    expect(r.verdict).toBe("dengan_catatan");
    expect(r.notes).toEqual([{ rule_id: "netra_tanpa_jalur_pemandu", verdict: "caution", message_id: "tanpa_jalur_pemandu" }]);
  });

  it("grup menyala hanya kalau SEMUA kondisi terpenuhi (AND, bukan OR)", () => {
    // Ada anak tangga, tapi ada ramp: kursi_tangga_tanpa_ramp tidak menyala.
    const r = nilai("kursi_roda_manual", { ...ENTRANCE_BAIK, step_count: ok("3"), ramp_wheelchair: ok("yes") });
    expect(r.verdict).toBe("dapat_diakses");
  });

  it("anak tangga ada tapi ramp belum diketahui → tidak menyala, dan ramp masuk daftar belum diketahui", () => {
    const r = nilai("kursi_roda_manual", { ...ENTRANCE_BAIK, step_count: ok("2"), ramp_wheelchair: undefined });
    expect(r.verdict).toBe("belum_dapat_dipastikan");
    expect(r.unknown).toEqual(["ramp_wheelchair"]);
  });

  it("gte membandingkan angka, bukan teks ('10' ≥ '1')", () => {
    const r = nilai("kursi_roda_manual", { ...ENTRANCE_BAIK, step_count: ok("10"), ramp_wheelchair: ok("no") });
    expect(r.verdict).toBe("tidak_dapat_diakses");
  });

  it("not_visible diperlakukan belum diketahui", () => {
    const r = nilai("kursi_roda_manual", { ...ENTRANCE_BAIK, kerb: ok("not_visible") });
    expect(r.verdict).toBe("belum_dapat_dipastikan");
    expect(r.unknown).toEqual(["kerb"]);
  });
});

// ── Aturan lift: properti tempat + atribut minimum bersyarat ───────────────

describe("lift dan layanan_di_atas_lantai_dasar", () => {
  const atas = { layanan_di_atas_lantai_dasar: true };

  it("lift mati + layanan di atas → blocker kursi roda, caution alat bantu, tidak berpengaruh untuk netra", () => {
    const attrs = { ...ENTRANCE_BAIK, elevator_status: ok("not_working") };
    expect(nilai("kursi_roda_manual", attrs, atas).verdict).toBe("tidak_dapat_diakses");
    expect(nilai("alat_bantu_jalan", attrs, atas).verdict).toBe("dengan_catatan");
    expect(nilai("netra", attrs, atas).verdict).toBe("dapat_diakses");
  });

  it("lift mati tapi layanan di lantai dasar → aturan lift tidak menyala", () => {
    const attrs = { ...ENTRANCE_BAIK, elevator_status: ok("not_working") };
    expect(nilai("kursi_roda_manual", attrs).verdict).toBe("dapat_diakses");
  });

  it("layanan di atas dan status lift belum diketahui → lift masuk himpunan minimum", () => {
    const r = nilai("kursi_roda_manual", ENTRANCE_BAIK, atas);
    expect(r.verdict).toBe("belum_dapat_dipastikan");
    expect(r.unknown).toEqual(["elevator_status"]);
  });

  it("layanan di lantai dasar → lift tidak wajib diketahui", () => {
    expect(nilai("kursi_roda_manual", ENTRANCE_BAIK).unknown).toEqual([]);
  });
});

describe("kemurnian", () => {
  it("masukan yang sama selalu menghasilkan keluaran yang sama, dan masukan tidak diubah", () => {
    const attrs = { ...ENTRANCE_BAIK, step_count: ok("2"), ramp_wheelchair: ok("no") };
    const salinan = structuredClone(attrs);
    const a = nilai("kursi_roda_manual", attrs);
    const b = nilai("kursi_roda_manual", attrs);
    expect(a).toEqual(b);
    expect(attrs).toEqual(salinan);
  });
});
