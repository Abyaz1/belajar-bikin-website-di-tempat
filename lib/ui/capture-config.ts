/**
 * Batas tangkapan kamera — 00-KONTRAK §7, CLAUDE.md §8. Dibaca di server
 * (halaman) dari env, lalu diteruskan ke komponen kamera sebagai props: env
 * tanpa awalan NEXT_PUBLIC_ tidak sampai ke peramban. Nilai bawaan = kontrak.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Konfigurasi ${name} bukan angka positif: ${JSON.stringify(raw)}`);
  return parsed;
}

export interface CaptureLimits {
  /** Sisi terpanjang berkas yang dikirim. */
  maxEdgePx: number;
  /** Ukuran unggahan maksimum. */
  uploadMaxBytes: number;
}

export function captureLimits(): CaptureLimits {
  return {
    maxEdgePx: num("CAPTURE_MAX_EDGE_PX", 1600),
    uploadMaxBytes: num("UPLOAD_MAX_BYTES", 5 * 1024 * 1024),
  };
}
