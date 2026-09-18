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
import type { Vantage } from '@/lib/trust/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VANTAGES: readonly Vantage[] = ['entrance', 'interior', 'toilet'];

// Kolom mengikuti tabel attribute_type milik Verification
// (202609181245_verifikasi_referensi.sql). allowed_values di sana NOT NULL dan
// juga mencakup tipe integer — step_count disimpan sebagai '0'..'20' — sehingga
// min_value dan max_value tidak ada lagi, dan tidak dibutuhkan.
interface ClaimableRow {
  code: string;
  value_type: 'integer' | 'enum';
  allowed_values: string[];
  is_required_at_vantage: boolean;
}

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

    const placeId = typeof body.place_id === 'string' ? body.place_id : null;
    const vantage = VANTAGES.find((v) => v === body.vantage) ?? null;

    if (!placeId) throw badRequest('PLACE_ID_REQUIRED', 'place_id wajib diisi');
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

      const claimable = await c.query<ClaimableRow>(
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
      claimable: result.claimable.map((a) => ({
        attribute_code: a.code,
        required: a.is_required_at_vantage,
        value_type: a.value_type,
        // 'not_visible' sah untuk atribut mana pun dan tidak disimpan di tabel,
        // jadi ditambahkan di sini supaya klien bisa menampilkannya.
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

/*
 * BATASAN YANG DICATAT, BUKAN DITAMBAL:
 * Penerbitan token tidak dibatasi laju. Siapa pun bisa meminta token sebanyak
 * yang dia mau. Itu tidak melonggarkan apa pun, karena yang membatasi
 * kontribusi adalah C1 yang menghitung baris evidence per kontributor — dan
 * kontribusi yang ditolak tetap dihitung. Yang bisa dilakukan penyerang cuma
 * menumpuk baris capture_session yang tidak terpakai.
 */
