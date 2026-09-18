-- =====================================================================
-- 001_trust_schema.sql — jalur tulis (Trust engineer)
-- Rujukan: docs/00-KONTRAK.md §2 §3 §7 · docs/10-trust.md §1
--
-- Keputusan skema yang perlu diketahui pembaca:
--  * Satu schema `public`. Fungsi bantu diberi awalan `trust_`.
--    Alasan: Verification engineer membaca attribute_state dan
--    provenance_check dari jalur baca. Dua schema = dua sumber bug
--    search_path pada jam 3 pagi.
--  * TIDAK ADA kolom penilaian di mana pun (aturan 1).
--  * TIDAK ADA kolom status kesegaran di attribute_state (aturan 3).
--  * observation.confirmed_value NOT NULL adalah constraint database,
--    bukan validasi aplikasi (aturan 2).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Ekstensi dan peran aplikasi
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw NOLOGIN;
  END IF;
END
$$;

-- CATATAN JUJUR, jangan dihapus:
-- RLS tidak berlaku untuk superuser maupun peran ber-BYPASSRLS.
-- Peran koneksi aplikasi WAJIB app_rw (atau turunannya) dan WAJIB bukan
-- superuser. Kalau aplikasi terhubung sebagai postgres, seluruh jaminan
-- append-only di §10 berkas ini tidak berlaku, dan klaim "jejak audit
-- tidak bisa diubah" jadi tidak benar.

-- ---------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------
CREATE TYPE contributor_kind      AS ENUM ('anonymous_session', 'account');
CREATE TYPE vantage_kind          AS ENUM ('entrance', 'interior', 'toilet');
CREATE TYPE check_result          AS ENUM ('pass', 'flag', 'fail');
CREATE TYPE attribute_value_type  AS ENUM ('integer', 'enum');
CREATE TYPE state_source          AS ENUM ('osm_seed', 'contribution');

-- ---------------------------------------------------------------------
-- 2. Tabel rujukan — MILIK VERIFICATION ENGINEER
--    Trust hanya membaca. Dibuat di sini supaya skema jalur tulis bisa
--    dijalankan dan diuji berdiri sendiri. Kalau Verification sudah
--    punya migrasinya, HAPUS blok §2 ini dan pakai punya dia.
-- ---------------------------------------------------------------------

