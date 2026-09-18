/**
 * Data acuan: kamus atribut (00-KONTRAK §3), dua belas aturan (docs-20 §2.1),
 * dan himpunan atribut minimum (docs-20 §2.2).
 *
 * Saat berjalan, sistem membaca dari tabel. Berkas ini SUMBER untuk mengisi
 * tabel itu (lewat migrasi) dan untuk tes rules engine — bukan tempat logika.
 * Menambah profil keempat = menambah baris di sini dan di tabel, tanpa
 * mengubah satu baris pun di engine.ts.
 */

import type { AttributeType, MinimumAttribute, RuleCondition, RuleGroup } from "./types";

const ANGKA_0_SAMPAI_20 = Array.from({ length: 21 }, (_, i) => String(i));

export const ATTRIBUTE_TYPES: AttributeType[] = [
  { code: "step_count", value_type: "integer", allowed_values: ANGKA_0_SAMPAI_20, vantage: "entrance", is_required_at_vantage: true, review_interval_days: 365, ai_suggestable: true, label_id: "Anak tangga di pintu masuk" },
  { code: "ramp_wheelchair", value_type: "enum", allowed_values: ["yes", "no"], vantage: "entrance", is_required_at_vantage: true, review_interval_days: 365, ai_suggestable: true, label_id: "Ramp di pintu masuk" },
  { code: "kerb", value_type: "enum", allowed_values: ["flush", "lowered", "raised"], vantage: "entrance", is_required_at_vantage: false, review_interval_days: 365, ai_suggestable: false, label_id: "Tepi trotoar di depan pintu masuk" },
  { code: "door_width_band", value_type: "enum", allowed_values: ["lt80", "80_90", "gt90"], vantage: "entrance", is_required_at_vantage: false, review_interval_days: 365, ai_suggestable: false, label_id: "Lebar pintu masuk" },
  { code: "surface_condition", value_type: "enum", allowed_values: ["good", "uneven", "damaged"], vantage: "entrance", is_required_at_vantage: false, review_interval_days: 365, ai_suggestable: false, label_id: "Permukaan menuju pintu masuk" },
  { code: "tactile_paving", value_type: "enum", allowed_values: ["yes", "no"], vantage: "entrance", is_required_at_vantage: false, review_interval_days: 365, ai_suggestable: true, label_id: "Jalur pemandu" },
  { code: "elevator_status", value_type: "enum", allowed_values: ["none", "working", "not_working"], vantage: "interior", is_required_at_vantage: false, review_interval_days: 90, ai_suggestable: false, label_id: "Lift" },
  { code: "toilets_wheelchair", value_type: "enum", allowed_values: ["yes", "no"], vantage: "toilet", is_required_at_vantage: false, review_interval_days: 365, ai_suggestable: false, label_id: "Toilet kursi roda" },
];

// ── Kondisi yang dipakai bersama beberapa profil ────────────────────────────

const attr = (subject_code: string, operator: RuleCondition["operator"], value: string): RuleCondition => ({
  subject_type: "attribute",
  subject_code,
  operator,
  value,
});

const TANGGA_TANPA_RAMP = [attr("step_count", "gte", "1"), attr("ramp_wheelchair", "neq", "yes")];
const PINTU_SEMPIT = [attr("door_width_band", "eq", "lt80")];
const KERB_TINGGI = [attr("kerb", "eq", "raised")];
const LIFT_MATI: RuleCondition[] = [
  attr("elevator_status", "eq", "not_working"),
  { subject_type: "place_property", subject_code: "layanan_di_atas_lantai_dasar", operator: "eq", value: "true" },
];
const TANPA_JALUR_PEMANDU = [attr("tactile_paving", "eq", "no")];
const PERMUKAAN_BURUK = [attr("surface_condition", "in", "uneven,damaged")];

/** Kalimat per `message_id`. Hambatan disebut pada bangunan, bukan pada orang (docs-30 §7). */
export const RULE_MESSAGES: Record<string, string> = {
  tangga_tanpa_ramp: "Pintu masuk ini punya anak tangga dan tidak punya ramp.",
  pintu_sempit: "Bukaan pintu masuk ini kurang dari 80 cm.",
  kerb_tinggi: "Tepi trotoar di depan pintu masuk ini tinggi dan tidak dilandaikan.",
  lift_mati: "Lift gedung ini tidak berfungsi, padahal layanannya ada di atas lantai dasar.",
  tanpa_jalur_pemandu: "Tidak ada jalur pemandu menuju pintu masuk ini.",
  permukaan_buruk: "Permukaan menuju pintu masuk ini tidak rata atau rusak.",
};

