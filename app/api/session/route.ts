import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withTx } from '@/lib/trust/db';
import { writeAudit } from '@/lib/trust/audit';
import {
  SESSION_COOKIE,
  createAnonymousContributor,
  findContributor,
  sessionCookieOptions,
  signSession,
  verifySession,
} from '@/lib/trust/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * E7 — sesi anonim.
 *
 * Sesi, bukan pendaftaran akun: juri tidak akan mendaftar akun di atas panggung.
 * Idempoten — kalau cookie yang sah sudah ada, kontributornya dipakai lagi,
 * supaya menyegarkan halaman tidak memecah riwayat kontribusi orang yang sama
 * dan tidak mengelabui hitungan penguat di mesin status.
 */
export async function POST() {
  const jar = await cookies();
  const existingId = verifySession(jar.get(SESSION_COOKIE)?.value);

  const contributor = await withTx(async (c) => {
    if (existingId) {
      const found = await findContributor(c, existingId);
      if (found) return found;
    }

    const created = await createAnonymousContributor(c);
    await writeAudit(c, {
      entityType: 'contributor',
      entityId: created.id,
      action: 'session_created',
      actor: created.display_handle,
      before: null,
      after: { kind: 'anonymous_session', display_handle: created.display_handle },
    });
    return created;
  });

  const res = NextResponse.json({
    contributor_id: contributor.id,
    display_handle: contributor.display_handle,
  });
  res.cookies.set(SESSION_COOKIE, signSession(contributor.id), sessionCookieOptions);
  return res;
}

/*
 * KENAPA PEMBUATAN SESI DICATAT.
 *
 * docs/10-trust.md §1 semula mengunci daftar action audit ke lima nilai, dan
 * tidak ada satu pun yang berarti "sesi dibuat". Nilai keenam ditambahkan
 * lewat keputusan yang tercatat di PERUBAHAN.md entri 5.
 *
 * Alasannya bukan kerapian. C1 menghitung kontribusi PER KONTRIBUTOR, jadi
 * meminta sesi anonim baru adalah cara paling murah memutar satu-satunya
 * pembatas laju yang kita punya — dan siapa pun bisa melakukannya kapan saja.
 * Itu batas nyata lapisan ini. Batas yang tidak meninggalkan jejak tidak bisa
 * diukur, tidak bisa dilaporkan, dan tidak bisa dibela saat juri bertanya.
 * Maka dicatat, bukan disembunyikan.
 */
