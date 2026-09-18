/**
 * Bentuk data yang DIHARAPKAN antarmuka dari E1–E8 (00-KONTRAK §8, spek 10 dan 20).
 *
 * Kontrak menyebut ISI tiap respons tapi tidak menyebut NAMA kolomnya. Nama di
 * sini adalah usulan product engineer, mengikuti nama kolom tabel di spek 10/20.
 * Kalau pemilik endpoint memakai nama lain, yang diubah cukup normalisasi di
 * `server.ts` / `client.ts` — komponen tidak ikut berubah.
 */

// ── Kosakata tertutup (00-KONTRAK §3–6) ─────────────────────────────────────

export const PROFILES = ["kursi_roda_manual", "alat_bantu_jalan", "netra"] as const;
export type ProfileCode = (typeof PROFILES)[number];

export const VERDICTS = [
  "tidak_dapat_diakses",
  "dengan_catatan",
  "dapat_diakses",
  "belum_dapat_dipastikan",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export type AttributeStatus = "belum_terverifikasi" | "terverifikasi" | "perlu_ditinjau_ulang";

export const VANTAGES = ["entrance", "interior", "toilet"] as const;
export type Vantage = (typeof VANTAGES)[number];

export type AttributeCode =
  | "step_count"
  | "ramp_wheelchair"
  | "kerb"
  | "door_width_band"
  | "surface_condition"
  | "tactile_paving"
  | "elevator_status"
  | "toilets_wheelchair";

export const NOT_VISIBLE = "not_visible";

export type ReasonCode =
  | "CAPTURE_SESSION_INVALID"
  | "RATE_LIMITED"
  | "FILE_METADATA_PRESENT"
  | "TIMESTAMP_SKEW"
  | "GEO_MISSING"
  | "GEO_ACCURACY_LOW"
  | "GEO_FIX_STALE"
  | "GEO_TOO_FAR"
  | "DUPLICATE_IMAGE";

export type CheckResult = "pass" | "flag" | "fail";

export function isProfile(v: unknown): v is ProfileCode {
  return typeof v === "string" && (PROFILES as readonly string[]).includes(v);
}
export function isVantage(v: unknown): v is Vantage {
  return typeof v === "string" && (VANTAGES as readonly string[]).includes(v);
}

// ── Galat seragam (00-KONTRAK §6) ───────────────────────────────────────────

export interface ApiErrorBody {
  code: string;
  message: string;
  /** wajib untuk GEO_TOO_FAR, TIMESTAMP_SKEW, DUPLICATE_IMAGE, GEO_ACCURACY_LOW */
  measured: string | null;
  threshold: string | null;
}

// ── E1 GET /api/places?profile= ─────────────────────────────────────────────

export interface FreshnessNote {
  attribute_code: string;
  last_verified_at: string | null;
  next_review_at?: string | null;
}

export interface PlaceSummary {
  id: string;
  name: string;
  category: string | null;
  lat: number;
  lon: number;
  source: "osm_seed" | "manual";
  verdict: Verdict;
  status_counts: Record<AttributeStatus, number>;
  unknown_attributes: string[];
  freshness_notes: FreshnessNote[];
  is_demo_seed: boolean;
}

// ── E2 GET /api/places/{id}?profile= ────────────────────────────────────────

/** Satu catatan dari aturan profil yang menyala. `message` kalimat untuk manusia. */
export interface VerdictNote {
  rule_id: string;
  verdict: "blocker" | "caution";
  message: string;
}

export interface AttributeDetail {
  code: string;
  label: string;
  current_value: string | null;
  status: AttributeStatus;
  is_disputed: boolean;
  previous_value: string | null;
  previous_observed_at: string | null;
  corroboration_count: number;
  last_verified_at: string | null;
  next_review_at: string | null;
  source: "osm_seed" | "contribution" | null;
  photo_url: string | null;
  photo_alt: string | null;
  is_demo_seed: boolean;
  audit_url: string;
}

export interface PlaceDetail {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number;
  lon: number;
  source: "osm_seed" | "manual";
  profile: ProfileCode;
  verdict: Verdict;
  notes: VerdictNote[];
  unknown_attributes: string[];
  freshness_notes: FreshnessNote[];
  attributes: AttributeDetail[];
  is_demo_seed: boolean;
}

// ── E3 GET /api/places/{id}/attributes/{code}/audit ─────────────────────────

export interface CheckOutcome {
  code: string;
  result: CheckResult;
  measured: string | null;
  threshold: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  /** evidence_submitted · provenance_failed · observation_confirmed · state_updated · rate_limit_reset */
  action: string;
  /** "Kontributor #7" atau "system" */
  actor: string;
  checks: CheckOutcome[];
  before: string | null;
  after: string | null;
  ai_suggested_value?: string | null;
  confirmed_value?: string | null;
  evidence?: {
    id: string;
    photo_url: string | null;
    distance_to_place_m: number | null;
    client_accuracy_m: number | null;
    captured_at: string | null;
    capture_method: string | null;
  } | null;
  is_demo_seed: boolean;
}

export interface AuditTrail {
  place: { id: string; name: string };
  attribute: { code: string; label: string };
  entries: AuditEntry[];
  /** tag OSM berupa penilaian, misal { wheelchair: "yes" } */
  third_party_claims: Record<string, string> | null;
  is_demo_seed: boolean;
}

// ── E6 GET /api/profiles ────────────────────────────────────────────────────

export interface RuleCondition {
  subject_type: "attribute" | "place_property";
  subject_code: string;
  operator: "eq" | "neq" | "gte" | "lte" | "in" | "not_in";
  value: string;
}

export interface RuleGroup {
  id: string;
  verdict: "blocker" | "caution";
  message: string;
  conditions: RuleCondition[];
}

export interface MinimumAttribute {
  attribute_code: string;
  required_when_property: string | null;
  required_when_value: string | null;
}

export interface ProfileInfo {
  code: ProfileCode;
  label: string;
  rule_groups: RuleGroup[];
  minimum_attributes: MinimumAttribute[];
}

// ── E7 / E8 ─────────────────────────────────────────────────────────────────

export interface SessionInfo {
  contributor_id: string;
  display_handle: string;
}

export interface Claimable {
  attribute_code: string;
  required: boolean;
  /** Untuk enum sudah memuat not_visible; null untuk integer (pakai min/max). */
  allowed_values?: string[] | null;
  value_type?: "integer" | "enum";
  min_value?: number | null;
  max_value?: number | null;
}

export interface CaptureSession {
  token: string;
  expires_at: string;
  claimable: Claimable[];
}

// ── E4 POST /api/contributions/draft ────────────────────────────────────────

export interface Suggestion {
  attribute_code: string;
  /** boleh `not_visible` — diteruskan apa adanya */
  value: string | null;
  /** false = usulan dimatikan untuk atribut ini (gerbang precision) */
  active: boolean;
}

export interface DraftAccepted {
  draft_id: string;
  checks: CheckOutcome[];
  suggestions: Suggestion[];
  claimable: Claimable[];
  /** Usulan: supaya antarmuka bisa membedakan "model gagal/timeout" dari
   *  "tidak ada usulan". Belum ada di kontrak; kalau tidak dikirim, antarmuka
   *  menyimpulkan dari `suggestions` yang kosong. */
  model_status?: "ok" | "off" | "failed" | "timeout";
}

export type DraftResult =
  | { kind: "accepted"; draft: DraftAccepted }
  | { kind: "rejected"; errors: ApiErrorBody[] }
  | { kind: "error"; status: number; error: ApiErrorBody | null };

// ── E5 POST /api/contributions/{draftId}/confirm ────────────────────────────

export interface ConfirmItem {
  attribute_code: string;
  confirmed_value: string;
}

export interface StateChange {
  attribute_code: string;
  label?: string;
  before: { current_value: string | null; is_disputed?: boolean } | null;
  /** null bila atributnya tidak membentuk state (E5 Trust: StateSnapshot | null). */
  after: { current_value: string | null; is_disputed: boolean; corroboration_count: number } | null;
}

export type ConfirmResult =
  | { kind: "saved"; changes: StateChange[] }
  | { kind: "error"; status: number; error: ApiErrorBody | null };
