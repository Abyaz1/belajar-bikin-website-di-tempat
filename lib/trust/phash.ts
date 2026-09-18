import { trustConfig } from './config';
import type { ProvenanceCheckResult, Vantage } from './types';

/** Jumlah bit menyala per nibble. Tabel 16 entri, tanpa BigInt. */
const NIBBLE_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const;

const HEX_LEN = trustConfig.phashBits / 4;
const HEX_RE = new RegExp(`^[0-9a-f]{${HEX_LEN}}$`);

/** Bentuk simpan pHash: hex huruf kecil, panjang tetap. Sama dengan CHECK di DDL. */
export function normalizePhash(hex: string): string {
  const v = hex.trim().toLowerCase();
  if (!HEX_RE.test(v)) {
    throw new RangeError(
      `pHash harus ${HEX_LEN} digit hex (${trustConfig.phashBits} bit), dapat: ${JSON.stringify(hex)}`,
    );
  }
  return v;
}

/**
 * Hamming distance dua pHash hex.
 *
 * Dua gambar yang mirip menghasilkan hash yang berdekatan, jadi jaraknya
 * kecil. Yang TIDAK berlaku sebaliknya: jarak kecil tidak membuktikan
 * gambarnya sama. Itu sebabnya C8 tidak pernah berdiri sendiri sebagai
 * bukti kecurangan, dan kenapa ambangnya bergantung konteks.
 */
export function hammingDistance(aHex: string, bHex: string): number {
  const a = normalizePhash(aHex);
  const b = normalizePhash(bHex);

  let distance = 0;
  for (let i = 0; i < HEX_LEN; i += 1) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += NIBBLE_POPCOUNT[x];
  }
  return distance;
}

/** Satu bukti lama yang dibandingkan dengan unggahan sekarang. */
export interface PriorEvidence {
  evidenceId: string;
  phash: string;
  placeId: string;
  vantage: Vantage;
  contributorId: string;
}

export interface C8Context {
  placeId: string;
  vantage: Vantage;
  contributorId: string;
}

export type DuplicateVerdict = 'fail' | 'flag' | 'none';

/**
 * Matriks docs/10-trust.md §2.2.
 *
 * | konteks                                   | ≤ 2  | 3–6  |
 * | kontributor sama, tempat sama             | fail | fail |
 * | kontributor beda, tempat + vantage sama   | fail | FLAG |
 * | tempat berbeda                            | fail | fail |
 *
 * Satu-satunya kotak yang bukan fail adalah penguatan: dua orang berbeda
 * memotret pintu yang sama. Itu justru yang kita mau, dan itu juga yang
 * terjadi kalau juri ikut berkontribusi di atas panggung. Ambang tunggal
 * akan membalik pesan demo kita.
 */
export function classifyDuplicate(
  hamming: number,
  prior: PriorEvidence,
  ctx: C8Context,
): DuplicateVerdict {
  if (hamming <= trustConfig.phashIdenticalMax) return 'fail';
  if (hamming > trustConfig.phashSimilarMax) return 'none';

  const samePlace = prior.placeId === ctx.placeId;
  const sameVantage = prior.vantage === ctx.vantage;
  const sameContributor = prior.contributorId === ctx.contributorId;

  if (samePlace && sameVantage && !sameContributor) return 'flag';
  return 'fail';
}

export interface C8Output {
  check: ProvenanceCheckResult;
  /** Untuk payload_snapshot audit_event. Null kalau tidak ada kecocokan. */
  matchedEvidenceId: string | null;
  matchedHamming: number | null;
  verdict: DuplicateVerdict;
}

/**
 * C8 — berkas berulang.
 *
 * `priors` diambil dari SQL (trust_phash_candidates), sudah disaring ke
 * hamming ≤ PHASH_SIMILAR_MAX pada SELURUH tabel evidence — bukan hanya
 * tempat yang sama, karena baris "tempat berbeda" pada matriks juga fail.
 *
 * Kecocokan terkuat yang menang: fail mengalahkan flag, dan di antara
 * sesama fail, jarak terkecil yang dilaporkan.
 */
export function evaluateC8(
  candidatePhash: string,
  priors: readonly PriorEvidence[],
  ctx: C8Context,
): C8Output {
  const phash = normalizePhash(candidatePhash);

  let best: { verdict: DuplicateVerdict; hamming: number; evidenceId: string } | null = null;
  const rank: Record<DuplicateVerdict, number> = { fail: 2, flag: 1, none: 0 };

  for (const prior of priors) {
    const hamming = hammingDistance(phash, prior.phash);
    const verdict = classifyDuplicate(hamming, prior, ctx);
    if (verdict === 'none') continue;

    const better =
      best === null ||
      rank[verdict] > rank[best.verdict] ||
      (rank[verdict] === rank[best.verdict] && hamming < best.hamming);

    if (better) best = { verdict, hamming, evidenceId: prior.evidenceId };
  }

  if (best === null) {
    return {
      verdict: 'none',
      matchedEvidenceId: null,
      matchedHamming: null,
      check: {
        code: 'C8',
        result: 'pass',
        measured: null,
        threshold: `${trustConfig.phashSimilarMax}`,
        reason: null,
      },
    };
  }

  // Ambang yang dilanggar, bukan ambang umum — supaya layar penolakan
  // menyebut angka yang benar-benar menentukan keputusan.
  const threshold =
    best.hamming <= trustConfig.phashIdenticalMax
      ? trustConfig.phashIdenticalMax
      : trustConfig.phashSimilarMax;

  return {
    verdict: best.verdict,
    matchedEvidenceId: best.evidenceId,
    matchedHamming: best.hamming,
    check: {
      code: 'C8',
      result: best.verdict === 'fail' ? 'fail' : 'flag',
      measured: `hamming ${best.hamming}`,
      threshold: `hamming ${threshold}`,
      reason: best.verdict === 'fail' ? 'DUPLICATE_IMAGE' : null,
    },
  };
}
