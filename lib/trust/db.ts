import type { Pool, PoolClient } from 'pg';
import { db } from '@/lib/db';

/**
 * SATU pool untuk seluruh proses, dibagi bersama antara jalur baca dan tulis.
 *
 * Seluruh pembuatan dan penyimpanan instance Pool dipusatkan di `lib/db/index.ts`
 * (mendukung DATABASE_URL untuk lokal/tes dan Cloud SQL Connector untuk Cloud Run).
 *
 * PERAN KONEKSI WAJIB BUKAN SUPERUSER. Seluruh penegakan append-only pada
 * audit_event, provenance_check, dan observation bersandar pada Row Level
 * Security, dan RLS tidak berlaku untuk superuser maupun peran ber-BYPASSRLS.
 * Lihat db/migrations/202609181300_trust_skema.sql §10.
 */

export function pool(): Promise<Pool> {
  return db();
}

/** Transaksi. Rollback otomatis kalau callback melempar. */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await (await pool()).connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
