import "server-only";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";
import { envWajib } from "@/lib/env";

// Satu pool Postgres untuk seluruh aplikasi. Koneksi lewat Cloud SQL Node.js
// Connector (TLS, izin dari ADC atau service account Cloud Run), jadi laptop
// tidak butuh Cloud SQL Auth Proxy. Disimpan di globalThis supaya hot reload
// `next dev` tidak membuat pool baru.
const penyimpan = globalThis as typeof globalThis & { poolAstara?: Promise<Pool> };

async function buatPool() {
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
    max: 5,
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
