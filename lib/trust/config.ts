/**
 * Konfigurasi terpusat — docs/00-KONTRAK.md §7.
 * TIDAK ADA satu pun angka ambang boleh ditulis langsung di dalam fungsi.
 * Nilai default di sini adalah nilai kontrak yang dibekukan jam 10:00.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Konfigurasi ${name} bukan angka yang sah: ${JSON.stringify(raw)}`);
  }
  return parsed;
}

export const trustConfig = {
  /** C1 — kontribusi per kontributor per jam. Yang ditolak tetap dihitung. */
  rateLimitPerHour: num('RATE_LIMIT_PER_HOUR', 10),

  /** C4 — server_received_at − client_captured_at, dalam detik. */
  skewMaxBehindS: num('SKEW_MAX_BEHIND_S', 180),
  skewMaxAheadS: num('SKEW_MAX_AHEAD_S', 60),

  /** C6 / C6b */
  geoMaxAccuracyM: num('GEO_MAX_ACCURACY_M', 150),
  geoMaxFixAgeS: num('GEO_MAX_FIX_AGE_S', 60),

  /** C7 — radius_efektif = min(base + accuracy, fail) */
  geoBaseRadiusM: num('GEO_BASE_RADIUS_M', 75),
  geoFailRadiusM: num('GEO_FAIL_RADIUS_M', 120),

  /** C8 */
  phashBits: num('PHASH_BITS', 64),
  phashIdenticalMax: num('PHASH_IDENTICAL_MAX', 2),
  phashSimilarMax: num('PHASH_SIMILAR_MAX', 6),

  /** C0 */
  captureTokenTtlS: num('CAPTURE_TOKEN_TTL_S', 600),

  /** Unggahan */
  uploadMaxBytes: num('UPLOAD_MAX_BYTES', 5 * 1024 * 1024),
  captureMaxEdgePx: num('CAPTURE_MAX_EDGE_PX', 1600),
  displayMaxEdgePx: num('DISPLAY_MAX_EDGE_PX', 1200),
} as const;

/**
 * Mekanisme kamera dibekukan jam 10:00 ke `getusermedia`.
 * Konsekuensinya untuk C3: ADA EXIF APA PUN → fail.
 * Kalau suatu saat pindah ke input capture, C3 berubah jadi "ada tag GPS"
 * dan turun dari fail jadi flag — dan itu perubahan kontrak, bukan patch.
 */
export const CAPTURE_MODE = 'getusermedia' as const;

/** Pagar waras: kalau dua angka ini bertabrakan, C7 tidak punya arti. */
if (trustConfig.geoBaseRadiusM > trustConfig.geoFailRadiusM) {
  throw new Error(
    `GEO_BASE_RADIUS_M (${trustConfig.geoBaseRadiusM}) melebihi ` +
    `GEO_FAIL_RADIUS_M (${trustConfig.geoFailRadiusM}). Tidak akan pernah ada jalur pass.`
  );
}
if (trustConfig.phashIdenticalMax > trustConfig.phashSimilarMax) {
  throw new Error('PHASH_IDENTICAL_MAX tidak boleh melebihi PHASH_SIMILAR_MAX.');
}
