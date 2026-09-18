import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withTx } from '@/lib/trust/db';
import { trustConfig } from '@/lib/trust/config';
import { writeAudit } from '@/lib/trust/audit';
import { BadRequest, REASON_MESSAGE, badRequest, jsonError } from '@/lib/trust/errors';
import { isJpeg, scanJpegMetadata } from '@/lib/trust/exif';
import { computePhash } from '@/lib/trust/image';
import { runProvenancePipeline } from '@/lib/trust/pipeline';
import { SESSION_COOKIE, verifySession } from '@/lib/trust/session';
import { putOriginal } from '@/lib/trust/storage';
import type { Vantage } from '@/lib/trust/types';
import { loadSuggestionPort } from '@/lib/trust/verification-port';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VANTAGES: readonly Vantage[] = ['entrance', 'interior', 'toilet'];

function str(f: FormData, k: string): string {
  const v = f.get(k);
  if (typeof v !== 'string' || v.trim() === '') {
    throw badRequest('FIELD_REQUIRED', `Kolom ${k} wajib diisi`);
  }
  return v.trim();
}

function optNum(f: FormData, k: string): number | null {
  const v = f.get(k);
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw badRequest('FIELD_INVALID', `Kolom ${k} bukan angka`);
  return n;
}

function optDate(f: FormData, k: string): Date | null {
  const v = f.get(k);
  if (typeof v !== 'string' || v.trim() === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw badRequest('FIELD_INVALID', `Kolom ${k} bukan waktu ISO-8601`);
  }
  return d;
}

/**
 * E4 — draft kontribusi. Seluruh pipa provenans C0–C8 lewat sini.
 *
 * Yang dijamin rute ini: TIDAK ADA APA PUN tersimpan sebagai atribut.
 * observation dan attribute_state tidak disentuh — hanya E5 yang boleh.
 *
 * Yang tetap ditulis walau ditolak: evidence, provenance_check, dan
 * audit_event provenance_failed. Itu aturan 4, dan itu juga yang membuat
 * panel uji penolakan punya isi.
 */
