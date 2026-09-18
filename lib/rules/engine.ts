/**
 * Rules engine — docs-20 §2. FUNGSI MURNI: tanpa I/O, tanpa basis data, tanpa
 * jam. Semua masukan eksplisit, jadi bisa dites dalam hitungan milidetik dan
 * hasilnya bisa dijelaskan baris demi baris ke juri.
 *
 * Jangan tambahkan I/O ke berkas ini. Jalur baca (E1/E2) yang memuat aturan dari
 * tabel lalu memanggil `evaluate`.
 *
 * Urutan evaluasi (§2.3):
 *  1. Grup menyala kalau SEMUA kondisinya terpenuhi (AND, tidak pernah OR).
 *  2. Kondisi yang menunjuk atribut belum_terverifikasi TIDAK PERNAH terpenuhi —
 *     termasuk nilai dari seed OSM. Klaim swalapor tidak menggerakkan penilaian.
 *  3. Atribut perlu_ditinjau_ulang dipakai seperti biasa, dengan catatan kesegaran.
 *     Verdict tidak diturunkan otomatis karena data basi.
 *  4. Ada blocker menyala                          → tidak_dapat_diakses
 *  5. Ada atribut minimum yang belum terverifikasi → belum_dapat_dipastikan
 *  6. Ada caution menyala                          → dengan_catatan
 *  7. Selain itu                                   → dapat_diakses
 * Langkah 5 SEBELUM 6: permukaan rusak dengan jumlah anak tangga belum diketahui
 * harus "belum dapat dipastikan", bukan "dengan catatan".
 */

import { NOT_VISIBLE } from "@/lib/ui/api/types";
import type {
  AttributeFact,
  EvaluationInput,
  EvaluationResult,
  FiredRule,
  FreshnessNote,
  MinimumAttribute,
  RuleCondition,
  RuleGroup,
} from "./types";

/** Atribut yang boleh dipakai untuk menilai: sudah diperiksa dan bernilai. */
function known(fact: AttributeFact | undefined): fact is AttributeFact & { value: string } {
  return (
    fact !== undefined &&
    fact.status !== "belum_terverifikasi" &&
    fact.value !== null &&
    fact.value !== "" &&
    fact.value !== NOT_VISIBLE
  );
}

function compare(actual: string, operator: RuleCondition["operator"], expected: string): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gte":
    case "lte": {
      const a = Number(actual);
      const e = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(e)) return false;
      return operator === "gte" ? a >= e : a <= e;
    }
    case "in":
      return expected.split(",").map((s) => s.trim()).includes(actual);
    case "not_in":
      return !expected.split(",").map((s) => s.trim()).includes(actual);
  }
}

function conditionHolds(c: RuleCondition, input: EvaluationInput): boolean {
  if (c.subject_type === "place_property") {
    const v = input.place[c.subject_code];
    if (v === null || v === undefined) return false;
    return compare(String(v), c.operator, c.value);
  }
  const fact = input.attributes[c.subject_code];
  if (!known(fact)) return false;
  return compare(fact.value, c.operator, c.value);
}

function minimumApplies(m: MinimumAttribute, place: EvaluationInput["place"]): boolean {
  if (m.required_when_property === null) return true;
  const v = place[m.required_when_property];
  return v !== null && v !== undefined && String(v) === m.required_when_value;
}

function fired(g: RuleGroup): FiredRule {
  return { rule_id: g.id, verdict: g.verdict, message_id: g.message_id };
}

export function evaluate(input: EvaluationInput): EvaluationResult {
  const groups = input.rules
    .filter((g) => g.profile_code === input.profile)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const lit = groups.filter((g) => g.conditions.length > 0 && g.conditions.every((c) => conditionHolds(c, input)));
  const blockers = lit.filter((g) => g.verdict === "blocker");
  const cautions = lit.filter((g) => g.verdict === "caution");

  const minimum = input.minimum
    .filter((m) => m.profile_code === input.profile && minimumApplies(m, input.place))
    .map((m) => m.attribute_code);
  const unknown = minimum.filter((code) => !known(input.attributes[code]));

  // Catatan kesegaran untuk atribut basi yang ikut menentukan: himpunan minimum
  // yang berlaku, ditambah atribut di grup yang menyala.
  const menentukan = new Set([
    ...minimum,
    ...lit.flatMap((g) => g.conditions.filter((c) => c.subject_type === "attribute").map((c) => c.subject_code)),
  ]);
  const freshness: FreshnessNote[] = [...menentukan]
    .filter((code) => {
      const f = input.attributes[code];
      return known(f) && f.status === "perlu_ditinjau_ulang";
    })
    .map((code) => ({ attribute_code: code, last_verified_at: input.attributes[code]!.last_verified_at }));

  if (blockers.length > 0) return { verdict: "tidak_dapat_diakses", notes: lit.map(fired), unknown, freshness };
  if (unknown.length > 0) return { verdict: "belum_dapat_dipastikan", notes: cautions.map(fired), unknown, freshness };
  if (cautions.length > 0) return { verdict: "dengan_catatan", notes: cautions.map(fired), unknown, freshness };
  return { verdict: "dapat_diakses", notes: [], unknown, freshness };
}
