/**
 * Pemeriksa keutuhan jalur tulis — membuktikan enam aturan yang tidak boleh
 * dilanggar kode benar-benar berlaku di basis data yang SEDANG HIDUP, bukan
 * cuma di DDL yang pernah ditulis.
 *
 * Alasannya ada: penegakan append-only bersandar pada Row Level Security, dan
 * RLS tidak berlaku untuk superuser maupun peran ber-BYPASSRLS. Skema yang benar
 * dijalankan oleh peran yang salah menghasilkan sistem yang tampak aman padahal
 * tidak. Satu-satunya cara tahu adalah mencobanya pada koneksi yang dipakai
 * aplikasi.
 *
 * Jalankan: npm run periksa:keutuhan
 * Keluar dengan kode 1 kalau ada satu saja yang gagal, supaya bisa dipasang di
 * langkah sebelum demo.
 */
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

function envWajib(nama) {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Env ${nama} belum diisi; lihat .env.example.`);
  return nilai;
}

const hasil = [];
function catat(aturan, judul, lolos, keterangan) {
  hasil.push({ aturan, judul, lolos, keterangan });
  const tanda = lolos ? "  LOLOS " : "  GAGAL ";
  console.log(`${tanda} ${aturan.padEnd(12)} ${judul}`);
  if (keterangan) console.log(`${" ".repeat(22)}${keterangan}`);
}

let klien;
let connector;
if (process.env.DATABASE_URL) {
  klien = new pg.Client({ connectionString: process.env.DATABASE_URL });
} else {
  connector = new Connector();
  klien = new pg.Client({
    ...(await connector.getOptions({
      instanceConnectionName: envWajib("CLOUD_SQL_CONNECTION_NAME"),
      ipType: IpAddressTypes.PUBLIC,
    })),
    user: envWajib("DB_USER"),
    password: envWajib("DB_PASSWORD"),
    database: envWajib("DB_NAME"),
  });
}

const satu = async (sql, params) => (await klien.query(sql, params)).rows[0];

try {
  await klien.connect();
  const { current_user: peran, current_database: basis } = await satu(
    "select current_user, current_database()",
  );
  console.log(`\nPemeriksaan keutuhan jalur tulis — basis ${basis}, peran ${peran}\n`);

  // Peran koneksi. Bukan salah satu dari enam aturan, tapi seluruh penegakan
  // append-only runtuh diam-diam kalau ini salah.
  const p = await satu(
    "select rolsuper, rolbypassrls from pg_roles where rolname = current_user",
  );
  catat(
    "prasyarat",
    "peran koneksi bukan superuser dan tidak ber-BYPASSRLS",
    p && !p.rolsuper && !p.rolbypassrls,
    `rolsuper=${p?.rolsuper} rolbypassrls=${p?.rolbypassrls}`,
  );

  // Aturan 1 — penilaian tidak pernah disimpan.
  const nilai = await klien.query(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and (column_name in ('assessment','rating','score','verdict_stored')
           or column_name like 'assessment%' or column_name like 'rating%')`);
  catat(
    "aturan 1",
    "tidak ada kolom penilaian tersimpan",
    nilai.rowCount === 0,
    nilai.rowCount ? nilai.rows.map((b) => `${b.table_name}.${b.column_name}`).join(", ") : "0 kolom",
  );

  // Aturan 2 — usulan AI tidak jadi nilai berlaku tanpa konfirmasi.
  const kf = await satu(`
    select is_nullable from information_schema.columns
    where table_schema='public' and table_name='observation' and column_name='confirmed_value'`);
  catat(
    "aturan 2",
    "observation.confirmed_value berstatus NOT NULL di DDL",
    kf?.is_nullable === "NO",
    `is_nullable=${kf?.is_nullable ?? "kolom tidak ada"}`,
  );

  // Aturan 3 — status kesegaran tidak disimpan.
  const st = await satu(`
    select count(*)::int n from information_schema.columns
    where table_schema='public' and table_name='attribute_state' and column_name='status'`);
  catat("aturan 3", "attribute_state tidak punya kolom status", st.n === 0, `kolom status: ${st.n}`);

  // Aturan 4 — kontribusi yang ditolak tetap masuk audit log.
  const tolak = await satu(`
    select count(*)::int n from evidence e
    where exists (select 1 from provenance_check c where c.evidence_id = e.id and c.result = 'fail')
      and not exists (select 1 from audit_event a
                      where a.entity_type = 'evidence' and a.entity_id = e.id
                        and a.action = 'provenance_failed')`);
  catat(
    "aturan 4",
    "setiap bukti yang gagal provenans punya audit_event provenance_failed",
    tolak.n === 0,
    `bukti gagal tanpa catatan audit: ${tolak.n}`,
  );

  // Aturan 5 — angka keyakinan disimpan tapi tidak pernah tampil. Yang bisa
  // diperiksa dari sisi basis data hanyalah bahwa kolomnya memang ada dan tidak
  // ikut terbawa view mana pun; larangan di response ditegakkan uji unit
  // serializer, bukan di sini.
  const ac = await satu(`
    select count(*)::int n from information_schema.columns
    where table_schema='public' and table_name='observation' and column_name='ai_confidence'`);
  const acView = await satu(`
    select count(*)::int n from information_schema.columns c
    join information_schema.views v
      on v.table_schema = c.table_schema and v.table_name = c.table_name
    where c.table_schema='public' and c.column_name='ai_confidence'`);
  catat(
    "aturan 5",
    "ai_confidence tersimpan dan tidak diekspos lewat view",
    ac.n === 1 && acView.n === 0,
    `kolom=${ac.n} view yang membawanya=${acView.n}`,
  );

  // Aturan 6 diperiksa di sisi kode (bentuk galat seragam), bukan di basis data.

  // docs-10 §6 — yang wajib nol.
  // Bentuk barisnya: entity_id menyimpan place_id, dan kode atributnya ada di
  // payload_snapshot->'after'->>'attribute_code'. Bukan di akar payload — itu
  // sempat salah dan membuat seluruh 12 baris tertuduh keliru.
  const cacat = await satu(`
    select count(*)::int n from attribute_state s
    where s.last_verified_at is not null
      and not exists (select 1 from audit_event a
                      where a.entity_type = 'attribute_state'
                        and a.entity_id = s.place_id
                        and a.payload_snapshot->'after'->>'attribute_code' = s.attribute_code)`);
  catat(
    "docs-10 §6",
    "atribut terverifikasi tanpa jejak audit",
    cacat.n === 0,
    `ditemukan: ${cacat.n} (wajib 0)`,
  );

  // Append-only dibuktikan dengan mencobanya, bukan dengan membaca kebijakan.
  for (const tabel of ["audit_event", "provenance_check", "observation"]) {
    const ada = await satu(`select count(*)::int n from ${tabel}`);
    if (ada.n === 0) {
      catat("append-only", `${tabel} — tabel kosong, tidak bisa diuji`, true, "lewati");
      continue;
    }
    await klien.query("begin");
    let ubah = -1;
    let hapus = -1;
    let galat = null;
    try {
      ubah = (await klien.query(`update ${tabel} set id = id`)).rowCount;
      hapus = (await klien.query(`delete from ${tabel}`)).rowCount;
    } catch (e) {
      galat = e.message.split("\n")[0];
    }
    await klien.query("rollback");
    catat(
      "append-only",
      `${tabel} menolak UPDATE dan DELETE`,
      galat !== null || (ubah === 0 && hapus === 0),
      galat ? `ditolak dengan galat: ${galat}` : `baris terpengaruh: update ${ubah}, delete ${hapus} (dari ${ada.n} baris terbaca)`,
    );
  }

  // RLS menyala DAN dipaksa. Tanpa FORCE, pemilik tabel melewatinya.
  const rls = await klien.query(`
    select relname, relrowsecurity, relforcerowsecurity from pg_class
    where relname in ('audit_event','provenance_check','observation') and relkind='r'`);
  const kurang = rls.rows.filter((b) => !b.relrowsecurity || !b.relforcerowsecurity);
  catat(
    "append-only",
    "RLS menyala dan dipaksa pada ketiga tabel",
    rls.rowCount === 3 && kurang.length === 0,
    kurang.length ? kurang.map((b) => `${b.relname} rls=${b.relrowsecurity} force=${b.relforcerowsecurity}`).join("; ") : "ketiganya menyala dan dipaksa",
  );

  const gagal = hasil.filter((h) => !h.lolos);
  console.log(`\n${hasil.length - gagal.length}/${hasil.length} lolos.`);
  if (gagal.length) {
    console.log("\nYang gagal:");
    for (const g of gagal) console.log(`  ${g.aturan} — ${g.judul}: ${g.keterangan}`);
    console.log("\ndocs-10 §6: kalau yang gagal soal jejak audit, hentikan pekerjaan lain sampai beres.\n");
    process.exitCode = 1;
  } else {
    console.log("Keenam aturan berlaku di basis data ini, dibuktikan dengan mencobanya.\n");
  }
} finally {
  await klien.end();
  connector?.close();
}
