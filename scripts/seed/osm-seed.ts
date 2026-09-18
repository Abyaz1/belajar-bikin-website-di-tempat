/**
 * Penyemaian tempat dari OpenStreetMap untuk satu koridor (docs-20 §3).
 *
 *   npm run seed:osm                 baca data tersimpan, tampilkan rencana saja
 *   npm run seed:osm -- --unduh      unduh ulang dari Overpass, simpan mentah ke repo
 *   npm run seed:osm -- --tulis      tulis ke basis data (satu transaksi)
 *
 * Data mentah disimpan di scripts/seed/data/ begitu didapat, karena Overpass
 * sering lambat atau menolak. Lisensinya ODbL: atribusi "© kontributor
 * OpenStreetMap" wajib tampil di daftar dan peta, dan turunan basis datanya
 * ikut ODbL (share-alike).
 *
 * Penulisan idempoten. Tempat diperbarui berdasarkan (osm_type, osm_id).
 * attribute_state dari seed memakai ON CONFLICT DO NOTHING: klaim OSM tidak
 * pernah menimpa nilai yang sudah datang dari kontribusi berbukti.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";
import { petakan, pilih, type ElemenOsm, type TempatSeed } from "./osm";

const KORIDOR = {
  nama: "UNPAD Dipatiukur, Bandung",
  // Sekitar gedung Universitas Padjadjaran di Jalan Dipati Ukur, ±650 m ke tiap arah.
  pusat: { lat: -6.8925, lon: 107.618 },
  bbox: { selatan: -6.8985, barat: 107.612, utara: -6.8865, timur: 107.624 },
  maks: 60,
};
const BERKAS = path.resolve("scripts/seed/data/osm-dipatiukur.json");
// Instans utama dulu; kalau sibuk (504/429) atau menolak, coba instans publik lain
// yang menyajikan data OSM yang sama.
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

function kueri(): string {
  const { selatan, barat, utara, timur } = KORIDOR.bbox;
  const bb = `${selatan},${barat},${utara},${timur}`;
  return `[out:json][timeout:90];
(
  nwr["amenity"~"^(university|college)$"](${bb});
  nwr["amenity"~"^(hospital|clinic|doctors|dentist)$"](${bb});
  nwr["healthcare"~"^(hospital|clinic|doctor|dentist|centre)$"](${bb});
  node["highway"="bus_stop"](${bb});
  nwr["amenity"="bus_station"](${bb});
  nwr["public_transport"="platform"]["bus"="yes"](${bb});
)->.tempat;
.tempat out body center;
way.tempat->.w;
node(w.w)["entrance"];
out body;`;
}

async function unduh(): Promise<void> {
  const galat: string[] = [];
  for (const url of OVERPASS) {
    console.log(`Mengunduh koridor ${KORIDOR.nama} dari ${new URL(url).host}…`);
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: kueri() }),
        headers: { "User-Agent": "astara-hackday-seed/1.0" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mentah = await res.text();
      JSON.parse(mentah); // pastikan JSON utuh sebelum menimpa salinan lama
      await mkdir(path.dirname(BERKAS), { recursive: true });
      await writeFile(BERKAS, mentah);
      console.log(`Tersimpan: ${path.relative(process.cwd(), BERKAS)} (${(mentah.length / 1024).toFixed(1)} KiB)`);
      return;
    } catch (e) {
      galat.push(`${new URL(url).host}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(`Semua instans Overpass gagal:\n  ${galat.join("\n  ")}`);
}

async function klien(): Promise<{ klien: pg.Client; tutup: () => Promise<void> }> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const wajib = (n: string) => {
    const v = process.env[n];
    if (!v) throw new Error(`Env ${n} belum diisi; lihat .env.example.`);
    return v;
  };
  if (process.env.DATABASE_URL?.trim()) {
    const k = new pg.Client({ connectionString: process.env.DATABASE_URL });
    return { klien: k, tutup: () => k.end() };
  }
  const connector = new Connector();
  const k = new pg.Client({
    ...(await connector.getOptions({ instanceConnectionName: wajib("CLOUD_SQL_CONNECTION_NAME"), ipType: IpAddressTypes.PUBLIC })),
    user: wajib("DB_USER"),
    password: wajib("DB_PASSWORD"),
    database: wajib("DB_NAME"),
  });
  return {
    klien: k,
    tutup: async () => {
      await k.end();
      connector.close();
    },
  };
}

async function tulis(tempat: TempatSeed[]): Promise<void> {
  const { klien: k, tutup } = await klien();
  let baru = 0;
  let diperbarui = 0;
  let atribut = 0;
  try {
    await k.connect();
    await k.query("begin");
    for (const t of tempat) {
      const { rows } = await k.query<{ id: string; baru: boolean }>(
        `insert into place (osm_type, osm_id, name, category, lat, lon, address, source, third_party_claims, is_demo_seed)
         values ($1, $2, $3, $4, $5, $6, $7, 'osm_seed', $8, false)
         on conflict (osm_type, osm_id) do update set
           name = excluded.name, category = excluded.category, lat = excluded.lat, lon = excluded.lon,
           address = excluded.address, third_party_claims = excluded.third_party_claims
         returning id, (xmax = 0) as baru`,
        [t.osm_type, t.osm_id, t.name, t.category, t.lat, t.lon, t.address, t.third_party_claims],
      );
      if (rows[0].baru) baru++;
      else diperbarui++;
      for (const [kode, nilai] of Object.entries(t.atribut)) {
        const r = await k.query(
          `insert into attribute_state (place_id, attribute_code, current_value, source)
           values ($1, $2, $3, 'osm_seed')
           on conflict (place_id, attribute_code) do nothing`,
          [rows[0].id, kode, nilai],
        );
        atribut += r.rowCount ?? 0;
      }
    }
    await k.query("commit");
  } catch (e) {
    await k.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await tutup();
  }
  console.log(`Ditulis: ${baru} tempat baru, ${diperbarui} diperbarui, ${atribut} klaim atribut (belum_terverifikasi).`);
}

function rencana(tempat: TempatSeed[], total: number): void {
  const perKategori = Object.groupBy(tempat, (t) => t.category);
  console.log(`Koridor ${KORIDOR.nama}: ${total} tempat bernama ditemukan, ${tempat.length} dipilih (maks ${KORIDOR.maks}).`);
  for (const [kat, isi] of Object.entries(perKategori)) console.log(`  ${kat}: ${isi?.length ?? 0}`);
  const atribut = tempat.flatMap((t) => Object.keys(t.atribut));
  console.log(`  klaim atribut dari tag OSM: ${atribut.length}${atribut.length ? ` (${[...new Set(atribut)].join(", ")})` : ""}`);
  console.log(`  klaim wheelchair (hanya untuk audit): ${tempat.filter((t) => t.third_party_claims).length}`);
}

async function main(): Promise<void> {
  const argumen = new Set(process.argv.slice(2));
  if (argumen.has("--unduh")) await unduh();
  if (!existsSync(BERKAS)) throw new Error(`Belum ada data mentah di ${BERKAS}. Jalankan dengan --unduh dulu.`);

  const { elements } = JSON.parse(await readFile(BERKAS, "utf8")) as { elements: ElemenOsm[] };
  const semua = petakan(elements);
  const dipilih = pilih(semua, KORIDOR.pusat, KORIDOR.maks);
  rencana(dipilih, semua.length);

  if (argumen.has("--tulis")) await tulis(dipilih);
  else console.log("Rencana saja. Tambahkan --tulis untuk menulis ke basis data.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
