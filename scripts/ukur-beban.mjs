/**
 * Ukur beban kontribusi (docs-40 §3: di bawah 60 detik, 5 percobaan).
 *
 * Tidak memakai stopwatch. Basis data sudah menyimpan jam server di tiap
 * tahapnya, dan jam server tidak bisa salah tekan:
 *
 *   capture_session.issued_at   layar titik pandang dibuka, E8 dipanggil
 *   evidence.server_received_at foto sampai di server, E4 selesai
 *   min(observation.observed_at) kontributor menekan konfirmasi, E5 selesai
 *
 * Jendela yang dihitung persis jendela yang dianggarkan docs-30 §4: pemantauan
 * GPS dimulai saat layar titik pandang dibuka, jadi dari situlah waktu berjalan.
 * client_captured_at sengaja TIDAK dipakai membelah tahap, karena itu jam klien
 * dan bisa dinyatakan apa saja; dia hanya ditampilkan sebagai keterangan.
 *
 * Yang dihitung hanya kontribusi yang SELESAI sampai E5. Draf yang ditinggalkan
 * bukan kontribusi yang selesai, dan memasukkannya akan memperbagus angka tanpa
 * alasan.
 *
 * Pakai:
 *   npm run ukur:beban
 *   npm run ukur:beban -- --sejak 2026-09-19T01:00:00+07:00
 *   npm run ukur:beban -- --termasuk-demo
 */
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const SEJAK = arg("--sejak");
const DEMO = process.argv.includes("--termasuk-demo");
const ANGGARAN = 60;

function envWajib(n) { const v = process.env[n]; if (!v) throw new Error(`Env ${n} belum diisi.`); return v; }

let klien, connector;
if (process.env.DATABASE_URL) klien = new pg.Client({ connectionString: process.env.DATABASE_URL });
else {
  connector = new Connector();
  klien = new pg.Client({
    ...(await connector.getOptions({ instanceConnectionName: envWajib("CLOUD_SQL_CONNECTION_NAME"), ipType: IpAddressTypes.PUBLIC })),
    user: envWajib("DB_USER"), password: envWajib("DB_PASSWORD"), database: envWajib("DB_NAME"),
  });
}

const detik = (a, b) => (new Date(b) - new Date(a)) / 1000;
const jam = (t) => new Date(t).toLocaleTimeString("id-ID", { hour12: false });
const p = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

try {
  await klien.connect();
  const { rows } = await klien.query(
    `select e.id, p.name tempat, e.vantage, cs.issued_at, e.client_captured_at, e.server_received_at,
            min(o.observed_at) confirmed_at, count(distinct o.attribute_code)::int atribut, e.is_demo_seed
       from evidence e
       join capture_session cs on cs.token = e.capture_session_token
       join place p on p.id = e.place_id
       join observation o on o.evidence_id = e.id
      where ($1::boolean or not e.is_demo_seed)
        and ($2::timestamptz is null or cs.issued_at >= $2::timestamptz)
      group by e.id, p.name, e.vantage, cs.issued_at, e.client_captured_at, e.server_received_at, e.is_demo_seed
      order by cs.issued_at`,
    [DEMO, SEJAK],
  );

  if (!rows.length) {
    console.log("\nBelum ada kontribusi yang selesai sampai E5 dalam rentang ini.");
    console.log("Jalankan alur kontribusi di HP sampai layar ringkasan, lalu ulangi perintah ini.\n");
    process.exitCode = 1;
  } else {
    console.log(`\nBeban kontribusi — ${rows.length} kontribusi selesai, anggaran ${ANGGARAN} detik\n`);
    console.log("  #   mulai     titik pandang  tempat                    siapkan+kirim  konfirmasi   TOTAL  atribut");
    console.log("  " + "-".repeat(96));
    const total = [];
    rows.forEach((b, i) => {
      const t1 = detik(b.issued_at, b.server_received_at);
      const t2 = detik(b.server_received_at, b.confirmed_at);
      const t = t1 + t2;
      total.push(t);
      const tanda = t > ANGGARAN ? " LEWAT" : "";
      console.log(
        `  ${String(i + 1).padStart(2)}  ${jam(b.issued_at)}  ${String(b.vantage).padEnd(13)}  ${String(b.tempat).slice(0, 24).padEnd(24)}` +
        `${t1.toFixed(1).padStart(11)} dtk ${t2.toFixed(1).padStart(9)} dtk ${t.toFixed(1).padStart(7)} dtk${tanda}  ${b.atribut}${b.is_demo_seed ? "  [demo]" : ""}`,
      );
    });
    // Titik pandang dipisah karena bebannya tidak sebanding. Pintu masuk
    // menuntut enam atribut dan memanggil model; toilet dan interior masing-masing
    // satu atribut, dan tidak satu pun atributnya ai_suggestable sehingga model
    // tidak dipanggil sama sekali. Mencampurnya jadi satu rata-rata akan
    // memperkecil angka tanpa ada yang berkontribusi lebih cepat.
    const per = new Map();
    for (const [i, b] of rows.entries()) per.set(b.vantage, [...(per.get(b.vantage) ?? []), total[i]]);
    if (per.size > 1) {
      console.log("\n  Per titik pandang");
      for (const [v, xs] of [...per].sort()) {
        console.log(`    ${v.padEnd(10)} n=${xs.length}  median ${p(xs, 0.5).toFixed(1)} dtk  terlama ${Math.max(...xs).toFixed(1)} dtk`);
      }
      console.log("    docs-40 §3 mengukur titik pandang WAJIB, yaitu pintu masuk (kontrak §4).");
    }

    const lewat = total.filter((x) => x > ANGGARAN).length;
    console.log("\n  Ringkasan");
    console.log(`    n            : ${total.length}${total.length < 5 ? "  (docs-40 §3 minta 5 percobaan)" : ""}`);
    console.log(`    tercepat     : ${Math.min(...total).toFixed(1)} dtk`);
    console.log(`    median       : ${p(total, 0.5).toFixed(1)} dtk`);
    console.log(`    p95          : ${p(total, 0.95).toFixed(1)} dtk`);
    console.log(`    terlama      : ${Math.max(...total).toFixed(1)} dtk`);
    console.log(`    lewat ${ANGGARAN} dtk : ${lewat} dari ${total.length}`);
    console.log(
      lewat === 0
        ? `\n  Seluruhnya di bawah anggaran ${ANGGARAN} detik. Sebut ukuran sampelnya saat menyebut angkanya.\n`
        : `\n  ${lewat} kontribusi melewati anggaran. Laporkan apa adanya, jangan dibuang dari hitungan.\n`,
    );
  }
} finally {
  await klien.end();
  connector?.close();
}
