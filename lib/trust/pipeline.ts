import type { PoolClient } from 'pg';
import { trustConfig, CAPTURE_MODE } from './config';
import { evaluateC7, type LatLon } from './geo';
import { evaluateC8, type PriorEvidence } from './phash';
import type { ProvenanceCheckResult, Vantage } from './types';

export interface PipelineInput {
  contributorId: string;
  claimedToken: string;
  placeId: string;
  vantage: Vantage;
  phash: string;
  exifPresent: boolean;
  exifGpsPresent: boolean;
  clientLat: number | null;
  clientLon: number | null;
  clientAccuracyM: number | null;
  clientFixAt: Date | null;
  clientCapturedAt: Date;
  serverReceivedAt: Date;
}

export interface PipelineOutput {
  checks: ProvenanceCheckResult[];
  /** Token yang benar-benar tervalidasi. NULL kalau C0 gagal. */
  verifiedToken: string | null;
  distanceM: number | null;
  matchedEvidenceId: string | null;
  hasFail: boolean;
}

const seconds = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 1000;

/**
 * JALANKAN SEMUA PEMERIKSAAN. JANGAN BERHENTI DI KEGAGALAN PERTAMA.
 *
 * Biayanya hampir nol, dan layar penolakan harus bisa menampilkan beberapa
 * alasan sekaligus. Kontributor yang memperbaiki satu hal lalu ditolak lagi
 * karena hal kedua akan berhenti mencoba.
 *
 * Yang dilewati kalau ada kegagalan hanya panggilan model — dan itu
 * diputuskan di rutenya, bukan di sini.
 *
 * Sebagian pemeriksaan TIDAK DIEVALUASI ketika bahannya tidak ada: C6, C6b,
 * dan C7 tidak punya apa pun untuk diukur kalau C5 gagal. Barisnya tidak
 * ditulis ke provenance_check, dan ketiadaannya di jejak audit adalah
 * informasi — bukan kelalaian. Menuliskannya sebagai 'fail' akan melanggar
 * aturan 6, karena tidak ada nilai terukur yang bisa ditampilkan.
 */
