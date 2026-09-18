import { Pool, type PoolClient } from 'pg';

/**
 * Satu pool untuk seluruh jalur tulis.
 * PGUSER wajib app_rw, bukan superuser. Kalau superuser, seluruh jaminan
 * append-only di db/migrations/001_trust_schema.sql §10 tidak berlaku —
 * lihat catatan jujur di kepala migrasi itu.
 */
const globalPool = globalThis as unknown as { __trustPool?: Pool };

export const pool =
  globalPool.__trustPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
  });

if (process.env.NODE_ENV !== 'production') globalPool.__trustPool = pool;

/** Transaksi. Rollback otomatis kalau callback melempar. */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
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
