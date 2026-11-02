import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withTx } from '@/lib/trust/db';
import { trustConfig } from '@/lib/trust/config';
import { BadRequest, badRequest } from '@/lib/trust/errors';
import {
  SESSION_COOKIE,
  newCaptureToken,
  verifySession,
} from '@/lib/trust/session';
import {
  VANTAGES,
  formatClaimableAttributes,
  isUuid,
  parseVantage,
  type ClaimableAttributeRow,
} from '@/lib/trust/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * E8 — token penangkapan.
 *
 * Dipanggil klien SAAT LAYAR TITIK PANDANG DIBUKA, bersamaan dengan mulainya
 * pemantauan GPS. Bukan saat tombol kirim ditekan. Alasannya ada dua:
 * fix GPS di dalam gedung butuh waktu puluhan detik (C6b memberi jatah 60
 * detik), dan tempat harus sudah ditetapkan server SEBELUM fotonya diambil —
 * itu yang membuat C0 punya arti.
 */
export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const contributorId = verifySession(jar.get(SESSION_COOKIE)?.value);
    if (!contributorId) {
      throw badRequest('SESSION_REQUIRED', 'Mulai sesi dulu sebelum mengambil foto');
    }

    const body = (await req.json().catch(() => null)) as
      | { place_id?: unknown; vantage?: unknown }
      | null;
    if (!body) throw badRequest('BODY_INVALID', 'Isi permintaan bukan JSON yang sah');

    const placeId = typeof body.place_id === 'string' ? body.place_id.trim() : '';
    const vantage = parseVantage(body.vantage);

    if (!placeId) throw badRequest('PLACE_ID_REQUIRED', 'place_id wajib diisi');
    if (!isUuid(placeId)) throw badRequest('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
    if (!vantage) {
      throw badRequest(
        'VANTAGE_INVALID',
        `vantage harus salah satu dari: ${VANTAGES.join(', ')}`,
      );
    }

    const result = await withTx(async (c) => {
      const place = await c.query('SELECT id FROM place WHERE id = $1', [placeId]);
      if (place.rowCount === 0) {
        throw badRequest('PLACE_NOT_FOUND', 'Tempat tidak ditemukan');
      }

      const claimable = await c.query<ClaimableAttributeRow>(
        // Tabel Verification tidak punya sort_order. Diurutkan per code supaya
        // urutannya tetap sama di tiap panggilan; kalau antarmuka butuh urutan
        // tampil tertentu, itu kolom yang perlu diminta ke Verification.
        `SELECT code, value_type, allowed_values, is_required_at_vantage
           FROM attribute_type
          WHERE vantage = $1
          ORDER BY code`,
        [vantage],
      );

      // Titik pandang tanpa atribut yang bisa diklaim tidak punya alasan
      // untuk menerbitkan token.
      if (claimable.rowCount === 0) {
        throw badRequest(
          'VANTAGE_EMPTY',
          'Tidak ada atribut yang bisa diklaim dari titik pandang ini',
        );
      }

      const token = newCaptureToken();
      const { rows } = await c.query<{ issued_at: string }>(
        `INSERT INTO capture_session (token, contributor_id, place_id, vantage)
         VALUES ($1, $2, $3, $4)
         RETURNING issued_at`,
        [token, contributorId, placeId, vantage],
      );

      const expiresAt = new Date(
        new Date(rows[0].issued_at).getTime() + trustConfig.captureTokenTtlS * 1000,
      );

      return { token, expiresAt, claimable: claimable.rows };
    });

    return NextResponse.json({
      token: result.token,
      expires_at: result.expiresAt.toISOString(),
      claimable: formatClaimableAttributes(result.claimable),
    });
  } catch (err) {
    if (err instanceof BadRequest) {
      return NextResponse.json({ errors: [err.body] }, { status: 400 });
    }
    throw err;
  }
}
