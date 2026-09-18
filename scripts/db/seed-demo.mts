/**
 * Menjalankan db/seed/seed_demo.sql ke basis data .env.local.
 *
 *   npm run db:seed-demo              simulasi: jalankan lalu ROLLBACK, cetak hasilnya
 *   npm run db:seed-demo -- --tulis   jalankan dan COMMIT
 *
 * Seed-nya idempoten, tetapi observation dan audit_event append-only: yang
 * sudah tertulis tidak bisa ditarik. Karena itu bawaannya simulasi, supaya
 * isi dan jumlah audit yang akan bertambah bisa dibaca dulu.
 *
 * Koneksi: DATABASE_URL kalau ada, selain itu Cloud SQL Connector.
 */

import { readFileSync } from "node:fs";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

const tulis = process.argv.includes("--tulis");
// COMMIT di akhir berkas diganti keputusan skrip ini; ringkasan sesudahnya dicetak di bawah.
const bagian = readFileSync("db/seed/seed_demo.sql", "utf8").split(/^COMMIT;\r?$/m);
// Tanpa pemisah ini COMMIT ikut terkirim dan "simulasi" diam-diam menulis.
if (bagian.length !== 2) throw new Error("seed_demo.sql harus berisi tepat satu baris COMMIT; — berhenti tanpa menyentuh basis data.");
const [badan] = bagian;

const wajib = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`Env ${n} belum diisi; lihat .env.example.`);
  return v;
};

let connector: Connector | null = null;
const klien = process.env.DATABASE_URL?.trim()
  ? new pg.Client({ connectionString: process.env.DATABASE_URL })
  : new pg.Client({
      ...(await (connector = new Connector()).getOptions({
        instanceConnectionName: wajib("CLOUD_SQL_CONNECTION_NAME"),
        ipType: IpAddressTypes.PUBLIC,
      })),
      user: wajib("DB_USER"),
      password: wajib("DB_PASSWORD"),
      database: wajib("DB_NAME"),
    });

klien.on("notice", (n) => console.log(`NOTICE: ${n.message}`));
await klien.connect();
try {
  const sebelum = await klien.query<{ n: string }>("select count(*) n from audit_event where is_demo_seed");
  await klien.query(badan);
  const sesudah = await klien.query<{ n: string }>("select count(*) n from audit_event where is_demo_seed");
  const { rows } = await klien.query(
    `select p.name, s.attribute_code, s.current_value,
            trust_derive_status(s.last_verified_at, s.next_review_at) as status, s.is_disputed
       from attribute_state s join place p on p.id = s.place_id
      where p.is_demo_seed order by 1, 2`,
  );
  for (const r of rows)
    console.log(`${r.name} · ${r.attribute_code} = ${r.current_value} · ${r.status}${r.is_disputed ? " · sengketa" : ""}`);
  console.log(`audit_event demo: ${sebelum.rows[0].n} → ${sesudah.rows[0].n}`);
  await klien.query(tulis ? "commit" : "rollback");
  console.log(tulis ? "Ditulis (COMMIT)." : "Simulasi (ROLLBACK). Tambahkan --tulis untuk menyimpan.");
} catch (e) {
  await klien.query("rollback").catch(() => undefined);
  throw e;
} finally {
  await klien.end();
  connector?.close();
}
