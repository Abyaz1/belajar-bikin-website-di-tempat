/**
 * Perakit jalur baca E1/E2/E3. Aturan dan kamus diambil dari reference.ts —
 * sumber yang sama dengan migrasi — supaya tes ini menilai persis seperti
 * produksi.
 */

import { describe, expect, it } from "vitest";
import { ATTRIBUTE_TYPES, MINIMUM_ATTRIBUTES, RULE_GROUPS, RULE_MESSAGES } from "@/lib/rules/reference";
import type { ProfileCode } from "@/lib/ui/api/types";
import {
  bacaBbox,
  bacaLimit,
  bacaProfil,
  idSah,
  LIMIT_BAWAAN,
  LIMIT_MAKS,
  rakitJejakAudit,
  rakitRincian,
  rakitRingkasan,
  type BarisAudit,
  type BarisState,
  type BarisTempat,
  type BarisTipeAtribut,
} from "./rakit";

const ATURAN = { rules: RULE_GROUPS, minimum: MINIMUM_ATTRIBUTES };
const TIPE: BarisTipeAtribut[] = ATTRIBUTE_TYPES.map(({ code, label_id, vantage }) => ({ code, label_id, vantage }));
const PROFIL: ProfileCode[] = ["kursi_roda_manual", "alat_bantu_jalan", "netra"];

const TEMPAT: BarisTempat = {
  id: "11111111-1111-4111-8111-00000000abcd",
  name: "Gedung Uji",
  category: "kampus",
  address: null,
  lat: "-6.891500",
  lon: "107.616700",
  source: "osm_seed",
  layanan_di_atas_lantai_dasar: false,
  third_party_claims: { wheelchair: "yes" },
  is_demo_seed: false,
};

function state(code: string, value: string, extra: Partial<BarisState> = {}): BarisState {
  return {
    place_id: TEMPAT.id,
    attribute_code: code,
    current_value: value,
    is_disputed: false,
    previous_value: null,
    previous_observed_at: null,
    corroboration_count: 1,
    source: "contribution",
    last_verified_at: new Date("2026-09-01T00:00:00Z"),
    next_review_at: new Date("2027-09-01T00:00:00Z"),
    is_demo_seed: false,
    status: "terverifikasi",
    ...extra,
  };
}

// docs-20 §2.4 baris terakhir: enam atribut pintu masuk lengkap, lantai dasar,
// tapi dua anak tangga tanpa ramp.
const TANGGA_TANPA_RAMP = [
  state("step_count", "2"),
  state("ramp_wheelchair", "no"),
  state("kerb", "flush"),
  state("door_width_band", "gt90"),
  state("surface_condition", "good"),
  state("tactile_paving", "yes"),
];

describe("E1 rakitRingkasan", () => {
  it("nol atribut terverifikasi → belum_dapat_dipastikan untuk ketiga profil", () => {
    for (const p of PROFIL) {
      const r = rakitRingkasan(TEMPAT, [], TIPE, p, ATURAN);
      expect(r.verdict).toBe("belum_dapat_dipastikan");
      expect(r.status_counts).toEqual({ belum_terverifikasi: 8, terverifikasi: 0, perlu_ditinjau_ulang: 0 });
      expect(r.unknown_attributes.length).toBeGreaterThan(0);
    }
  });

  it("nilai seed OSM (belum_terverifikasi) tidak menggerakkan penilaian", () => {
    const seed = state("kerb", "raised", {
      source: "osm_seed",
      status: "belum_terverifikasi",
      last_verified_at: null,
      next_review_at: null,
      corroboration_count: 0,
    });
    const r = rakitRingkasan(TEMPAT, [seed], TIPE, "kursi_roda_manual", ATURAN);
    expect(r.verdict).toBe("belum_dapat_dipastikan");
    expect(r.unknown_attributes).toContain("kerb");
  });

  it("baris demo ganti profil: kursi roda tidak dapat, alat bantu dengan catatan, netra dapat", () => {
    const verdict = (p: ProfileCode) => rakitRingkasan(TEMPAT, TANGGA_TANPA_RAMP, TIPE, p, ATURAN).verdict;
    expect(verdict("kursi_roda_manual")).toBe("tidak_dapat_diakses");
    expect(verdict("alat_bantu_jalan")).toBe("dengan_catatan");
    expect(verdict("netra")).toBe("dapat_diakses");
  });

  it("koordinat numeric dari pg jadi angka", () => {
    const r = rakitRingkasan(TEMPAT, [], TIPE, "netra", ATURAN);
    expect(r.lat).toBe(-6.8915);
    expect(r.lon).toBe(107.6167);
  });
});

