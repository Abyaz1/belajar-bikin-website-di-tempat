-- Tabel milik Verification (docs-20 §1): place, attribute_type,
-- profile_rule_group, profile_rule_condition, profile_minimum_attribute.
--
-- Isi referensi di bagian bawah DIBANGKITKAN dari lib/rules/reference.ts
-- (referenceInsertSql di lib/rules/sql.ts). Tes lib/rules/sql.test.ts gagal
-- kalau berkas ini bergeser dari reference.ts. Mengubah aturan = ubah
-- reference.ts, bangkitkan ulang, lalu tulis migrasi baru — jangan sunting
-- migrasi yang sudah diterapkan.
--
-- Tidak ada kolom penilaian, skor, atau status di mana pun (00-KONTRAK §2
-- aturan 1 dan 3). Penilaian dihitung saat request oleh lib/rules/engine.ts.

-- Tipe bersama. Dibuat idempoten karena tabel Trust (capture_session,
-- evidence) juga memakai `vantage`.
do $$ begin create type profile_code as enum ('kursi_roda_manual', 'alat_bantu_jalan', 'netra'); exception when duplicate_object then null; end $$;
do $$ begin create type vantage as enum ('entrance', 'interior', 'toilet'); exception when duplicate_object then null; end $$;
do $$ begin create type place_source as enum ('osm_seed', 'manual'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_verdict as enum ('blocker', 'caution'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_subject_type as enum ('attribute', 'place_property'); exception when duplicate_object then null; end $$;
do $$ begin create type rule_operator as enum ('eq', 'neq', 'gte', 'lte', 'in', 'not_in'); exception when duplicate_object then null; end $$;

create table place (
  id uuid primary key default gen_random_uuid(),
  osm_type text,
  osm_id bigint,
  name text not null,
  category text,
  lat numeric(9, 6) not null,
  lon numeric(9, 6) not null,
  address text,
  -- Wajib tampil sebagai atribusi (OSM: ODbL, atribusi + share-alike).
  source place_source not null,
  -- Dipakai aturan lift dan himpunan minimum bersyarat.
  layanan_di_atas_lantai_dasar boolean not null default false,
  -- Tag OSM yang berupa penilaian (misal wheelchair). Hanya tampil di audit,
  -- tidak pernah menggerakkan penilaian.
  third_party_claims jsonb,
  is_demo_seed boolean not null default false,
  unique (osm_type, osm_id)
);

-- Kamus atribut 00-KONTRAK §3. Disimpan di tabel, bukan di kode.
create table attribute_type (
  code text primary key,
  value_type text not null check (value_type in ('integer', 'enum')),
  allowed_values text[] not null,
  vantage vantage not null,
  is_required_at_vantage boolean not null,
  review_interval_days integer not null check (review_interval_days > 0),
  -- Gerbang precision: bisa dimatikan tanpa deploy ulang, misalnya
  --   update attribute_type set ai_suggestable = false where code = 'tactile_paving';
  -- Hanya tiga atribut yang precision-nya diukur yang boleh menyala.
  ai_suggestable boolean not null default false
    check (not ai_suggestable or code in ('step_count', 'ramp_wheelchair', 'tactile_paving')),
  label_id text not null
);

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

-- ── Data acuan, dibangkitkan dari lib/rules/reference.ts ──────────────────
insert into attribute_type (code, value_type, allowed_values, vantage, is_required_at_vantage, review_interval_days, ai_suggestable, label_id) values
  ('step_count', 'integer', array['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']::text[], 'entrance', true, 365, true, 'Anak tangga di pintu masuk'),
  ('ramp_wheelchair', 'enum', array['yes', 'no']::text[], 'entrance', true, 365, true, 'Ramp di pintu masuk'),
  ('kerb', 'enum', array['flush', 'lowered', 'raised']::text[], 'entrance', false, 365, false, 'Tepi trotoar di depan pintu masuk'),
  ('door_width_band', 'enum', array['lt80', '80_90', 'gt90']::text[], 'entrance', false, 365, false, 'Lebar pintu masuk'),
  ('surface_condition', 'enum', array['good', 'uneven', 'damaged']::text[], 'entrance', false, 365, false, 'Permukaan menuju pintu masuk'),
  ('tactile_paving', 'enum', array['yes', 'no']::text[], 'entrance', false, 365, true, 'Jalur pemandu'),
  ('elevator_status', 'enum', array['none', 'working', 'not_working']::text[], 'interior', false, 90, false, 'Lift'),
  ('toilets_wheelchair', 'enum', array['yes', 'no']::text[], 'toilet', false, 365, false, 'Toilet kursi roda');

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
