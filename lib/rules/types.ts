/**
 * Tipe rules engine — docs-20 §1–2. Kosakata bersama (profil, penilaian,
 * status) diambil dari lib/ui/api/types.ts supaya UI dan backend satu bahasa.
 */

import type { AttributeStatus, ProfileCode, Vantage, Verdict } from "@/lib/ui/api/types";

export type { AttributeStatus, ProfileCode, Vantage, Verdict };

export type RuleVerdict = "blocker" | "caution";
export type Operator = "eq" | "neq" | "gte" | "lte" | "in" | "not_in";

/** Baris `profile_rule_condition`. */
export interface RuleCondition {
  subject_type: "attribute" | "place_property";
  subject_code: string;
  operator: Operator;
  /** Selalu teks, seperti di tabel. `in`/`not_in` dipisah koma. */
  value: string;
}

/** Baris `profile_rule_group` beserta kondisinya. Menyala kalau SEMUA kondisi terpenuhi. */
export interface RuleGroup {
  id: string;
  profile_code: ProfileCode;
  verdict: RuleVerdict;
  message_id: string;
  priority: number;
  conditions: RuleCondition[];
}

/** Baris `profile_minimum_attribute`. */
export interface MinimumAttribute {
  profile_code: ProfileCode;
  attribute_code: string;
  required_when_property: string | null;
  required_when_value: string | null;
}

/** Baris `attribute_type` — isi persis 00-KONTRAK §3. */
export interface AttributeType {
  code: string;
  value_type: "integer" | "enum";
  allowed_values: string[];
  vantage: Vantage;
  is_required_at_vantage: boolean;
  review_interval_days: number;
  ai_suggestable: boolean;
  label_id: string;
}

/** Fakta satu atribut sebagaimana dibaca dari `attribute_state`, status sudah diturunkan. */
export interface AttributeFact {
  value: string | null;
  status: AttributeStatus;
  last_verified_at: string | null;
}

export interface EvaluationInput {
  profile: ProfileCode;
  /** Properti tempat yang boleh dirujuk aturan, misal `layanan_di_atas_lantai_dasar`. */
  place: Record<string, string | number | boolean | null | undefined>;
  /** Atribut yang tidak ada di peta ini diperlakukan `belum_terverifikasi`. */
  attributes: Record<string, AttributeFact | undefined>;
  rules: RuleGroup[];
  minimum: MinimumAttribute[];
}

export interface FreshnessNote {
  attribute_code: string;
  last_verified_at: string | null;
}

export interface FiredRule {
  rule_id: string;
  verdict: RuleVerdict;
  message_id: string;
}

export interface EvaluationResult {
  verdict: Verdict;
  /** Grup yang menyala, urut prioritas. Pada `belum_dapat_dipastikan` isinya caution saja. */
  notes: FiredRule[];
  /** Atribut minimum yang belum terverifikasi — "yang menentukan tapi belum diperiksa". */
  unknown: string[];
  /** Atribut perlu_ditinjau_ulang yang ikut menentukan penilaian ini. */
  freshness: FreshnessNote[];
}
