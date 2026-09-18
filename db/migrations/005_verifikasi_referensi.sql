-- Bagian Verification dari skema (docs-20 §1), di atas skema jalur tulis
-- milik Trust (001_trust_schema.sql).
--
-- Bernama 005 mengikuti penomoran 001–004 milik Trust: scripts/setup_db.sh
-- hanya menjalankan db/migrations/00*.sql. Migrasi berikutnya mulai 006.
--
-- Trust sudah membuat `place` (minimal) dan `attribute_type` beserta isinya
-- supaya jalur tulis bisa diuji berdiri sendiri. Dua tabel itu milik
-- Verification, tapi E4, E5, dan data benih sudah memakai kolomnya. Karena itu
-- migrasi ini MELENGKAPI tabel yang ada, tidak membuat ulang:
--   * place          + kolom yang dibutuhkan jalur baca dan aturan profil
--   * attribute_type + label_id (nama kolom lain mengikuti 001: is_required,
--                      ai_suggestion_enabled, min_value/max_value)
--   * tiga tabel aturan profil, baru
--
-- Isi di bagian bawah DIBANGKITKAN dari lib/rules/reference.ts
-- (referenceInsertSql di lib/rules/sql.ts). Tes lib/rules/sql.test.ts gagal
-- kalau berkas ini bergeser dari reference.ts. Mengubah aturan = ubah
-- reference.ts, bangkitkan ulang, lalu tulis migrasi BARU — jangan sunting
-- migrasi yang sudah diterapkan.
--
-- Tidak ada kolom penilaian, skor, atau status di mana pun (00-KONTRAK §2
-- aturan 1 dan 3). Penilaian dihitung saat request oleh lib/rules/engine.ts.

