import type { Pool, PoolClient } from 'pg';

/**
 * SATU pool untuk seluruh proses, bukan satu pool per jalur.
 *
 * Sebelumnya berkas ini membuat pool-nya sendiri dari DATABASE_URL, sementara
 * lib/db milik Product membuat pool lain lewat Cloud SQL Connector. Dua pool di
 * satu proses berarti dua kali lipat koneksi terhadap kuota Cloud SQL — dan yang
 * lebih buruk, perintah deploy di README tidak pernah mengirim DATABASE_URL,
 * sehingga di Cloud Run jalur tulis tidak akan tersambung sama sekali: E7
 * melempar galat di request pertama, E4/E5/E8 tidak pernah menyentuh basis data.
 *
 * Jadi sumber koneksinya dipilih, bukan digandakan:
 *
 *   DATABASE_URL ada   -> pool sendiri. Jalur pengembangan lokal, Docker, dan
 *                         suite tests/rejection, yang semuanya menembak
 *                         Postgres biasa tanpa Cloud SQL.
 *   DATABASE_URL kosong-> delegasi ke lib/db. Itu pool yang sama persis dengan
 *                         yang dipakai jalur baca, di-cache di globalThis oleh
 *                         berkas itu sendiri, lewat Cloud SQL Connector.
 *
 * PERAN KONEKSI WAJIB BUKAN SUPERUSER, di kedua jalur. Seluruh penegakan
 * append-only pada audit_event, provenance_check, dan observation bersandar pada
 * Row Level Security, dan RLS tidak berlaku untuk superuser maupun peran
 * ber-BYPASSRLS. Kalau aplikasi tersambung sebagai superuser, kalimat "jejak
 * audit tidak bisa diubah" yang akan kita ucapkan ke juri tidak benar.
 * Lihat db/migrations/202609181300_trust_skema.sql §10.
 */

const penyimpan = globalThis as typeof globalThis & {
  __trustPool?: Promise<Pool>;
};

async function buatPool(): Promise<Pool> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import('pg');
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
    });
  }

  // Impor dinamis: lib/db memuat "server-only" dan Cloud SQL Connector, dan
  // keduanya tidak perlu ikut termuat pada jalur lokal maupun saat unit test.
  const { db } = await import('@/lib/db');
  return db();
}

export function pool(): Promise<Pool> {
  penyimpan.__trustPool ??= buatPool().catch((galat: unknown) => {
    // Jangan mengunci kegagalan sekali jadi kegagalan selamanya.
    penyimpan.__trustPool = undefined;
    throw galat;
  });
  return penyimpan.__trustPool;
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
