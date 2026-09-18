import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';

export const SESSION_COOKIE = 'kontribusi_sesi';
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET belum diisi atau kurang dari 32 karakter.');
  }
  return Buffer.from(s, 'utf8');
}

/**
 * Cookie ditandatangani HMAC supaya contributor_id tidak bisa ditukar klien.
 *
 * Yang dijamin: pengirim tidak bisa mengaku sebagai kontributor lain tanpa
 * kunci server. Yang TIDAK dijamin: bahwa di balik sesi ini ada orang yang
 * berbeda dari sesi sebelumnya — siapa pun bisa meminta sesi anonim baru
 * kapan saja. C8 baris "kontributor beda" karena itu menaikkan biaya, bukan
 * menutup celah, dan harus disebut begitu kalau juri bertanya.
 */
export function signSession(contributorId: string): string {
  const sig = createHmac('sha256', secret()).update(contributorId).digest('base64url');
  return `${contributorId}.${sig}`;
}

export function verifySession(raw: string | undefined): string | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;

  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1), 'base64url');
  const want = createHmac('sha256', secret()).update(id).digest();

  if (given.length !== want.length) return null;
  if (!timingSafeEqual(given, want)) return null;
  return id;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_S,
};

export function newCaptureToken(): string {
  // 32 byte acak kriptografis → 43 karakter base64url, lolos CHECK length >= 32.
  return randomBytes(32).toString('base64url');
}

export interface Contributor {
  id: string;
  display_handle: string;
}

export async function createAnonymousContributor(c: PoolClient): Promise<Contributor> {
  const { rows } = await c.query<Contributor>(
    `INSERT INTO contributor (kind, display_handle)
     VALUES ('anonymous_session', 'Kontributor #' || nextval('contributor_handle_seq'))
     RETURNING id, display_handle`,
  );
  return rows[0];
}

export async function findContributor(
  c: PoolClient,
  id: string,
): Promise<Contributor | null> {
  const { rows } = await c.query<Contributor>(
    'SELECT id, display_handle FROM contributor WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
