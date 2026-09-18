// Terapkan migrasi SQL di db/migrations/ yang belum pernah dijalankan, urut nama
// berkas. Jalankan: npm run db:migrate (env diambil dari .env.local kalau ada).
// Skrip ini berdiri sendiri karena lib/db hanya boleh dimuat oleh server Next.js.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

const FOLDER = path.join(import.meta.dirname, "..", "..", "db", "migrations");
// Kunci advisory Postgres supaya dua orang tidak menerapkan migrasi bersamaan.
const KUNCI = 72_722_026;

function envWajib(nama: string): string {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Env ${nama} belum diisi; lihat .env.example.`);
  return nilai;
}

const connector = new Connector();
const klien = new pg.Client({
  ...(await connector.getOptions({
    instanceConnectionName: envWajib("CLOUD_SQL_CONNECTION_NAME"),
    ipType: IpAddressTypes.PUBLIC,
  })),
  user: envWajib("DB_USER"),
  password: envWajib("DB_PASSWORD"),
  database: envWajib("DB_NAME"),
});

try {
  await klien.connect();
  await klien.query("select pg_advisory_lock($1)", [KUNCI]);
  await klien.query(
    "create table if not exists schema_migrations (nama text primary key, diterapkan_pada timestamptz not null default now())",
  );
  const sudah = new Set(
    (await klien.query<{ nama: string }>("select nama from schema_migrations")).rows.map((b) => b.nama),
  );
  const berkas = (await readdir(FOLDER)).filter((nama) => nama.endsWith(".sql")).sort();
  let jumlah = 0;
  for (const nama of berkas) {
    if (sudah.has(nama)) continue;
    const sql = await readFile(path.join(FOLDER, nama), "utf8");
    await klien.query("begin");
    try {
      await klien.query(sql);
      await klien.query("insert into schema_migrations (nama) values ($1)", [nama]);
      await klien.query("commit");
    } catch (galat) {
      await klien.query("rollback");
      throw new Error(`Migrasi ${nama} gagal: ${(galat as Error).message}`, { cause: galat });
    }
    console.log(`diterapkan: ${nama}`);
    jumlah++;
  }
  console.log(jumlah ? `${jumlah} migrasi diterapkan.` : "Tidak ada migrasi baru.");
} finally {
  await klien.end();
  connector.close();
}