export async function POST(req: Request) {
  const serverReceivedAt = new Date();

  try {
    const jar = await cookies();
    const contributorId = verifySession(jar.get(SESSION_COOKIE)?.value);
    if (!contributorId) {
      throw badRequest('SESSION_REQUIRED', 'Mulai sesi dulu sebelum mengirim kontribusi');
    }

    const form = await req.formData().catch(() => {
      throw badRequest('BODY_INVALID', 'Isi permintaan bukan multipart yang sah');
    });

    // --- bentuk permintaan: 400, BUKAN 422 ---------------------------
    // Permintaan yang cacat bentuknya bukan kontribusi yang ditolak. Dia
    // tidak pernah jadi bukti, jadi tidak masuk jejak audit provenans.
    // Ketiadaan koordinat adalah pengecualian: itu urusan C5, bukan bentuk.
    const file = form.get('file');
    if (!(file instanceof Blob)) throw badRequest('FILE_REQUIRED', 'Berkas foto wajib dikirim');
    if (file.size > trustConfig.uploadMaxBytes) {
      throw badRequest(
        'FILE_TOO_LARGE',
        `Ukuran berkas melebihi ${Math.round(trustConfig.uploadMaxBytes / 1024 / 1024)} MB`,
      );
    }

    const claimedToken = str(form, 'capture_token');
    const placeId = str(form, 'place_id');
    const vantage = VANTAGES.find((v) => v === form.get('vantage'));
    if (!vantage) throw badRequest('VANTAGE_INVALID', 'vantage tidak dikenal');

    const captureMethod = str(form, 'capture_method');
    const clientCapturedAt = optDate(form, 'client_captured_at');
    if (!clientCapturedAt) {
      throw badRequest('FIELD_REQUIRED', 'Kolom client_captured_at wajib diisi');
    }

    const clientLat = optNum(form, 'client_lat');
    const clientLon = optNum(form, 'client_lon');
    const clientAccuracyM = optNum(form, 'client_accuracy_m');
    const clientFixAt = optDate(form, 'client_fix_at');

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!isJpeg(bytes)) {
      throw badRequest('FILE_TYPE_INVALID', 'Berkas harus JPEG dari layar kamera aplikasi');
    }

    // --- bahan pemeriksaan, dihitung sebelum transaksi ----------------
    const meta = scanJpegMetadata(bytes);
    const phash = await computePhash(bytes);
    const storagePath = await putOriginal(bytes, placeId);

    // --- transaksi: pipa, evidence, provenance_check, audit -----------
    const outcome = await withTx(async (c) => {
      const place = await c.query('SELECT id FROM place WHERE id = $1', [placeId]);
      if (place.rowCount === 0) throw badRequest('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');

      const contributor = await c.query<{ display_handle: string }>(
        'SELECT display_handle FROM contributor WHERE id = $1',
        [contributorId],
      );
      if (contributor.rowCount === 0) {
        throw badRequest('SESSION_REQUIRED', 'Sesi tidak dikenal. Mulai sesi baru');
      }
      const actor = contributor.rows[0].display_handle;

      const pipe = await runProvenancePipeline(c, {
        contributorId,
        claimedToken,
        placeId,
        vantage,
        phash,
        exifPresent: meta.exifPresent,
        exifGpsPresent: meta.exifGpsPresent,
        clientLat,
        clientLon,
        clientAccuracyM,
        clientFixAt,
        clientCapturedAt,
        serverReceivedAt,
      });

      const { rows: ev } = await c.query<{ id: string }>(
        `INSERT INTO evidence (
           place_id, vantage, contributor_id,
           claimed_capture_token, capture_session_token,
           storage_path, phash,
           client_lat, client_lon, client_accuracy_m,
           client_fix_at, client_captured_at, server_received_at,
           distance_to_place_m, exif_present, exif_gps_present, capture_method
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [
          placeId, vantage, contributorId,
          claimedToken, pipe.verifiedToken,
          storagePath, phash,
          clientLat, clientLon, clientAccuracyM,
          clientFixAt, clientCapturedAt, serverReceivedAt,
          pipe.distanceM, meta.exifPresent, meta.exifGpsPresent, captureMethod,
        ],
      );
      const draftId = ev[0].id;

      for (const k of pipe.checks) {
        await c.query(
          `INSERT INTO provenance_check (evidence_id, check_code, result, measured, threshold)
           VALUES ($1,$2,$3,$4,$5)`,
          [draftId, k.code, k.result, k.measured, k.threshold],
        );
      }

      await writeAudit(c, {
        entityType: 'evidence',
        entityId: draftId,
        action: 'evidence_submitted',
        actor,
        before: null,
        after: {
          place_id: placeId,
          vantage,
          phash,
          distance_to_place_m: pipe.distanceM,
          capture_method: captureMethod,   // dicatat, bukan diperiksa
          checks: pipe.checks.map((k) => ({ code: k.code, result: k.result })),
        },
      });

      if (pipe.hasFail) {
        await writeAudit(c, {
          entityType: 'evidence',
          entityId: draftId,
          action: 'provenance_failed',
          actor,
          before: null,
          after: {
            reasons: pipe.checks.filter((k) => k.reason).map((k) => ({
              code: k.reason, measured: k.measured, threshold: k.threshold,
            })),
            matched_evidence_id: pipe.matchedEvidenceId,
          },
        });
      }

      // Kolom mengikuti tabel attribute_type milik Verification.
      // ai_suggestable adalah gerbang precision per atribut: dimatikan lewat
      // UPDATE saat gerbang jam 21:00, tanpa deploy ulang.
      const { rows: claimable } = await c.query<{
        code: string; is_required_at_vantage: boolean; allowed_values: string[];
        value_type: 'integer' | 'enum'; ai_suggestable: boolean;
      }>(
        `SELECT code, is_required_at_vantage, allowed_values, value_type, ai_suggestable
           FROM attribute_type WHERE vantage = $1 ORDER BY code`,
        [vantage],
      );

      return { draftId, pipe, claimable };
    });

    // --- 422: SEMUA alasan sekaligus, model tidak dipanggil -----------
    if (outcome.pipe.hasFail) {
      return jsonError(
        422,
        outcome.pipe.checks
          .filter((k) => k.result === 'fail' && k.reason !== null)
          .map((k) => ({
            code: k.reason as string,
            message: REASON_MESSAGE[k.reason as NonNullable<typeof k.reason>],
            measured: k.measured,
            threshold: k.threshold,
          })),
      );
    }

    // --- 200: baru di sini model dipanggil ----------------------------
    const enabled = outcome.claimable.filter((a) => a.ai_suggestable);
    const port = await loadSuggestionPort();
    const raw = enabled.length
      ? await port
          .suggest({
            imageBytes: bytes,
            vantage,
            attributeCodes: enabled.map((a) => a.code),
            timeoutMs: Number(process.env.VERTEX_TIMEOUT_MS ?? 8000),
          })
          .catch(() => [])   // 8 detik, tanpa retry. Gagal = alur manual.
      : [];

    // Simpan usulan model apa adanya, termasuk confidence-nya, supaya E5
    // tidak perlu mempercayai klien soal apa yang diusulkan.
    // Transaksi terpisah: panggilan model ada di luar transaksi utama supaya
    // 8 detik timeout-nya tidak menahan kunci baris apa pun.
    if (raw.length > 0) {
      await withTx(async (c) => {
        for (const s of raw) {
          await c.query(
            `INSERT INTO draft_suggestion
               (evidence_id, attribute_code, ai_suggested_value, ai_confidence)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (evidence_id, attribute_code) DO NOTHING`,
            [outcome.draftId, s.attribute_code, s.value, s.confidence],
          );
        }
      });
    }

    /*
     * ATURAN 5 DITEGAKKAN DI SINI.
     * raw[] membawa confidence. Yang keluar dari fungsi ini TIDAK.
     * Jangan pernah mengganti map() di bawah dengan spread objek raw.
     * confidence-nya dipakai E5 untuk mengisi observation.ai_confidence,
     * lewat draft_suggestion yang dibaca ulang dari server — bukan lewat klien.
     */
    const suggestions = outcome.claimable.map((a) => {
      const hit = raw.find((s) => s.attribute_code === a.code);
      return {
        attribute_code: a.code,
        value: hit?.value ?? null,
        active: a.ai_suggestable && hit !== undefined,
      };
    });

    return NextResponse.json({
      draft_id: outcome.draftId,
      checks: outcome.pipe.checks.map((k) => ({
        code: k.code,
        result: k.result,
        measured: k.measured,
        threshold: k.threshold,
      })),
      suggestions,
      claimable: outcome.claimable.map((a) => ({
        attribute_code: a.code,
        required: a.is_required_at_vantage,
        value_type: a.value_type,
        allowed_values: [...a.allowed_values, 'not_visible'],
      })),
    });
  } catch (err) {
    if (err instanceof BadRequest) {
      return NextResponse.json({ errors: [err.body] }, { status: 400 });
    }
    throw err;
  }
}
