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
import { simpanFotoTayang } from '@/lib/trust/tayang';
import type { Vantage } from '@/lib/trust/types';
import { mintaUsulan } from '@/lib/trust/verification-port';

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
    // Seluruh kamus vantage dikirim, bukan hanya yang ai_suggestable, karena
    // penanda itu bagian dari masukan modul verifikasi — dia yang memutuskan
    // atribut mana yang ditanyakan ke model. Batas waktu 8 detik juga miliknya.
    // Foto tayang (wajah dikaburkan) dibuat BERSAMAAN dengan panggilan model,
    // supaya tidak menambah waktu tunggu kontributor. Hanya bukti yang lolos
    // semua pemeriksaan yang punya foto tayang; yang ditolak tidak pernah tampil.
    const [usulan, publicPath] = await Promise.all([
      mintaUsulan({
        image: bytes,
        mimeType: 'image/jpeg',
        vantage,
        attributes: outcome.claimable.map((a) => ({
          attribute_code: a.code,
          ai_suggestable: a.ai_suggestable,
          allowed_values: a.allowed_values,
        })),
      }),
      simpanFotoTayang(bytes, placeId),
    ]);
    if (publicPath) {
      // Satu-satunya kolom evidence yang boleh diubah (GRANT UPDATE (public_path)).
      await withTx((c) =>
        c.query('UPDATE evidence SET public_path = $1 WHERE id = $2 AND public_path IS NULL', [publicPath, outcome.draftId]),
      );
    }

    // Simpan usulan model apa adanya, termasuk confidence-nya, supaya E5
    // tidak perlu mempercayai klien soal apa yang diusulkan.
    // Transaksi terpisah: panggilan model ada di luar transaksi utama supaya
    // batas waktunya tidak menahan kunci baris apa pun.
    const berconfidence = usulan.suggestions.filter(
      (u) => u.value !== null && u.confidence !== null,
    );
    if (berconfidence.length > 0) {
      await withTx(async (c) => {
        for (const u of berconfidence) {
          await c.query(
            `INSERT INTO draft_suggestion
               (evidence_id, attribute_code, ai_suggested_value, ai_confidence)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (evidence_id, attribute_code) DO NOTHING`,
            [outcome.draftId, u.attribute_code, u.value, u.confidence],
          );
        }
      });
    }

    /*
     * ATURAN 5 DITEGAKKAN DI SINI.
     * usulan.suggestions membawa confidence. Yang keluar dari fungsi ini TIDAK.
     * Jangan pernah mengganti map() di bawah dengan spread objek usulan.
     * confidence-nya dipakai E5 untuk mengisi observation.ai_confidence,
     * lewat draft_suggestion yang dibaca ulang dari server — bukan lewat klien.
     *
     * Penegakan ini sengaja ada DI SINI dan tidak didelegasikan ke helper
     * publicSuggestions() milik modul verifikasi. Aturan yang menjaga kita
     * tidak boleh bergantung pada modul lain tetap benar.
     */
    const bolehUsul = new Map(outcome.claimable.map((a) => [a.code, a.ai_suggestable]));
    const suggestions = outcome.claimable.map((a) => {
      const hit = usulan.suggestions.find((u) => u.attribute_code === a.code);
      return {
        attribute_code: a.code,
        value: hit?.value ?? null,
        // Gerbang precision dijaga dua kali: modul verifikasi menghitungnya, dan
        // di sini dicocokkan ulang dengan tabel. Atribut yang usulannya dimatikan
        // tidak boleh aktif karena bug di sisi mana pun.
        active: (hit?.active ?? false) && bolehUsul.get(a.code) === true,
      };
    });

    return NextResponse.json({
      draft_id: outcome.draftId,
      /** Membedakan "model bilang tidak ada yang terlihat" dari "model tidak
       *  pernah menjawab". Tanpa ini antarmuka hanya melihat daftar kosong dan
       *  tidak bisa menjelaskan sebabnya ke kontributor. */
      model_status: usulan.status,
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