// ── Dua belas aturan, docs-20 §2.1 ──────────────────────────────────────────
// Tidak ada verdict `irrelevant`: "tidak berpengaruh" = tidak ada baris.

export const RULE_GROUPS: RuleGroup[] = [
  { id: "kursi_tangga_tanpa_ramp", profile_code: "kursi_roda_manual", verdict: "blocker", message_id: "tangga_tanpa_ramp", priority: 10, conditions: TANGGA_TANPA_RAMP },
  { id: "alat_tangga_tanpa_ramp", profile_code: "alat_bantu_jalan", verdict: "caution", message_id: "tangga_tanpa_ramp", priority: 10, conditions: TANGGA_TANPA_RAMP },
  { id: "kursi_pintu_sempit", profile_code: "kursi_roda_manual", verdict: "blocker", message_id: "pintu_sempit", priority: 20, conditions: PINTU_SEMPIT },
  { id: "kursi_kerb_tinggi", profile_code: "kursi_roda_manual", verdict: "blocker", message_id: "kerb_tinggi", priority: 30, conditions: KERB_TINGGI },
  { id: "alat_kerb_tinggi", profile_code: "alat_bantu_jalan", verdict: "caution", message_id: "kerb_tinggi", priority: 30, conditions: KERB_TINGGI },
  { id: "netra_kerb_tinggi", profile_code: "netra", verdict: "caution", message_id: "kerb_tinggi", priority: 30, conditions: KERB_TINGGI },
  { id: "kursi_lift_mati", profile_code: "kursi_roda_manual", verdict: "blocker", message_id: "lift_mati", priority: 40, conditions: LIFT_MATI },
  { id: "alat_lift_mati", profile_code: "alat_bantu_jalan", verdict: "caution", message_id: "lift_mati", priority: 40, conditions: LIFT_MATI },
  { id: "netra_tanpa_jalur_pemandu", profile_code: "netra", verdict: "caution", message_id: "tanpa_jalur_pemandu", priority: 20, conditions: TANPA_JALUR_PEMANDU },
  { id: "kursi_permukaan_buruk", profile_code: "kursi_roda_manual", verdict: "caution", message_id: "permukaan_buruk", priority: 50, conditions: PERMUKAAN_BURUK },
  { id: "alat_permukaan_buruk", profile_code: "alat_bantu_jalan", verdict: "caution", message_id: "permukaan_buruk", priority: 50, conditions: PERMUKAAN_BURUK },
  { id: "netra_permukaan_buruk", profile_code: "netra", verdict: "caution", message_id: "permukaan_buruk", priority: 50, conditions: PERMUKAAN_BURUK },
];

// ── Himpunan atribut minimum, docs-20 §2.2 ──────────────────────────────────
// Ditulis eksplisit per profil, TIDAK diturunkan dari grup blocker. Kalau
// diturunkan dari blocker, alat_bantu_jalan dan netra (yang tidak punya
// blocker) punya himpunan kosong, dan tempat tanpa bukti apa pun jadi
// dapat_diakses. Itu bug yang ketemu saat dites (PERUBAHAN.md entri 10).

const selalu = (profile_code: MinimumAttribute["profile_code"], attribute_code: string): MinimumAttribute => ({
  profile_code,
  attribute_code,
  required_when_property: null,
  required_when_value: null,
});
const bilaLantaiAtas = (profile_code: MinimumAttribute["profile_code"]): MinimumAttribute => ({
  profile_code,
  attribute_code: "elevator_status",
  required_when_property: "layanan_di_atas_lantai_dasar",
  required_when_value: "true",
});

export const MINIMUM_ATTRIBUTES: MinimumAttribute[] = [
  ...["step_count", "ramp_wheelchair", "door_width_band", "kerb", "surface_condition"].map((c) => selalu("kursi_roda_manual", c)),
  bilaLantaiAtas("kursi_roda_manual"),
  ...["step_count", "ramp_wheelchair", "kerb", "surface_condition"].map((c) => selalu("alat_bantu_jalan", c)),
  bilaLantaiAtas("alat_bantu_jalan"),
  ...["kerb", "tactile_paving", "surface_condition"].map((c) => selalu("netra", c)),
];