export async function runProvenancePipeline(
  c: PoolClient,
  input: PipelineInput,
): Promise<PipelineOutput> {
  const checks: ProvenanceCheckResult[] = [];

  // ---- C0 token sesi penangkapan ------------------------------------
  // Klaim token secara atomik. Sekali pakai berarti sekali pakai, termasuk
  // ketika pengirimannya akhirnya ditolak pemeriksaan lain — kalau tidak,
  // penyerang bisa mencoba berulang sampai lolos dengan token yang sama.
  const claimed = await c.query<{
    token: string; place_id: string; vantage: Vantage; issued_at: Date;
  }>(
    `UPDATE capture_session
        SET used_at = now()
      WHERE token = $1 AND used_at IS NULL
      RETURNING token, place_id, vantage, issued_at`,
    [input.claimedToken],
  );

  let verifiedToken: string | null = null;
  const session = claimed.rows[0];

  if (!session) {
    checks.push({
      code: 'C0', result: 'fail',
      measured: 'token tidak dikenal atau sudah dipakai',
      threshold: 'sekali pakai',
      reason: 'CAPTURE_SESSION_INVALID',
    });
  } else {
    const ageS = seconds(input.serverReceivedAt, session.issued_at);
    const placeMatch = session.place_id === input.placeId;
    const vantageMatch = session.vantage === input.vantage;
    const fresh = ageS <= trustConfig.captureTokenTtlS;

    if (fresh && placeMatch && vantageMatch) {
      verifiedToken = session.token;
      checks.push({
        code: 'C0', result: 'pass',
        measured: `${Math.round(ageS)} dtk`,
        threshold: `${trustConfig.captureTokenTtlS} dtk`,
        reason: null,
      });
    } else {
      checks.push({
        code: 'C0', result: 'fail',
        measured: !fresh
          ? `${Math.round(ageS)} dtk`
          : 'tempat/titik pandang tidak cocok dengan token',
        threshold: !fresh ? `${trustConfig.captureTokenTtlS} dtk` : 'harus cocok',
        reason: 'CAPTURE_SESSION_INVALID',
      });
    }
  }

  // ---- C1 rate limit -------------------------------------------------
  // Kontribusi yang DITOLAK tetap dihitung. Kalau tidak, rate limit tidak
  // menahan percobaan berulang sama sekali.
  // Jendelanya dimulai dari yang lebih baru antara satu jam lalu dan reset
  // terakhir yang TERCATAT di jejak audit. Reset tidak pernah menghapus baris
  // evidence — lihat app/api/contributions/reset-rate-limit/route.ts. Dengan
  // begitu jejak auditnya sendiri yang jadi sumber kebenaran batas laju, dan
  // setiap reset meninggalkan bekas permanen yang terbaca publik.
  const { rows: rl } = await c.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM evidence
      WHERE contributor_id = $1
        AND server_received_at > GREATEST(
              now() - interval '1 hour',
              COALESCE(
                (SELECT max(a.created_at) FROM audit_event a
                  WHERE a.action = 'rate_limit_reset'
                    AND a.entity_type = 'contributor'
                    AND a.entity_id = $1),
                to_timestamp(0)
              )
            )`,
    [input.contributorId],
  );
  const used = Number(rl[0].n);
  checks.push(
    used >= trustConfig.rateLimitPerHour
      ? {
          code: 'C1', result: 'fail',
          measured: `${used} kontribusi/jam`,
          threshold: `${trustConfig.rateLimitPerHour} kontribusi/jam`,
          reason: 'RATE_LIMITED',
        }
      : {
          code: 'C1', result: 'pass',
          measured: `${used} kontribusi/jam`,
          threshold: `${trustConfig.rateLimitPerHour} kontribusi/jam`,
          reason: null,
        },
  );

  // ---- C3 metadata berkas -------------------------------------------
  // CAPTURE_MODE dibekukan ke getusermedia, jadi aturannya "ada EXIF apa pun".
  // Kalau suatu saat pindah ke input capture, aturannya berubah jadi
  // exifGpsPresent DAN turun dari fail jadi flag. Itu perubahan kontrak.
  const exifTripped =
    CAPTURE_MODE === 'getusermedia' ? input.exifPresent : input.exifGpsPresent;
  checks.push({
    code: 'C3',
    result: exifTripped ? 'fail' : 'pass',
    measured: input.exifPresent
      ? `EXIF ada${input.exifGpsPresent ? ', termasuk tag GPS' : ''}`
      : 'tidak ada EXIF',
    threshold: 'tidak ada EXIF',
    reason: exifTripped ? 'FILE_METADATA_PRESENT' : null,
  });

  // ---- C4 selisih waktu ----------------------------------------------
  const skewS = seconds(input.serverReceivedAt, input.clientCapturedAt);
  const skewBad = skewS > trustConfig.skewMaxBehindS || skewS < -trustConfig.skewMaxAheadS;
  checks.push({
    code: 'C4',
    result: skewBad ? 'fail' : 'pass',
    measured: `${Math.round(skewS)} dtk`,
    threshold: `-${trustConfig.skewMaxAheadS} dtk s.d. ${trustConfig.skewMaxBehindS} dtk`,
    reason: skewBad ? 'TIMESTAMP_SKEW' : null,
  });

  // ---- C5 geolokasi tersedia -----------------------------------------
  const hasGeo = input.clientLat !== null && input.clientLon !== null;
  checks.push({
    code: 'C5',
    result: hasGeo ? 'pass' : 'fail',
    measured: hasGeo ? 'koordinat ada' : 'koordinat kosong',
    threshold: 'koordinat wajib ada',
    reason: hasGeo ? null : 'GEO_MISSING',
  });

  let distanceM: number | null = null;

  if (hasGeo) {
    // ---- C6 ketelitian geolokasi -------------------------------------
    const acc = input.clientAccuracyM;
    if (acc === null) {
      checks.push({
        code: 'C6', result: 'fail',
        measured: 'ketelitian tidak dilaporkan',
        threshold: `${trustConfig.geoMaxAccuracyM} m`,
        reason: 'GEO_ACCURACY_LOW',
      });
    } else {
      const accBad = acc > trustConfig.geoMaxAccuracyM;
      checks.push({
        code: 'C6',
        result: accBad ? 'fail' : 'pass',
        measured: `${acc} m`,
        threshold: `${trustConfig.geoMaxAccuracyM} m`,
        reason: accBad ? 'GEO_ACCURACY_LOW' : null,
      });
    }

    // ---- C6b umur fix geolokasi --------------------------------------
    if (input.clientFixAt !== null) {
      const fixAgeS = seconds(input.serverReceivedAt, input.clientFixAt);
      const stale = fixAgeS > trustConfig.geoMaxFixAgeS;
      checks.push({
        code: 'C6b',
        result: stale ? 'fail' : 'pass',
        measured: `${Math.round(fixAgeS)} dtk`,
        threshold: `${trustConfig.geoMaxFixAgeS} dtk`,
        reason: stale ? 'GEO_FIX_STALE' : null,
      });
    }

    // ---- C7 jarak ke tempat ------------------------------------------
    const { rows: pl } = await c.query<{ lat: string; lon: string }>(
      'SELECT lat, lon FROM place WHERE id = $1',
      [input.placeId],
    );
    if (pl[0] && acc !== null) {
      const place: LatLon = { lat: Number(pl[0].lat), lon: Number(pl[0].lon) };
      const client: LatLon = { lat: input.clientLat as number, lon: input.clientLon as number };
      const c7 = evaluateC7({ client, place, accuracyM: acc });
      distanceM = c7.distanceM;
      checks.push(c7.check);
    }
  }

  // ---- C8 berkas berulang ---------------------------------------------
  // Selalu dijalankan: bahannya cuma berkas, dan justru inilah pemeriksaan
  // yang paling sering salah dipahami sebagai fail padahal seharusnya flag.
  const { rows: priors } = await c.query<{
    evidence_id: string; phash: string; place_id: string;
    vantage: Vantage; contributor_id: string;
  }>(
    'SELECT evidence_id, phash, place_id, vantage, contributor_id FROM trust_phash_candidates($1, $2)',
    [input.phash, trustConfig.phashSimilarMax],
  );

  const c8 = evaluateC8(
    input.phash,
    priors.map<PriorEvidence>((p) => ({
      evidenceId: p.evidence_id,
      phash: p.phash,
      placeId: p.place_id,
      vantage: p.vantage,
      contributorId: p.contributor_id,
    })),
    {
      placeId: input.placeId,
      vantage: input.vantage,
      contributorId: input.contributorId,
    },
  );
  checks.push(c8.check);

  return {
    checks,
    verifiedToken,
    distanceM,
    matchedEvidenceId: c8.matchedEvidenceId,
    hasFail: checks.some((k) => k.result === 'fail'),
  };
}
