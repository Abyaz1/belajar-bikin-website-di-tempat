/**
 * Perakitan aturan dari baris tabel dan bentuk respons E6 — docs-20 §6.
 * Ditulis sebelum profil.ts.
 */

import { describe, expect, it } from "vitest";
import { MINIMUM_ATTRIBUTES, RULE_GROUPS, RULE_MESSAGES } from "./reference";
import { profilPublik, rakitAturan, type BarisAturan } from "./profil";

/** Baris hasil `SQL_ATURAN` persis seperti yang dikembalikan pg untuk data acuan. */
function barisDariAcuan(): BarisAturan[] {
  return RULE_GROUPS.flatMap((g) =>
    g.conditions.map((c, i) => ({
      group_id: g.id,
      profile_code: g.profile_code,
      verdict: g.verdict,
      message_id: g.message_id,
      priority: g.priority,
      condition_id: `${g.id}__${i + 1}`,
      subject_type: c.subject_type,
      subject_code: c.subject_code,
      operator: c.operator,
      value: c.value,
    })),
  );
}

describe("rakitAturan", () => {
  it("baris tabel dirakit kembali persis menjadi aturan acuan", () => {
    const urut = (xs: typeof RULE_GROUPS) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(urut(rakitAturan(barisDariAcuan()))).toEqual(urut(RULE_GROUPS));
  });

  it("urutan kondisi dalam grup mengikuti id kondisi, bukan urutan baris dari basis data", () => {
    const acak = [...barisDariAcuan()].reverse();
    const g = rakitAturan(acak).find((x) => x.id === "kursi_tangga_tanpa_ramp")!;
    expect(g.conditions.map((c) => c.subject_code)).toEqual(["step_count", "ramp_wheelchair"]);
  });

  it("grup tanpa kondisi (hasil left join) tetap muncul dengan kondisi kosong — dan engine tidak pernah menyalakannya", () => {
    const g = rakitAturan([
      { group_id: "kosong", profile_code: "netra", verdict: "caution", message_id: "x", priority: 1, condition_id: null, subject_type: null, subject_code: null, operator: null, value: null },
    ]);
    expect(g).toEqual([{ id: "kosong", profile_code: "netra", verdict: "caution", message_id: "x", priority: 1, conditions: [] }]);
  });

  it("priority dari pg bisa berupa string (numeric) — tetap jadi angka", () => {
    const [b] = barisDariAcuan();
    const [g] = rakitAturan([{ ...b, priority: "10" as unknown as number }]);
    expect(g.priority).toBe(10);
  });
});

describe("profilPublik (bentuk respons E6)", () => {
  const hasil = profilPublik(RULE_GROUPS, MINIMUM_ATTRIBUTES);

  it("tiga profil, urutan tetap", () => {
    expect(hasil.map((p) => p.code)).toEqual(["kursi_roda_manual", "alat_bantu_jalan", "netra"]);
    expect(hasil.map((p) => p.label)).toEqual(["Kursi roda manual", "Alat bantu jalan", "Netra"]);
  });

  it("setiap grup membawa kalimat untuk manusia, bukan message_id", () => {
    for (const p of hasil)
      for (const g of p.rule_groups) {
        expect(Object.values(RULE_MESSAGES)).toContain(g.message);
        expect(g).not.toHaveProperty("message_id");
      }
  });

  it("jumlah blocker: kursi roda 4, alat bantu 0, netra 0 — batasan yang disebut jujur di deck", () => {
    const blocker = (code: string) => hasil.find((p) => p.code === code)!.rule_groups.filter((g) => g.verdict === "blocker").length;
    expect([blocker("kursi_roda_manual"), blocker("alat_bantu_jalan"), blocker("netra")]).toEqual([4, 0, 0]);
  });

  it("grup urut prioritas; himpunan minimum urut kamus atribut", () => {
    const kursi = hasil.find((p) => p.code === "kursi_roda_manual")!;
    expect(kursi.rule_groups.map((g) => g.id)).toEqual([
      "kursi_tangga_tanpa_ramp",
      "kursi_pintu_sempit",
      "kursi_kerb_tinggi",
      "kursi_lift_mati",
      "kursi_permukaan_buruk",
    ]);
    expect(kursi.minimum_attributes.map((m) => m.attribute_code)).toEqual([
      "step_count",
      "ramp_wheelchair",
      "kerb",
      "door_width_band",
      "surface_condition",
      "elevator_status",
    ]);
  });

  it("syarat lift tetap tercantum di himpunan minimum", () => {
    const lift = hasil[0].minimum_attributes.find((m) => m.attribute_code === "elevator_status");
    expect(lift).toEqual({ attribute_code: "elevator_status", required_when_property: "layanan_di_atas_lantai_dasar", required_when_value: "true" });
  });

  it("tidak ada penilaian, skor, atau angka keyakinan di respons", () => {
    expect(JSON.stringify(hasil)).not.toMatch(/dapat_diakses|score|skor|confidence/);
  });
});