do $$ begin create type profile_code as enum ('kursi_roda_manual', 'alat_bantu_jalan', 'netra'); exception when duplicate_object then null; end $$;
do $$ begin create type place_source as enum ('osm_seed', 'manual'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_verdict as enum ('blocker', 'caution'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_subject_type as enum ('attribute', 'place_property'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_operator as enum ('eq', 'neq', 'gte', 'lte', 'in', 'not_in'); exception when duplicate_object then null; end $$;

-- ── place: kolom docs-20 §1 yang belum ada di versi minimal 001 ──────────
alter table place add column if not exists category text;
alter table place add column if not exists address text;
-- Wajib tampil sebagai atribusi (OSM: ODbL, atribusi + share-alike). Baris
-- yang sudah ada (data benih demo) menjadi 'manual'; hasil seeding OSM 'osm_seed'.
alter table place add column if not exists source place_source not null default 'manual';
-- Dipakai aturan lift dan himpunan minimum bersyarat.
alter table place add column if not exists layanan_di_atas_lantai_dasar boolean not null default false;
-- Tag OSM yang berupa penilaian (misal wheelchair). Hanya tampil di audit,
-- tidak pernah menggerakkan penilaian.
alter table place add column if not exists third_party_claims jsonb;
create unique index if not exists place_osm_unik on place (osm_type, osm_id);

-- ── attribute_type: label untuk manusia ─────────────────────────────────
alter table attribute_type add column if not exists label_id text;

-- ── Aturan profil ───────────────────────────────────────────────────────
-- Tidak ada verdict `irrelevant`: "tidak berpengaruh" = tidak ada baris.
create table profile_rule_group (
  id text primary key,
  profile_code profile_code not null,
  verdict rule_verdict not null,
  message_id text not null,
  priority integer not null
);

-- Semua kondisi dalam satu grup digabung AND, tidak pernah OR.
create table profile_rule_condition (
  id text primary key,
  group_id text not null references profile_rule_group (id) on delete cascade,
  subject_type rule_subject_type not null,
  subject_code text not null,
  operator rule_operator not null,
  value text not null
);

-- Ditulis eksplisit per profil, tidak diturunkan dari grup blocker
-- (PERUBAHAN.md entri 10).
create table profile_minimum_attribute (
  profile_code profile_code not null,
  attribute_code text not null references attribute_type (code),
  required_when_property text,
  required_when_value text,
  primary key (profile_code, attribute_code),
  check ((required_when_property is null) = (required_when_value is null))
);

-- Hak akses: 001 mencabut semua hak dari PUBLIC. Peran aplikasi hanya membaca
-- aturan; mengubah aturan lewat migrasi, bukan lewat aplikasi.
grant select on profile_rule_group, profile_rule_condition, profile_minimum_attribute to app_rw;

-- ── Data acuan, dibangkitkan dari lib/rules/reference.ts ──────────────────
update attribute_type set label_id = 'Anak tangga di pintu masuk' where code = 'step_count';
update attribute_type set label_id = 'Ramp di pintu masuk' where code = 'ramp_wheelchair';
update attribute_type set label_id = 'Tepi trotoar di depan pintu masuk' where code = 'kerb';
update attribute_type set label_id = 'Lebar pintu masuk' where code = 'door_width_band';
update attribute_type set label_id = 'Permukaan menuju pintu masuk' where code = 'surface_condition';
update attribute_type set label_id = 'Jalur pemandu' where code = 'tactile_paving';
update attribute_type set label_id = 'Lift' where code = 'elevator_status';
update attribute_type set label_id = 'Toilet kursi roda' where code = 'toilets_wheelchair';

insert into profile_rule_group (id, profile_code, verdict, message_id, priority) values
  ('kursi_tangga_tanpa_ramp', 'kursi_roda_manual', 'blocker', 'tangga_tanpa_ramp', 10),
  ('alat_tangga_tanpa_ramp', 'alat_bantu_jalan', 'caution', 'tangga_tanpa_ramp', 10),
  ('kursi_pintu_sempit', 'kursi_roda_manual', 'blocker', 'pintu_sempit', 20),
  ('kursi_kerb_tinggi', 'kursi_roda_manual', 'blocker', 'kerb_tinggi', 30),
  ('alat_kerb_tinggi', 'alat_bantu_jalan', 'caution', 'kerb_tinggi', 30),
  ('netra_kerb_tinggi', 'netra', 'caution', 'kerb_tinggi', 30),
  ('kursi_lift_mati', 'kursi_roda_manual', 'blocker', 'lift_mati', 40),
  ('alat_lift_mati', 'alat_bantu_jalan', 'caution', 'lift_mati', 40),
  ('netra_tanpa_jalur_pemandu', 'netra', 'caution', 'tanpa_jalur_pemandu', 20),
  ('kursi_permukaan_buruk', 'kursi_roda_manual', 'caution', 'permukaan_buruk', 50),
  ('alat_permukaan_buruk', 'alat_bantu_jalan', 'caution', 'permukaan_buruk', 50),
  ('netra_permukaan_buruk', 'netra', 'caution', 'permukaan_buruk', 50);

insert into profile_rule_condition (id, group_id, subject_type, subject_code, operator, value) values
  ('kursi_tangga_tanpa_ramp__1', 'kursi_tangga_tanpa_ramp', 'attribute', 'step_count', 'gte', '1'),
  ('kursi_tangga_tanpa_ramp__2', 'kursi_tangga_tanpa_ramp', 'attribute', 'ramp_wheelchair', 'neq', 'yes'),
  ('alat_tangga_tanpa_ramp__1', 'alat_tangga_tanpa_ramp', 'attribute', 'step_count', 'gte', '1'),
  ('alat_tangga_tanpa_ramp__2', 'alat_tangga_tanpa_ramp', 'attribute', 'ramp_wheelchair', 'neq', 'yes'),
  ('kursi_pintu_sempit__1', 'kursi_pintu_sempit', 'attribute', 'door_width_band', 'eq', 'lt80'),
  ('kursi_kerb_tinggi__1', 'kursi_kerb_tinggi', 'attribute', 'kerb', 'eq', 'raised'),
  ('alat_kerb_tinggi__1', 'alat_kerb_tinggi', 'attribute', 'kerb', 'eq', 'raised'),
  ('netra_kerb_tinggi__1', 'netra_kerb_tinggi', 'attribute', 'kerb', 'eq', 'raised'),
  ('kursi_lift_mati__1', 'kursi_lift_mati', 'attribute', 'elevator_status', 'eq', 'not_working'),
  ('kursi_lift_mati__2', 'kursi_lift_mati', 'place_property', 'layanan_di_atas_lantai_dasar', 'eq', 'true'),
  ('alat_lift_mati__1', 'alat_lift_mati', 'attribute', 'elevator_status', 'eq', 'not_working'),
  ('alat_lift_mati__2', 'alat_lift_mati', 'place_property', 'layanan_di_atas_lantai_dasar', 'eq', 'true'),
  ('netra_tanpa_jalur_pemandu__1', 'netra_tanpa_jalur_pemandu', 'attribute', 'tactile_paving', 'eq', 'no'),
  ('kursi_permukaan_buruk__1', 'kursi_permukaan_buruk', 'attribute', 'surface_condition', 'in', 'uneven,damaged'),
  ('alat_permukaan_buruk__1', 'alat_permukaan_buruk', 'attribute', 'surface_condition', 'in', 'uneven,damaged'),
  ('netra_permukaan_buruk__1', 'netra_permukaan_buruk', 'attribute', 'surface_condition', 'in', 'uneven,damaged');

insert into profile_minimum_attribute (profile_code, attribute_code, required_when_property, required_when_value) values
  ('kursi_roda_manual', 'step_count', null, null),
  ('kursi_roda_manual', 'ramp_wheelchair', null, null),
  ('kursi_roda_manual', 'door_width_band', null, null),
  ('kursi_roda_manual', 'kerb', null, null),
  ('kursi_roda_manual', 'surface_condition', null, null),
  ('kursi_roda_manual', 'elevator_status', 'layanan_di_atas_lantai_dasar', 'true'),
  ('alat_bantu_jalan', 'step_count', null, null),
  ('alat_bantu_jalan', 'ramp_wheelchair', null, null),
  ('alat_bantu_jalan', 'kerb', null, null),
  ('alat_bantu_jalan', 'surface_condition', null, null),
  ('alat_bantu_jalan', 'elevator_status', 'layanan_di_atas_lantai_dasar', 'true'),
  ('netra', 'kerb', null, null),
  ('netra', 'tactile_paving', null, null),
  ('netra', 'surface_condition', null, null);

-- Semua atribut sudah berlabel; atribut baru wajib membawa label.
alter table attribute_type alter column label_id set not null;