-- 2.1 place (minimal) — sumber koordinat acuan untuk C7
CREATE TABLE IF NOT EXISTS place (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  lat           numeric(9,6)  NOT NULL CHECK (lat  BETWEEN  -90 AND  90),
  lon           numeric(9,6)  NOT NULL CHECK (lon  BETWEEN -180 AND 180),
  osm_type      text        NULL,
  osm_id        bigint      NULL,
  is_demo_seed  boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE place IS
  'Milik Verification engineer. Trust hanya SELECT, untuk koordinat acuan C7.';

-- 2.2 attribute_type — kamus atribut, docs/00-KONTRAK.md §3
-- Kamus disimpan di tabel, BUKAN di kode. Gerbang precision jam 21:00
-- mematikan usulan per atribut lewat ai_suggestion_enabled, tanpa deploy ulang.
CREATE TABLE IF NOT EXISTS attribute_type (
  code                    text PRIMARY KEY,
  value_type              attribute_value_type NOT NULL,
  allowed_values          text[]  NULL,      -- untuk value_type='enum'
  min_value               integer NULL,      -- untuk value_type='integer'
  max_value               integer NULL,
  vantage                 vantage_kind NOT NULL,
  is_required             boolean NOT NULL DEFAULT false,
  ai_suggestion_enabled   boolean NOT NULL DEFAULT false,
  review_interval_days    integer NOT NULL CHECK (review_interval_days > 0),
  sort_order              integer NOT NULL DEFAULT 0,

  -- Bentuk kamus harus konsisten dengan tipenya, ditegakkan database
  CONSTRAINT attribute_type_shape CHECK (
    (value_type = 'enum'
       AND allowed_values IS NOT NULL AND array_length(allowed_values,1) > 0
       AND min_value IS NULL AND max_value IS NULL)
    OR
    (value_type = 'integer'
       AND allowed_values IS NULL
       AND min_value IS NOT NULL AND max_value IS NOT NULL
       AND min_value <= max_value)
  ),
  -- 'not_visible' sah di level observation untuk atribut mana pun, dan
  -- karena itu TIDAK boleh ikut ditulis di allowed_values. Kalau ikut,
  -- dia akan lolos jadi current_value dan membentuk attribute_state.
  CONSTRAINT attribute_type_no_not_visible CHECK (
    allowed_values IS NULL OR NOT ('not_visible' = ANY (allowed_values))
  )
);
COMMENT ON COLUMN attribute_type.ai_suggestion_enabled IS
  'Gerbang precision 0,85 per atribut. Dimatikan per atribut, bukan global.';

INSERT INTO attribute_type
  (code, value_type, allowed_values, min_value, max_value,
   vantage, is_required, ai_suggestion_enabled, review_interval_days, sort_order)
VALUES
  ('step_count',        'integer', NULL,                                   0, 20,
   'entrance', true,  true,  365, 10),
  ('ramp_wheelchair',   'enum',    ARRAY['yes','no'],                   NULL, NULL,
   'entrance', true,  true,  365, 20),
  ('kerb',              'enum',    ARRAY['flush','lowered','raised'],   NULL, NULL,
   'entrance', false, false, 365, 30),
  ('door_width_band',   'enum',    ARRAY['lt80','80_90','gt90'],        NULL, NULL,
   'entrance', false, false, 365, 40),
  ('surface_condition', 'enum',    ARRAY['good','uneven','damaged'],    NULL, NULL,
   'entrance', false, false, 365, 50),
  ('tactile_paving',    'enum',    ARRAY['yes','no'],                   NULL, NULL,
   'entrance', false, true,  365, 60),
  ('elevator_status',   'enum',    ARRAY['none','working','not_working'], NULL, NULL,
   'interior', false, false,  90, 70),
  ('toilets_wheelchair','enum',    ARRAY['yes','no'],                   NULL, NULL,
   'toilet',   false, false, 365, 80)
ON CONFLICT (code) DO NOTHING;

-- Pagar aturan "hanya tiga atribut yang boleh dapat usulan AI".
-- Ditegakkan database supaya tidak bisa longgar diam-diam lewat UPDATE.
CREATE OR REPLACE FUNCTION trust_assert_suggestion_whitelist()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ai_suggestion_enabled
     AND NEW.code NOT IN ('step_count','ramp_wheelchair','tactile_paving') THEN
    RAISE EXCEPTION
      'Atribut % tidak boleh mendapat usulan AI (docs/00-KONTRAK.md §3)', NEW.code
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS attribute_type_suggestion_whitelist ON attribute_type;
CREATE TRIGGER attribute_type_suggestion_whitelist
  BEFORE INSERT OR UPDATE ON attribute_type
  FOR EACH ROW EXECUTE FUNCTION trust_assert_suggestion_whitelist();

-- ---------------------------------------------------------------------
-- 3. contributor
-- ---------------------------------------------------------------------
CREATE TABLE contributor (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            contributor_kind NOT NULL DEFAULT 'anonymous_session',
  display_handle  text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN contributor.display_handle IS
  'Bentuk anonim untuk audit publik, misal "Kontributor #7". Tidak ada PII di tabel ini.';

-- ---------------------------------------------------------------------
-- 4. capture_session — token sekali pakai (C0)
-- ---------------------------------------------------------------------
CREATE TABLE capture_session (
  token           text PRIMARY KEY CHECK (length(token) >= 32),
  contributor_id  uuid NOT NULL REFERENCES contributor(id),
  place_id        uuid NOT NULL REFERENCES place(id),
  vantage         vantage_kind NOT NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  used_at         timestamptz NULL,
  CONSTRAINT capture_session_used_after_issued
    CHECK (used_at IS NULL OR used_at >= issued_at)
);
COMMENT ON TABLE capture_session IS
  'Token acak tak tertebak. Terikat ke place+vantage sebelum foto diambil. '
  'Sekali pakai. issued_at memakai jam server, bukan jam klien.';

CREATE INDEX capture_session_contributor_idx
  ON capture_session (contributor_id, issued_at DESC);

-- ---------------------------------------------------------------------
-- 5. evidence
-- ---------------------------------------------------------------------
CREATE TABLE evidence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id              uuid NOT NULL REFERENCES place(id),
  vantage               vantage_kind NOT NULL,
  contributor_id        uuid NOT NULL REFERENCES contributor(id),

  -- satu token satu bukti, ditegakkan database, bukan aplikasi
  capture_token         text NOT NULL UNIQUE REFERENCES capture_session(token),

  storage_path          text NOT NULL,          -- objek asli di GCS, TIDAK publik
  public_path           text NULL,              -- objek tayang setelah blur wajah
  phash                 text NOT NULL
                          CHECK (phash ~ '^[0-9a-f]{16}$'),  -- 64 bit, hex huruf kecil

  client_lat            numeric(9,6)  NULL CHECK (client_lat BETWEEN  -90 AND  90),
  client_lon            numeric(9,6)  NULL CHECK (client_lon BETWEEN -180 AND 180),
  client_accuracy_m     numeric(7,2)  NULL CHECK (client_accuracy_m >= 0),
  client_fix_at         timestamptz   NULL,
  client_captured_at    timestamptz   NOT NULL,
  server_received_at    timestamptz   NOT NULL DEFAULT now(),
  distance_to_place_m   numeric(9,2)  NULL CHECK (distance_to_place_m >= 0),

  exif_present          boolean NOT NULL,
  exif_gps_present      boolean NOT NULL,
  capture_method        text    NOT NULL,

  is_demo_seed          boolean NOT NULL DEFAULT false,

  CONSTRAINT evidence_geo_pair CHECK (
    (client_lat IS NULL) = (client_lon IS NULL)
  )
);

COMMENT ON COLUMN evidence.capture_method IS
  'DICATAT, BUKAN DIPERIKSA. Nilainya dinyatakan klien; penyerang tinggal '
  'menulis "getusermedia" dan mengirim JPEG bersih. Jangan pernah dipakai '
  'sebagai gerbang validasi. Yang menggantikan perannya adalah C0.';
COMMENT ON COLUMN evidence.client_accuracy_m IS
  'Wajib disimpan DAN ditampilkan. Ini angka yang bikin radius efektif C7 '
  'bisa dipertanggungjawabkan ke juri.';
COMMENT ON COLUMN evidence.client_lat IS
  'Dinyatakan klien. Bisa dipalsukan. Disimpan apa adanya, tidak diperlakukan '
  'sebagai kebenaran.';
COMMENT ON COLUMN evidence.storage_path IS
  'Objek asli, TIDAK boleh dilayani publik. Yang tayang adalah public_path.';

-- C1 rate limit: hitung per kontributor dalam satu jam terakhir.
-- Kontribusi yang DITOLAK tetap punya baris evidence, jadi tetap dihitung.
CREATE INDEX evidence_rate_limit_idx
  ON evidence (contributor_id, server_received_at DESC);

-- C8 konteks: tempat + vantage sama
CREATE INDEX evidence_place_vantage_idx
  ON evidence (place_id, vantage);

CREATE INDEX evidence_received_idx
  ON evidence (server_received_at DESC);

-- ---------------------------------------------------------------------
-- 6. provenance_check — append-only, isi jejak audit
-- ---------------------------------------------------------------------
CREATE TABLE provenance_check (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id  uuid NOT NULL REFERENCES evidence(id),
  check_code   text NOT NULL
                 CHECK (check_code IN ('C0','C1','C3','C4','C5','C6','C6b','C7','C8')),
  result       check_result NOT NULL,
  measured     text NULL,
  threshold    text NULL,
  is_demo_seed boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- satu hasil per pemeriksaan per bukti; menolak pipeline yang jalan dua kali
  CONSTRAINT provenance_check_once UNIQUE (evidence_id, check_code)
);

CREATE INDEX provenance_check_evidence_idx ON provenance_check (evidence_id);
CREATE INDEX provenance_check_fail_idx
  ON provenance_check (evidence_id) WHERE result = 'fail';

COMMENT ON TABLE provenance_check IS
  'Append-only. Ditulis untuk SETIAP kontribusi, termasuk yang ditolak. '
  'Kesembilan pemeriksaan dijalankan semua, tidak berhenti di kegagalan pertama.';

-- ---------------------------------------------------------------------
-- 7. observation — HANYA E5 yang boleh menulis ke sini
-- ---------------------------------------------------------------------
CREATE TABLE observation (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id           uuid NOT NULL REFERENCES place(id),
  attribute_code     text NOT NULL REFERENCES attribute_type(code),
  evidence_id        uuid NOT NULL REFERENCES evidence(id),
  contributor_id     uuid NOT NULL REFERENCES contributor(id),

  ai_suggested_value text    NULL,
  ai_confidence      numeric(4,3) NULL CHECK (ai_confidence BETWEEN 0 AND 1),

  -- INI ATURAN 2 DALAM BENTUK TEKNIS. Jangan pernah diubah jadi NULL-able.
  confirmed_value    text    NOT NULL CHECK (length(trim(confirmed_value)) > 0),

  was_corrected      boolean GENERATED ALWAYS AS (
                       ai_suggested_value IS NOT NULL
                       AND confirmed_value IS DISTINCT FROM ai_suggested_value
                     ) STORED,
  observed_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT observation_once_per_attribute UNIQUE (evidence_id, attribute_code)
);

COMMENT ON COLUMN observation.confirmed_value IS
  'NOT NULL adalah constraint database, bukan validasi aplikasi. Itu bentuk '
  'teknis dari "AI adalah asisten, bukan otoritas". Boleh berisi not_visible.';
COMMENT ON COLUMN observation.ai_confidence IS
  'DISIMPAN, TIDAK DITAMPILKAN (aturan 5). Dilarang masuk response payload '
  'mana pun. Serializer wajib memakai allow-list kolom, bukan SELECT *.';

CREATE INDEX observation_state_idx
  ON observation (place_id, attribute_code, observed_at DESC);
CREATE INDEX observation_evidence_idx ON observation (evidence_id);
CREATE INDEX observation_contributor_idx ON observation (contributor_id);

-- ---------------------------------------------------------------------
-- 8. attribute_state
--    TIDAK ADA KOLOM status. Kesegaran diturunkan saat baca (aturan 3).
-- ---------------------------------------------------------------------
CREATE TABLE attribute_state (
  place_id              uuid NOT NULL REFERENCES place(id),
  attribute_code        text NOT NULL REFERENCES attribute_type(code),
  current_value         text NOT NULL,
  is_disputed           boolean NOT NULL DEFAULT false,
  previous_value        text NULL,
  previous_observed_at  timestamptz NULL,
  corroboration_count   integer NOT NULL DEFAULT 0 CHECK (corroboration_count >= 0),
  source                state_source NOT NULL,
  last_verified_at      timestamptz NULL,
  next_review_at        timestamptz NULL,
  is_demo_seed          boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (place_id, attribute_code),

  -- not_visible dicatat di observation, tapi tidak membentuk state
  CONSTRAINT attribute_state_not_visible_excluded
    CHECK (current_value <> 'not_visible'),
  -- seed OSM tidak punya bukti, jadi tidak punya waktu verifikasi
  CONSTRAINT attribute_state_seed_unverified
    CHECK (source <> 'osm_seed' OR last_verified_at IS NULL),
  -- next_review_at tidak berdiri sendiri
  CONSTRAINT attribute_state_review_pair
    CHECK ((last_verified_at IS NULL) = (next_review_at IS NULL)),
  CONSTRAINT attribute_state_previous_pair
    CHECK ((previous_value IS NULL) = (previous_observed_at IS NULL))
);

COMMENT ON TABLE attribute_state IS
  'TIDAK ADA kolom status. belum_terverifikasi / terverifikasi / '
  'perlu_ditinjau_ulang diturunkan saat baca lewat trust_derive_status(). '
  'Menambahkan kolom status di sini adalah pelanggaran aturan 3.';

CREATE INDEX attribute_state_place_idx ON attribute_state (place_id);
CREATE INDEX attribute_state_review_idx ON attribute_state (next_review_at)
  WHERE next_review_at IS NOT NULL;

-- Pagar aturan 3, dijalankan tiap migrasi. Kalau ada yang menambahkan
-- kolom status, migrasi berikutnya gagal keras, bukan gagal senyap.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'attribute_state'
      AND column_name IN ('status','freshness','freshness_status','state')
  ) THEN
    RAISE EXCEPTION
      'attribute_state tidak boleh punya kolom status. Aturan 3 docs/00-KONTRAK.md §2';
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 9. audit_event — append-only
-- ---------------------------------------------------------------------
CREATE TABLE audit_event (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      text NOT NULL
                     CHECK (entity_type IN
                       ('evidence','observation','attribute_state','capture_session','contributor')),
  entity_id        uuid NOT NULL,
  action           text NOT NULL
                     CHECK (action IN (
                       'session_created',
                       'evidence_submitted',
                       'provenance_failed',
                       'observation_confirmed',
                       'state_updated',
                       'rate_limit_reset')),
  actor            text NOT NULL,   -- display_handle kontributor anonim, atau 'system'
  payload_snapshot jsonb NOT NULL,  -- { "before": ..., "after": ... }
  is_demo_seed     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_event_snapshot_shape
    CHECK (payload_snapshot ?& ARRAY['before','after'])
);

