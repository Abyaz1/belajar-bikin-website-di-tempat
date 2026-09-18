/**
 * Kalibrasi ambang pHash dari hash yang SUDAH dihitung server untuk kontribusi
 * nyata (kolom evidence.phash). Tidak perlu mengumpulkan berkas foto.
 *
 * Kenapa ada: uji dua orang di jam 0 memakai /uji-kamera, yang menghitung hash
 * di PERAMBAN. Hash itu dihitung berbeda dari hash server (koefisien DC dan
 * cara mengecilkan gambar), jadi angkanya (16) tidak berlaku untuk C8. Hash di
 * tabel evidence justru persis angka yang dipakai C8 memutuskan.
 *
 * Cara memakai:
 *   1. Dua orang, masing-masing dengan sesi sendiri, memotret PINTU YANG SAMA
 *      lewat alur kontribusi aplikasi (tempat dan titik pandang sama).
 *   2. Tambahkan satu foto pintu lain sebagai pembanding.
 *   3. npm run phash:dari-bukti                   semua bukti nyata
 *      npm run phash:dari-bukti -- --sejak 2026-09-18T20:00:00+07:00
 *
 * Hanya membaca (transaksi read only). Data demo tidak ikut: hash-nya karangan.
 *
 * Batas tafsir: "tempat dan titik pandang sama" belum tentu pintu yang sama
 * persis. Sebutkan pasangan mana yang memang dipotret dari pintu yang sama.
 */

import { existsSync } from "node:fs";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";
import { trustConfig } from "../lib/trust/config";
import { classifyDuplicate, hammingDistance } from "../lib/trust/phash";
import type { Vantage } from "../lib/trust/types";

interface Bukti {
  id: string;
  place_id: string;
  nama: string;
  vantage: Vantage;
  contributor_id: string;
  phash: string;
  waktu: Date;
  ditolak: boolean;
}

function argumen(nama: string): string | undefined {
  const i = process.argv.indexOf(nama);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function muat(sejak: string | undefined): Promise<Bukti[]> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  let connector: Connector | null = null;
  const k = process.env.DATABASE_URL?.trim()
    ? new pg.Client({ connectionString: process.env.DATABASE_URL })
    : new pg.Client({
        ...(await (connector = new Connector()).getOptions({
          instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME ?? "",
          ipType: IpAddressTypes.PUBLIC,
        })),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      });
  await k.connect();
  try {
    await k.query("begin read only");
    const { rows } = await k.query<Bukti>(
      `select e.id, e.place_id, p.name as nama, e.vantage::text as vantage, e.contributor_id, e.phash,
              e.server_received_at as waktu,
              exists (select 1 from provenance_check c where c.evidence_id = e.id and c.result = 'fail') as ditolak
         from evidence e join place p on p.id = e.place_id
        where not e.is_demo_seed and e.phash is not null
          and ($1::timestamptz is null or e.server_received_at >= $1::timestamptz)
        order by e.server_received_at`,
      [sejak ?? null],
    );
    await k.query("rollback");
    return rows;
  } finally {
    await k.end();
    connector?.close();
  }
}

async function main() {
  const bukti = await muat(argumen("--sejak"));
  console.log(`\npHash dari SERVER (evidence.phash), ${bukti.length} bukti nyata.`);
  console.log(`Ambang berlaku: identik <= ${trustConfig.phashIdenticalMax}, mirip ${trustConfig.phashIdenticalMax + 1}-${trustConfig.phashSimilarMax}\n`);
  if (bukti.length < 2) {
    console.log("Butuh minimal dua bukti. Kirim foto pintu yang sama dari dua sesi berbeda lewat alur kontribusi.");
    return;
  }

  const sama: string[] = [];
  const jarakSama: number[] = [];
  const jarakBeda: number[] = [];
  for (let i = 0; i < bukti.length; i += 1) {
    for (let j = i + 1; j < bukti.length; j += 1) {
      const a = bukti[i];
      const b = bukti[j];
      const jarak = hammingDistance(a.phash, b.phash);
      const titikSama = a.place_id === b.place_id && a.vantage === b.vantage;
      if (titikSama && a.contributor_id !== b.contributor_id) {
        // Konteks C8 yang sebenarnya: bukti b datang belakangan dari kontributor lain.
        const hasil = classifyDuplicate(
          jarak,
          { evidenceId: a.id, phash: a.phash, placeId: a.place_id, vantage: a.vantage, contributorId: a.contributor_id },
          { placeId: b.place_id, vantage: b.vantage, contributorId: b.contributor_id },
        );
        jarakSama.push(jarak);
        sama.push(
          `  ${String(jarak).padStart(3)}  ${hasil.padEnd(4)}  ${a.nama} · ${a.vantage}  ${a.id.slice(0, 8)} ↔ ${b.id.slice(0, 8)}` +
            (a.ditolak || b.ditolak ? "  (salah satunya ditolak pemeriksaan lain)" : ""),
        );
      } else if (a.place_id !== b.place_id) {
        jarakBeda.push(jarak);
      }
    }
  }

  console.log("Tempat + titik pandang sama, kontributor berbeda (kandidat penguatan):");
  console.log(sama.length ? sama.join("\n") : "  belum ada pasangan seperti ini.");
  if (jarakBeda.length) console.log(`\nTempat berbeda: ${jarakBeda.length} pasangan, jarak terdekat ${Math.min(...jarakBeda)}.`);

  if (jarakSama.length) {
    const maks = Math.max(...jarakSama);
    const ditolak = jarakSama.filter((d) => d <= trustConfig.phashIdenticalMax).length;
    console.log(`\nKandidat penguatan: jarak terjauh ${maks}, ${ditolak} pasangan akan DITOLAK sebagai berkas yang dioper.`);
    if (jarakBeda.length) {
      const min = Math.min(...jarakBeda);
      console.log(
        min <= trustConfig.phashSimilarMax
          ? `  Tempat berbeda dengan jarak ${min} masuk pita mirip: ambang ${trustConfig.phashSimilarMax} terlalu longgar untuk citra ini.`
          : `  Tempat berbeda paling dekat ${min}, di atas ambang mirip ${trustConfig.phashSimilarMax}.`,
      );
    }
  }
  console.log("\nCatat angka dan ukuran sampelnya di docs-00 §10 dan PERUBAHAN.md entri 7.\n");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
