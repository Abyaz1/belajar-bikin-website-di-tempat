/**
 * Konfigurasi terpusat jalur Verification — 00-KONTRAK §7, CLAUDE.md §8.
 * Tidak ada angka ambang ditulis langsung di dalam fungsi. Nilai default di
 * sini adalah nilai kontrak; pola sama dengan lib/trust/config.ts.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Konfigurasi ${name} bukan angka yang sah: ${JSON.stringify(raw)}`);
  return parsed;
}

export const verificationConfig = {
  /** Timeout panggilan model, tanpa retry. */
  vertexTimeoutMs: num("VERTEX_TIMEOUT_MS", 8_000),
  /** Gerbang precision per atribut untuk mengaktifkan usulan. */
  precisionGate: num("SUGGESTION_PRECISION_GATE", 0.85),
  /** Sisi terpanjang tangkapan — citra uji precision diperkecil ke ukuran ini, seperti kamera produksi. */
  captureMaxEdgePx: num("CAPTURE_MAX_EDGE_PX", 1_600),
} as const;

if (verificationConfig.precisionGate <= 0 || verificationConfig.precisionGate > 1)
  throw new Error(`SUGGESTION_PRECISION_GATE harus di antara 0 dan 1, bukan ${verificationConfig.precisionGate}.`);
