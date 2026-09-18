import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withTx } from '@/lib/trust/db';
import { writeAudit } from '@/lib/trust/audit';
import { BadRequest, REASON_MESSAGE, badRequest, jsonError } from '@/lib/trust/errors';
import { recomputeAttributeState, type StateChange } from '@/lib/trust/attribute-state';
import { SESSION_COOKIE, verifySession } from '@/lib/trust/session';
import type { ReasonCode, Vantage } from '@/lib/trust/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOT_VISIBLE = 'not_visible';

// Kolom mengikuti tabel attribute_type milik Verification. allowed_values di
// sana NOT NULL dan mencakup tipe integer juga ('0'..'20' untuk step_count),
// sehingga satu aturan keanggotaan cukup untuk kedua tipe.
interface AttributeRow {
  code: string;
  value_type: 'integer' | 'enum';
  allowed_values: string[];
  is_required_at_vantage: boolean;
}

/** Dibuang di sini supaya galat 409 tidak membocorkan draft milik orang lain. */
class Conflict extends Error {}

/**
 * E5 — konfirmasi kontribusi.
 *
 * Ini satu-satunya rute di seluruh sistem yang boleh menulis ke `observation`
 * dan `attribute_state`. Bukan konvensi — E4 memang tidak punya jalan ke sana,
 * dan itu disengaja.
 *
 * Penegakan konfirmasi wajib ada di langkah 3. Kalau ada yang mengusulkan
 * melonggarkannya demi kecepatan, tolak. Itu satu-satunya hal yang tidak boleh
 * dikompromikan: dia yang membuat kalimat "AI adalah asisten, bukan otoritas"
 * benar di level kode, bukan sekadar janji di deck.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ draftId: string }> },
) {
  try {
    const { draftId } = await ctx.params;

    const jar = await cookies();
    const contributorId = verifySession(jar.get(SESSION_COOKIE)?.value);
    if (!contributorId) {
      throw badRequest('SESSION_REQUIRED', 'Mulai sesi dulu sebelum mengonfirmasi');
    }

    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      throw badRequest(
        'BODY_INVALID',
        'Isi permintaan harus berupa daftar { attribute_code, confirmed_value }',
      );
    }

    const result = await withTx(async (c) => {
      // ---- kunci baris draft dulu -----------------------------------
      // Tanpa kunci, dua konfirmasi bersamaan sama-sama membaca status
      // "terbuka" sebelum salah satunya sempat menulis observation.
      const { rows: ev } = await c.query<{
        id: string; place_id: string; vantage: Vantage; contributor_id: string;
      }>(
        `SELECT id, place_id, vantage, contributor_id
           FROM evidence WHERE id = $1 FOR UPDATE`,
        [draftId],
      );

      // ---- 1. draft tidak ada atau sudah dikonfirmasi → 409 ---------
      // Draft milik kontributor lain diperlakukan sama dengan tidak ada.
      // Membedakan keduanya akan membocorkan bahwa draft itu memang wujud.
      if (!ev[0] || ev[0].contributor_id !== contributorId) throw new Conflict();

      const { rows: ds } = await c.query<{ status: string }>(
        'SELECT status FROM draft_state WHERE draft_id = $1',
        [draftId],
      );
      if (ds[0]?.status === 'dikonfirmasi') throw new Conflict();

      // ---- 2. draft berstatus ditolak → 422, selamanya --------------
      // Yang dikembalikan adalah alasan penolakan aslinya dari
      // provenance_check, bukan kode galat baru. Draft yang ditolak tetap
      // ditolak dengan alasan yang sama, berapa kali pun dicoba.
      if (ds[0]?.status === 'ditolak') {
        const { rows: fails } = await c.query<{
          check_code: string; measured: string | null; threshold: string | null;
        }>(
          `SELECT check_code, measured, threshold
             FROM provenance_check
            WHERE evidence_id = $1 AND result = 'fail'
            ORDER BY check_code`,
          [draftId],
        );
        return { rejected: fails };
      }

      const place_id = ev[0].place_id;
      const vantage = ev[0].vantage;

      // ---- kamus atribut untuk vantage ini --------------------------
      const { rows: allowed } = await c.query<AttributeRow>(
        `SELECT code, value_type, allowed_values, is_required_at_vantage
           FROM attribute_type WHERE vantage = $1 ORDER BY code`,
        [vantage],
      );
      const byCode = new Map(allowed.map((a) => [a.code, a]));

      // ---- 3. ada atribut tanpa confirmed_value → 400 ---------------
      // INI PENEGAKAN ATURAN 2. Nilai usulan AI tidak pernah menjadi nilai
      // berlaku dengan sendirinya: tidak ada jalur kode di sini yang bisa
      // mengisi confirmed_value dari ai_suggested_value.
      const submitted: Array<{ code: string; value: string }> = [];
      const seen = new Set<string>();

      for (const item of body) {
        if (typeof item !== 'object' || item === null) {
          throw badRequest('ENTRY_INVALID', 'Setiap entri harus berupa objek');
        }
        const rec = item as Record<string, unknown>;
        const code = typeof rec.attribute_code === 'string' ? rec.attribute_code : null;
        if (!code) throw badRequest('ATTRIBUTE_CODE_REQUIRED', 'attribute_code wajib diisi');

        const value = rec.confirmed_value;
        if (typeof value !== 'string' || value.trim() === '') {
          throw badRequest(
            'CONFIRMATION_REQUIRED',
            `Atribut ${code} dikirim tanpa nilai konfirmasi. ` +
            'Nilai usulan tidak berlaku sebelum dikonfirmasi kontributor',
          );
        }
        if (seen.has(code)) {
          throw badRequest('ATTRIBUTE_DUPLICATED', `Atribut ${code} dikirim lebih dari sekali`);
        }
        seen.add(code);
        submitted.push({ code, value: value.trim() });
      }

      // ---- 4. attribute_code di luar vantage-nya → 400 --------------
      // Foto pintu masuk tidak boleh mendasari klaim lift atau toilet.
      for (const s of submitted) {
        if (!byCode.has(s.code)) {
          throw badRequest(
            'ATTRIBUTE_NOT_IN_VANTAGE',
            `Atribut ${s.code} tidak bisa diklaim dari titik pandang ${vantage}`,
          );
        }
      }

      // ---- 5. atribut wajib tidak dikirim → 400 ---------------------
      for (const a of allowed) {
        if (a.is_required_at_vantage && !seen.has(a.code)) {
          throw badRequest(
            'REQUIRED_ATTRIBUTE_MISSING',
            `Atribut wajib ${a.code} belum diisi untuk titik pandang ${vantage}`,
          );
        }
      }

      // ---- 6. nilai di luar kosakata atribut → 400 ------------------
      for (const s of submitted) {
        const a = byCode.get(s.code) as AttributeRow;
        if (s.value === NOT_VISIBLE) continue;   // sah untuk atribut mana pun

        // Satu aturan untuk kedua tipe: nilai harus ada di kosakata atribut.
        // Rentang integer tidak lagi diperiksa dengan min/max karena kosakata
        // integer pun tersimpan utuh sebagai daftar nilai yang sah.
        if (!a.allowed_values.includes(s.value)) {
          const pilihan =
            a.value_type === 'integer' && a.allowed_values.length > 2
              ? `${a.allowed_values[0]}..${a.allowed_values[a.allowed_values.length - 1]}`
              : a.allowed_values.join(', ');
          throw badRequest(
            'VALUE_NOT_IN_VOCABULARY',
            `Nilai "${s.value}" tidak sah untuk ${s.code}. Pilihan: ${pilihan}, ${NOT_VISIBLE}`,
          );
        }
      }

      // ---- tulis observation ----------------------------------------
      // ai_suggested_value dan ai_confidence dibaca dari draft_suggestion,
      // BUKAN dari kiriman klien. was_corrected kolom generated, tidak diisi.
      const { rows: sug } = await c.query<{
        attribute_code: string; ai_suggested_value: string; ai_confidence: string;
      }>(
        'SELECT attribute_code, ai_suggested_value, ai_confidence FROM draft_suggestion WHERE evidence_id = $1',
        [draftId],
      );
      const sugByCode = new Map(sug.map((s) => [s.attribute_code, s]));

      const { rows: who } = await c.query<{ display_handle: string }>(
        'SELECT display_handle FROM contributor WHERE id = $1',
        [contributorId],
      );
      const actor = who[0].display_handle;

      const notVisible: string[] = [];

      for (const s of submitted) {
        const hit = sugByCode.get(s.code) ?? null;

        const { rows: obs } = await c.query<{ id: string; was_corrected: boolean }>(
          `INSERT INTO observation (
             place_id, attribute_code, evidence_id, contributor_id,
             ai_suggested_value, ai_confidence, confirmed_value
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, was_corrected`,
          [
            place_id, s.code, draftId, contributorId,
            hit?.ai_suggested_value ?? null,
            hit ? Number(hit.ai_confidence) : null,
            s.value,
          ],
        );

        await writeAudit(c, {
          entityType: 'observation',
          entityId: obs[0].id,
          action: 'observation_confirmed',
          actor,
          before: null,
          after: {
            place_id,
            attribute_code: s.code,
            evidence_id: draftId,
            confirmed_value: s.value,
            ai_suggested_value: hit?.ai_suggested_value ?? null,
            was_corrected: obs[0].was_corrected,
            // ai_confidence sengaja TIDAK ikut: jejak audit ini terbuka
            // untuk publik, dan aturan 5 berlaku di sana juga.
          },
        });

        if (s.value === NOT_VISIBLE) notVisible.push(s.code);
      }

      // ---- hitung ulang attribute_state ------------------------------
      const changes: StateChange[] = [];
      for (const s of submitted) {
        changes.push(await recomputeAttributeState(c, place_id, s.code, actor));
      }

      return { place_id, vantage, changes, notVisible };
    });

    // 422 selamanya, dengan alasan aslinya
    if ('rejected' in result && result.rejected) {
      const rejected = result.rejected;
      const CODE_TO_REASON: Record<string, ReasonCode> = {
        C0: 'CAPTURE_SESSION_INVALID', C1: 'RATE_LIMITED',
        C3: 'FILE_METADATA_PRESENT',   C4: 'TIMESTAMP_SKEW',
        C5: 'GEO_MISSING',             C6: 'GEO_ACCURACY_LOW',
        C6b: 'GEO_FIX_STALE',          C7: 'GEO_TOO_FAR',
        C8: 'DUPLICATE_IMAGE',
      };
      return jsonError(
        422,
        rejected.map((f) => {
          const reason = CODE_TO_REASON[f.check_code];
          return {
            code: reason,
            message: REASON_MESSAGE[reason],
            measured: f.measured,
            threshold: f.threshold,
          };
        }),
      );
    }

    return NextResponse.json({
      draft_id: draftId,
      place_id: result.place_id,
      vantage: result.vantage,
      /** Dicatat dan masuk audit, tapi sengaja tidak membentuk attribute_state. */
      recorded_not_visible: result.notVisible,
      changes: result.changes,
    });
  } catch (err) {
    if (err instanceof Conflict) {
      return NextResponse.json(
        {
          errors: [{
            code: 'DRAFT_NOT_CONFIRMABLE',
            message: 'Draft tidak ditemukan atau sudah pernah dikonfirmasi',
            measured: null,
            threshold: null,
          }],
        },
        { status: 409 },
      );
    }
    if (err instanceof BadRequest) {
      return NextResponse.json({ errors: [err.body] }, { status: 400 });
    }
    throw err;
  }
}