describe("E2 rakitRincian", () => {
  it("catatan berisi kalimat manusia dari aturan yang menyala", () => {
    const r = rakitRincian(TEMPAT, TANGGA_TANPA_RAMP, TIPE, [], "kursi_roda_manual", ATURAN);
    expect(r.profile).toBe("kursi_roda_manual");
    expect(r.notes).toContainEqual({
      rule_id: "kursi_tangga_tanpa_ramp",
      verdict: "blocker",
      message: RULE_MESSAGES.tangga_tanpa_ramp,
    });
  });

  it("delapan atribut urut kamus kontrak, yang belum ada tampil belum_terverifikasi", () => {
    const r = rakitRincian(TEMPAT, [state("kerb", "flush")], TIPE, [], "netra", ATURAN);
    expect(r.attributes.map((a) => a.code)).toEqual(ATTRIBUTE_TYPES.map((a) => a.code));
    const lift = r.attributes.find((a) => a.code === "elevator_status")!;
    expect(lift).toMatchObject({ current_value: null, status: "belum_terverifikasi", source: null, corroboration_count: 0 });
    expect(r.attributes[0].audit_url).toBe(`/api/places/${TEMPAT.id}/attributes/step_count/audit`);
  });

  it("teks alternatif foto hanya ada kalau fotonya ada, dan menyebut tempat serta atributnya", () => {
    const r = rakitRincian(
      TEMPAT,
      [state("step_count", "0")],
      TIPE,
      [{ attribute_code: "step_count", public_path: "https://contoh/foto.jpg" }],
      "netra",
      ATURAN,
    );
    const tangga = r.attributes.find((a) => a.code === "step_count")!;
    expect(tangga.photo_url).toBe("https://contoh/foto.jpg");
    expect(tangga.photo_alt).toContain("Gedung Uji");
    expect(tangga.photo_alt).toContain("anak tangga");
    expect(r.attributes.find((a) => a.code === "kerb")!.photo_alt).toBeNull();
  });

  it("atribut perlu_ditinjau_ulang yang menentukan membawa catatan kesegaran lengkap dengan next_review_at", () => {
    const basi = state("kerb", "flush", {
      status: "perlu_ditinjau_ulang",
      last_verified_at: new Date("2025-01-01T00:00:00Z"),
      next_review_at: new Date("2026-01-01T00:00:00Z"),
    });
    const r = rakitRincian(TEMPAT, [basi, state("tactile_paving", "yes"), state("surface_condition", "good")], TIPE, [], "netra", ATURAN);
    expect(r.freshness_notes).toEqual([
      { attribute_code: "kerb", last_verified_at: "2025-01-01T00:00:00.000Z", next_review_at: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("tidak ada ai_confidence maupun storage_path di respons (aturan 5)", () => {
    const json = JSON.stringify(rakitRincian(TEMPAT, TANGGA_TANPA_RAMP, TIPE, [], "netra", ATURAN));
    expect(json).not.toContain("ai_confidence");
    expect(json).not.toContain("storage_path");
  });
});

describe("E3 rakitJejakAudit", () => {
  const T0 = new Date("2026-09-18T02:00:00Z");
  const T1 = new Date("2026-09-18T03:00:00Z");
  const atribut = TIPE.find((t) => t.code === "step_count")!;

  const audit: BarisAudit[] = [
    // Urutan masukan sengaja diacak: perakit yang mengurutkan.
    { id: "a5", entity_type: "attribute_state", entity_id: TEMPAT.id, action: "state_updated", actor: "Kontributor #7",
      payload_snapshot: { before: { current_value: "3" }, after: { attribute_code: "step_count", current_value: "0" } }, is_demo_seed: false, created_at: T1 },
    { id: "a4", entity_type: "observation", entity_id: "ob1", action: "observation_confirmed", actor: "Kontributor #7",
      payload_snapshot: { before: null, after: { attribute_code: "step_count", confirmed_value: "0", ai_suggested_value: "1", was_corrected: true, ai_confidence: 0.91 } },
      is_demo_seed: false, created_at: T1 },
    { id: "a3", entity_type: "evidence", entity_id: "ev2", action: "evidence_submitted", actor: "Kontributor #7",
      payload_snapshot: { before: null, after: {} }, is_demo_seed: false, created_at: T1 },
    { id: "a2", entity_type: "evidence", entity_id: "ev1", action: "provenance_failed", actor: "Kontributor #4",
      payload_snapshot: { before: null, after: {} }, is_demo_seed: false, created_at: T0 },
    { id: "a1", entity_type: "evidence", entity_id: "ev1", action: "evidence_submitted", actor: "Kontributor #4",
      payload_snapshot: { before: null, after: {} }, is_demo_seed: false, created_at: T0 },
  ];

  const jejak = rakitJejakAudit({
    tempat: TEMPAT,
    atribut,
    state: state("step_count", "0"),
    bukti: [
      { id: "ev1", client_captured_at: T0, distance_to_place_m: "214.00", client_accuracy_m: "22.00", capture_method: "getusermedia", public_path: null, is_demo_seed: false },
      { id: "ev2", client_captured_at: T1, distance_to_place_m: "31.00", client_accuracy_m: "18.00", capture_method: "getusermedia", public_path: null, is_demo_seed: false },
    ],
    pemeriksaan: [
      { evidence_id: "ev1", check_code: "C7", result: "fail", measured: "214", threshold: "120" },
      { evidence_id: "ev1", check_code: "C0", result: "pass", measured: null, threshold: null },
      { evidence_id: "ev1", check_code: "C6b", result: "pass", measured: "8", threshold: "60" },
    ],
    audit,
  });

  it("kronologis, satu entri per bukti, lalu konfirmasi, lalu perubahan state", () => {
    expect(jejak.entries.map((e) => `${e.id}:${e.action}`)).toEqual([
      "a2:provenance_failed",
      "a3:evidence_submitted",
      "a4:observation_confirmed",
      "a5:state_updated",
    ]);
  });

  it("bukti yang ditolak tetap tampil, dengan pemeriksaan urut C0–C8 dan nilai terukurnya", () => {
    const ditolak = jejak.entries[0];
    expect(ditolak.checks.map((c) => c.code)).toEqual(["C0", "C6b", "C7"]);
    expect(ditolak.checks[2]).toEqual({ code: "C7", result: "fail", measured: "214", threshold: "120" });
    expect(ditolak.evidence).toMatchObject({ id: "ev1", distance_to_place_m: 214, client_accuracy_m: 22 });
  });

  it("konfirmasi membawa nilai usulan dan nilai terkonfirmasi; state membawa sebelum–sesudah", () => {
    expect(jejak.entries[2]).toMatchObject({ ai_suggested_value: "1", confirmed_value: "0" });
    expect(jejak.entries[3]).toMatchObject({ before: "3", after: "0" });
  });

  it("klaim OSM ikut tampil, ai_confidence dari payload tidak pernah ikut (aturan 5)", () => {
    expect(jejak.third_party_claims).toEqual({ wheelchair: "yes" });
    expect(jejak.attribute).toEqual({ code: "step_count", label: atribut.label_id });
    expect(JSON.stringify(jejak)).not.toContain("ai_confidence");
  });
});

describe("parameter permintaan", () => {
  it("profil hanya tiga kode kontrak", () => {
    expect(bacaProfil("netra")).toBe("netra");
    expect(bacaProfil(null)).toBeNull();
    expect(bacaProfil("tunanetra")).toBeNull();
  });

  it("bbox empat angka dengan urutan min–maks; selain itu salah", () => {
    expect(bacaBbox(null)).toBeNull();
    expect(bacaBbox("107.60,-6.90,107.63,-6.88")).toEqual({ minLon: 107.6, minLat: -6.9, maxLon: 107.63, maxLat: -6.88 });
    expect(bacaBbox("107.60,-6.90,107.63")).toBe("salah");
    expect(bacaBbox("107.63,-6.90,107.60,-6.88")).toBe("salah");
    expect(bacaBbox("a,b,c,d")).toBe("salah");
  });

  it("limit bawaan dan batas atas", () => {
    expect(bacaLimit(null)).toBe(LIMIT_BAWAAN);
    expect(bacaLimit("0")).toBe(LIMIT_BAWAAN);
    expect(bacaLimit("25")).toBe(25);
    expect(bacaLimit("100000")).toBe(LIMIT_MAKS);
  });

  it("id tempat harus uuid", () => {
    expect(idSah(TEMPAT.id)).toBe(true);
    expect(idSah("contoh-1")).toBe(false);
    expect(idSah("1; drop table place")).toBe(false);
  });
});