CREATE INDEX audit_event_entity_idx
  ON audit_event (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_event_action_idx ON audit_event (action, created_at DESC);

COMMENT ON COLUMN audit_event.actor IS
  'Bentuk anonim. Jangan pernah menaruh IP, user agent, atau apa pun yang '
  'bisa mengidentifikasi orang — jejak audit ini terbuka untuk publik.';

-- ---------------------------------------------------------------------
-- 10. Penegakan append-only — tiga lapis
--     (a) RLS tanpa policy UPDATE/DELETE  → ditolak
--     (b) REVOKE                          → menahan TRUNCATE, yang tidak
--                                            disentuh RLS maupun trigger baris
--     (c) trigger                         → tetap berlaku kalau suatu saat
--                                            ada yang meng-GRANT ulang
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trust_deny_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Tabel % bersifat append-only. Operasi % ditolak.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

-- 10.1 audit_event
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE  ROW LEVEL SECURITY;

CREATE POLICY audit_event_select ON audit_event FOR SELECT USING (true);
CREATE POLICY audit_event_insert ON audit_event FOR INSERT WITH CHECK (true);
-- sengaja tanpa policy UPDATE dan DELETE: RLS menolak apa yang tidak diizinkan

CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION trust_deny_mutation();

-- 10.2 provenance_check
ALTER TABLE provenance_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_check FORCE  ROW LEVEL SECURITY;

CREATE POLICY provenance_check_select ON provenance_check FOR SELECT USING (true);
CREATE POLICY provenance_check_insert ON provenance_check FOR INSERT WITH CHECK (true);

CREATE TRIGGER provenance_check_append_only
  BEFORE UPDATE OR DELETE ON provenance_check
  FOR EACH ROW EXECUTE FUNCTION trust_deny_mutation();

-- 10.3 observation — bukti yang sudah dikonfirmasi tidak ditulis ulang.
-- Koreksi dilakukan dengan kontribusi tandingan, yang memunculkan
-- penanda sengketa. Itu memang rancangannya.
ALTER TABLE observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation FORCE  ROW LEVEL SECURITY;

CREATE POLICY observation_select ON observation FOR SELECT USING (true);
CREATE POLICY observation_insert ON observation FOR INSERT WITH CHECK (true);

CREATE TRIGGER observation_append_only
  BEFORE UPDATE OR DELETE ON observation
  FOR EACH ROW EXECUTE FUNCTION trust_deny_mutation();

-- ---------------------------------------------------------------------
-- 11. Hak akses — sesempit yang masih bisa jalan
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_rw;

-- baca: semua
GRANT SELECT ON place, attribute_type, contributor, capture_session, evidence,
                provenance_check, observation, attribute_state, audit_event
  TO app_rw;

-- tulis
GRANT INSERT ON contributor, capture_session, evidence,
                provenance_check, observation, audit_event, attribute_state TO app_rw;

-- ubah: hanya tiga hal, dan dua di antaranya per kolom
GRANT UPDATE (used_at)      ON capture_session TO app_rw;  -- sekali pakai
GRANT UPDATE (public_path)  ON evidence        TO app_rw;  -- hasil blur wajah
GRANT UPDATE                ON attribute_state TO app_rw;  -- mesin status

-- hapus: tidak satu pun tabel. Tidak ada GRANT DELETE di berkas ini,
-- dan itu disengaja.

-- ---------------------------------------------------------------------
-- 12. Kesegaran diturunkan, tidak disimpan (aturan 3).
--     SATU fungsi, dipakai semua jalur baca — Trust maupun Verification.
--     Kalau ada jalur baca yang menghitung sendiri, itu bug.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trust_derive_status(
  p_last_verified_at timestamptz,
  p_next_review_at   timestamptz,
  p_now              timestamptz DEFAULT now()
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN p_last_verified_at IS NULL     THEN 'belum_terverifikasi'
    WHEN p_next_review_at   IS NULL     THEN 'belum_terverifikasi'
    WHEN p_next_review_at   <  p_now    THEN 'perlu_ditinjau_ulang'
    ELSE                                     'terverifikasi'
  END;
$$;

CREATE OR REPLACE VIEW attribute_state_read AS
SELECT
  s.place_id,
  s.attribute_code,
  s.current_value,
  s.is_disputed,
  s.previous_value,
  s.previous_observed_at,
  s.corroboration_count,
  s.source,
  s.last_verified_at,
  s.next_review_at,
  s.is_demo_seed,
  trust_derive_status(s.last_verified_at, s.next_review_at) AS status
FROM attribute_state s;

GRANT SELECT ON attribute_state_read TO app_rw;

COMMENT ON VIEW attribute_state_read IS
  'Satu-satunya tempat status kesegaran muncul. Jalur baca memakai view ini, '
  'bukan tabelnya langsung. Tidak ada ai_confidence di sini.';

-- ---------------------------------------------------------------------
-- 13. Status draft juga diturunkan, bukan disimpan.
--     Dipakai penegakan E5 langkah 1 dan 2.
--       ditolak     = ada provenance_check result='fail'
--       dikonfirmasi= sudah punya observation
--       terbuka     = selain itu
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW draft_state AS
SELECT
  e.id                AS draft_id,
  e.place_id,
  e.vantage,
  e.contributor_id,
  e.server_received_at,
  CASE
    WHEN EXISTS (SELECT 1 FROM provenance_check pc
                  WHERE pc.evidence_id = e.id AND pc.result = 'fail')
      THEN 'ditolak'
    WHEN EXISTS (SELECT 1 FROM observation o WHERE o.evidence_id = e.id)
      THEN 'dikonfirmasi'
    ELSE 'terbuka'
  END AS status
FROM evidence e;

GRANT SELECT ON draft_state TO app_rw;

COMMENT ON VIEW draft_state IS
  'E5 wajib SELECT ... FROM evidence WHERE id=$1 FOR UPDATE lebih dulu, baru '
  'membaca view ini. Tanpa kunci baris, dua confirm bersamaan bisa lolos '
  'sebelum salah satunya menulis observation.';

COMMIT;
