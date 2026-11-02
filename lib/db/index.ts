import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";
import { envWajib } from "@/lib/env";

// Satu pool Postgres untuk seluruh aplikasi (jalur baca maupun jalur tulis).
// Koneksi lewat DATABASE_URL (lokal, Docker, suite tes) atau Cloud SQL Node.js
// Connector di Cloud Run. Disimpan di globalThis supaya hot reload `next dev`
// tidak membuat pool baru.
const penyimpan = globalThis as typeof globalThis & { poolAstara?: Promise<Pool> };

async function buatPool(): Promise<Pool> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
    });
  }

  const connector = new Connector();
  const opsi = await connector.getOptions({
    instanceConnectionName: envWajib("CLOUD_SQL_CONNECTION_NAME"),
    ipType: IpAddressTypes.PUBLIC,
  });
  return new Pool({
    ...opsi,
    user: envWajib("DB_USER"),
    password: envWajib("DB_PASSWORD"),
    database: envWajib("DB_NAME"),
    max: 10,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
  });
}

export function db(): Promise<Pool> {
  penyimpan.poolAstara ??= buatPool().catch((galat: unknown) => {
    // Jangan simpan kegagalan; panggilan berikutnya mencoba lagi.
    penyimpan.poolAstara = undefined;
    throw galat;
  });
  return penyimpan.poolAstara;
}
