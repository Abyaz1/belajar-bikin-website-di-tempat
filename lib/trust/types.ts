export type CheckCode = 'C0' | 'C1' | 'C3' | 'C4' | 'C5' | 'C6' | 'C6b' | 'C7' | 'C8';
export type CheckOutcome = 'pass' | 'flag' | 'fail';
export type Vantage = 'entrance' | 'interior' | 'toilet';

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
