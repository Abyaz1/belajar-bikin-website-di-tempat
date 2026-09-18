import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withTx } from '@/lib/trust/db';
import { writeAudit } from '@/lib/trust/audit';
import { BadRequest, badRequest } from '@/lib/trust/errors';
import { SESSION_COOKIE, verifySession } from '@/lib/trust/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reset batas laju untuk latihan demo — TERCATAT, bukan akal-akalan.
 *
 * Briefing §3 menyebutnya sebagai satu-satunya jalan keluar yang sah ketika
 * batas laju menyala di tengah latihan: "pakai tombol reset yang tercatat di
 * audit log, jangan akal-akalan". Akal-akalan yang dimaksud adalah membuka sesi
 * anonim baru, yang memang berhasil tapi tidak meninggalkan jejak apa pun.
 *
 * TIDAK ADA YANG DIHAPUS. `evidence` bersifat append-only dan menghapus baris di
 * sana justru merusak tesis produk ini. Yang terjadi: satu `audit_event`
 * bertindakan `rate_limit_reset` ditulis, dan C1 menghitung kontribusi sejak
 * reset terakhir alih-alih sejak satu jam lalu. Jadi resetnya meninggalkan bekas
 * permanen yang terbaca publik di jejak audit, lengkap dengan waktunya.
 *
 * GERBANGNYA MATI SECARA BAWAAN. Tanpa `DEMO_RESET_TOKEN` terisi, rute ini
 * membalas 404 — bukan 403 — supaya keberadaannya tidak terumumkan. Endpoint
 * reset yang terbuka akan membuat C1 jadi hiasan: siapa pun tinggal memanggilnya
 * lalu melanjutkan, dan pembatas laju kita kehilangan seluruh artinya justru di
 * depan juri yang mencoba menembusnya.
 */
function tokenSah(diberikan: string | null): boolean {
  const rahasia = (process.env.DEMO_RESET_TOKEN ?? '').trim();
  if (!rahasia || !diberikan) return false;
  const a = Buffer.from(diberikan);
  const b = Buffer.from(rahasia);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  // Gerbang mati: berlaku seperti rute yang memang tidak ada.
  if (!(process.env.DEMO_RESET_TOKEN ?? '').trim()) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    if (!tokenSah(req.headers.get('x-demo-reset-token'))) {
      return new NextResponse(null, { status: 404 });
    }

    const jar = await cookies();
    const contributorId = verifySession(jar.get(SESSION_COOKIE)?.value);
    if (!contributorId) {
      throw badRequest('SESSION_REQUIRED', 'Mulai sesi dulu sebelum mereset batas kontribusi');
    }

    const hasil = await withTx(async (c) => {
      const { rows: who } = await c.query<{ display_handle: string }>(
        'SELECT display_handle FROM contributor WHERE id = $1',
        [contributorId],
      );
      if (who.length === 0) {
        throw badRequest('SESSION_REQUIRED', 'Sesi tidak dikenal. Mulai sesi baru');
      }

      // Berapa yang terpakai sebelum reset, supaya jejak auditnya bercerita.
      const { rows: sebelum } = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n
           FROM evidence
          WHERE contributor_id = $1
            AND server_received_at > now() - interval '1 hour'`,
        [contributorId],
      );

      await writeAudit(c, {
        entityType: 'contributor',
        entityId: contributorId,
        action: 'rate_limit_reset',
        actor: who[0].display_handle,
        before: { kontribusi_satu_jam_terakhir: Number(sebelum[0].n) },
        after: { kontribusi_terhitung_sejak_reset: 0, alasan: 'latihan demo' },
      });

      return { terpakaiSebelumnya: Number(sebelum[0].n), handle: who[0].display_handle };
    });

    return NextResponse.json({
      contributor: hasil.handle,
      terpakai_sebelum_reset: hasil.terpakaiSebelumnya,
      /** Jejaknya permanen dan terbaca publik. Itu memang maksudnya. */
      tercatat_di_audit: true,
    });
  } catch (err) {
    if (err instanceof BadRequest) {
      return NextResponse.json({ errors: [err.body] }, { status: 400 });
    }
    throw err;
  }
}
