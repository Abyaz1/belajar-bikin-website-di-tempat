export type CheckCode = 'C0' | 'C1' | 'C3' | 'C4' | 'C5' | 'C6' | 'C6b' | 'C7' | 'C8';
export type CheckOutcome = 'pass' | 'flag' | 'fail';
export type Vantage = 'entrance' | 'interior' | 'toilet';

export const VANTAGES: readonly Vantage[] = ['entrance', 'interior', 'toilet'];
export const NOT_VISIBLE = 'not_visible';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseVantage(value: unknown): Vantage | null {
  return VANTAGES.find((v) => v === value) ?? null;
}

export interface ClaimableAttributeRow {
  code: string;
  value_type: 'integer' | 'enum';
  allowed_values: string[];
  is_required_at_vantage: boolean;
  ai_suggestable?: boolean;
}

export function formatClaimableAttributes(rows: readonly ClaimableAttributeRow[]) {
  return rows.map((a) => ({
    attribute_code: a.code,
    required: a.is_required_at_vantage,
    value_type: a.value_type,
    // 'not_visible' sah untuk atribut mana pun dan tidak disimpan di tabel,
    // jadi ditambahkan di sini supaya klien bisa menampilkannya.
    allowed_values: [...a.allowed_values, NOT_VISIBLE],
  }));
}

export type ReasonCode =
  | 'CAPTURE_SESSION_INVALID'
  | 'RATE_LIMITED'
  | 'FILE_METADATA_PRESENT'
  | 'TIMESTAMP_SKEW'
  | 'GEO_MISSING'
  | 'GEO_ACCURACY_LOW'
  | 'GEO_FIX_STALE'
  | 'GEO_TOO_FAR'
  | 'DUPLICATE_IMAGE';

/** Satu baris provenance_check, plus kode alasan untuk membangun payload 422. */
export interface ProvenanceCheckResult {
  code: CheckCode;
  result: CheckOutcome;
  /** Nilai terukur. Wajib terisi untuk GEO_TOO_FAR, TIMESTAMP_SKEW,
   *  DUPLICATE_IMAGE, GEO_ACCURACY_LOW (docs/00-KONTRAK.md §6). */
  measured: string | null;
  threshold: string | null;
  /** Terisi hanya kalau result === 'fail'. */
  reason: ReasonCode | null;
}
