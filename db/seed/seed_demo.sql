-- =====================================================================
-- seed_demo.sql — data benih demo, SELURUHNYA is_demo_seed = true.
--
-- Idempoten: semua id dipatok, semua INSERT memakai ON CONFLICT DO NOTHING.
-- Aman dijalankan ulang, dan memang harus, karena observation dan audit_event
-- append-only sehingga tidak ada jalan membersihkan lalu mengisi ulang.
--
-- Tanggal dimundurkan relatif terhadap now(), bukan dipatok ke tanggal tetap,
-- supaya seed yang sama tetap memperagakan ketiga status berapa pun hari
-- demonya dijalankan.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Rantai bukti lengkap untuk satu kontribusi demo.
--
-- Atribut terverifikasi tanpa jejak audit adalah cacat, bukan kekurangan.
-- Karena itu seed TIDAK BOLEH menulis attribute_state langsung tanpa
-- membentuk capture_session -> evidence -> provenance_check -> observation
-- -> audit_event di belakangnya. Fungsi ini yang menjamin itu.
--
-- is_demo_seed tidak diparameterkan. Selalu true. Tidak ada jalan memakai
-- fungsi ini untuk membuat data yang menyamar sebagai kontribusi nyata.
-- ---------------------------------------------------------------------
-- make_interval(days => ...) hanya punya varian integer. Parameter ini semula
-- numeric, dan Postgres 15 menolaknya dengan
--   ERROR: function make_interval(days => numeric) does not exist
-- karena numeric tidak di-cast implisit ke integer pada pemanggilan bernama.
-- Hari mundur memang selalu bilangan bulat, jadi int adalah tipe yang benar
-- sejak awal, bukan sekadar penambal.
--
-- DROP di bawah menghapus varian numeric kalau sempat tertinggal dari
-- percobaan sebelumnya. Postgres membedakan fungsi berdasarkan tipe argumen,
-- jadi CREATE OR REPLACE dengan tipe berbeda akan MENAMBAH overload, bukan
-- menggantikan — dan dua overload membuat pemanggilan jadi rawan salah pilih.
DROP FUNCTION IF EXISTS trust_seed_chain(uuid, uuid, vantage, uuid, numeric, jsonb);

CREATE OR REPLACE FUNCTION trust_seed_chain(
  p_evidence_id    uuid,
  p_place_id       uuid,
  p_vantage        vantage,
  p_contributor_id uuid,
  p_days_ago       int,
  p_attrs          jsonb   -- [{"code":..,"confirmed":..,"suggested":..,"confidence":..}]
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  t        timestamptz := now() - make_interval(days => p_days_ago);
  tok      text        := 'seed-' || replace(p_evidence_id::text, '-', '');
  ph       text        := substr(md5(p_evidence_id::text), 1, 16);
  handle   text;
  a        jsonb;
  obs_id   uuid;
  baru     int;
BEGIN
  SELECT display_handle INTO handle FROM contributor WHERE id = p_contributor_id;

  INSERT INTO capture_session (token, contributor_id, place_id, vantage, issued_at, used_at)
  VALUES (tok, p_contributor_id, p_place_id, p_vantage, t - interval '2 minutes', t)
  ON CONFLICT DO NOTHING;

  INSERT INTO evidence (
    id, place_id, vantage, contributor_id,
    claimed_capture_token, capture_session_token,
    storage_path, public_path, phash,
    client_lat, client_lon, client_accuracy_m,
    client_fix_at, client_captured_at, server_received_at,
    distance_to_place_m, exif_present, exif_gps_present, capture_method, is_demo_seed
  )
  SELECT
    p_evidence_id, p_place_id, p_vantage, p_contributor_id,
    tok, tok,
    -- public_path sengaja NULL. Kolom itu untuk objek TAYANG hasil pengaburan
    -- wajah, dan data benih ini tidak punya berkas citra sungguhan di baliknya.
    -- Mengisinya dengan path karangan membuat antarmuka me-render <img> ke
    -- berkas yang tidak ada, dan juri melihat ikon gambar rusak di halaman
    -- yang paling sering dibuka. Kosong lebih jujur daripada rusak.
    'demo/' || p_evidence_id || '.jpg', NULL, ph,
    p.lat, p.lon, 11.0,
    t - interval '8 seconds', t - interval '4 seconds', t,
    9.4, false, false, 'getusermedia', true
  FROM place p WHERE p.id = p_place_id
  ON CONFLICT DO NOTHING;
  -- Bukti yang sudah ada dari jalan sebelumnya tidak dicatat ulang: tanpa
  -- penjaga ini, setiap kali seed dijalankan ulang, audit_event
  -- evidence_submitted bertambah satu baris kembar per bukti.
  GET DIAGNOSTICS baru = ROW_COUNT;

  -- Kesembilan pemeriksaan, semuanya pass, dengan nilai terukur yang masuk akal.
  INSERT INTO provenance_check (evidence_id, check_code, result, measured, threshold, is_demo_seed)
  VALUES
    (p_evidence_id, 'C0',  'pass', '104 dtk',           '600 dtk',                    true),
    (p_evidence_id, 'C1',  'pass', '1 kontribusi/jam',  '10 kontribusi/jam',          true),
    (p_evidence_id, 'C3',  'pass', 'tidak ada EXIF',    'tidak ada EXIF',             true),
    (p_evidence_id, 'C4',  'pass', '4 dtk',             '-60 dtk s.d. 180 dtk',       true),
    (p_evidence_id, 'C5',  'pass', 'koordinat ada',     'koordinat wajib ada',        true),
    (p_evidence_id, 'C6',  'pass', '11 m',              '150 m',                      true),
    (p_evidence_id, 'C6b', 'pass', '8 dtk',             '60 dtk',                     true),
    (p_evidence_id, 'C7',  'pass', '9.4 m',             '86 m',                       true),
    (p_evidence_id, 'C8',  'pass', NULL,                'hamming 6',                  true)
  ON CONFLICT DO NOTHING;

  IF baru > 0 THEN
  INSERT INTO audit_event (entity_type, entity_id, action, actor, payload_snapshot, is_demo_seed)
  VALUES (
    'evidence', p_evidence_id, 'evidence_submitted', handle,
    jsonb_build_object(
      'before', NULL,
      'after', jsonb_build_object(
        'place_id', p_place_id, 'vantage', p_vantage, 'phash', ph,
        'distance_to_place_m', 9.4, 'capture_method', 'getusermedia',
        'catatan', 'data demo bertanggal mundur'
      )
    ), true
  );
  END IF;

  FOR a IN SELECT * FROM jsonb_array_elements(p_attrs) LOOP
    IF a ? 'suggested' AND a->>'suggested' IS NOT NULL THEN
      INSERT INTO draft_suggestion (evidence_id, attribute_code, ai_suggested_value, ai_confidence, created_at)
      VALUES (p_evidence_id, a->>'code', a->>'suggested', (a->>'confidence')::numeric, t)
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO observation (
      place_id, attribute_code, evidence_id, contributor_id,
      ai_suggested_value, ai_confidence, confirmed_value, observed_at
    ) VALUES (
      p_place_id, a->>'code', p_evidence_id, p_contributor_id,
      a->>'suggested', (a->>'confidence')::numeric, a->>'confirmed', t
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO obs_id;

    IF obs_id IS NOT NULL THEN
      INSERT INTO audit_event (entity_type, entity_id, action, actor, payload_snapshot, is_demo_seed)
      VALUES (
        'observation', obs_id, 'observation_confirmed', handle,
        jsonb_build_object(
          'before', NULL,
          'after', jsonb_build_object(
            'attribute_code', a->>'code',
            'confirmed_value', a->>'confirmed',
            'ai_suggested_value', a->>'suggested',
            'was_corrected', ((a ? 'suggested') AND (a->>'suggested') IS DISTINCT FROM (a->>'confirmed'))
          )
        ), true
      );
    END IF;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- 1. Kontributor demo. Label "(demo)" ada di display_handle, yang berarti
--    ikut tampil di jejak audit publik. Itu disengaja.
-- ---------------------------------------------------------------------
INSERT INTO contributor (id, kind, display_handle, created_at) VALUES
  ('22222222-2222-4222-8222-000000000901', 'anonymous_session', 'Kontributor #901 (demo)', now() - interval '200 days'),
  ('22222222-2222-4222-8222-000000000902', 'anonymous_session', 'Kontributor #902 (demo)', now() - interval '200 days'),
  ('22222222-2222-4222-8222-000000000903', 'anonymous_session', 'Kontributor #903 (demo)', now() - interval '200 days')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Tempat. Empat tempat demo, satu tempat LATIHAN yang terpisah.
-- ---------------------------------------------------------------------
-- Tabel place milik Verification. `source` NOT NULL tanpa nilai bawaan, jadi
-- wajib disebut: kelima tempat ini dibuat tangan untuk demo, bukan hasil
-- penyemaian OSM, sehingga source = 'manual'.
--
-- KELIMA UUID INI DIPESAN. Penyemaian Overpass tidak boleh memakainya, dan
-- ...0005 khusus latihan uji penolakan.
INSERT INTO place (id, name, lat, lon, source, is_demo_seed) VALUES
  ('11111111-1111-4111-8111-000000000001', 'Stasiun Uji Coba Jatinangor',   -6.930000, 107.772000, 'manual', true),
  ('11111111-1111-4111-8111-000000000002', 'Puskesmas Contoh',              -6.928500, 107.770500, 'manual', true),
  ('11111111-1111-4111-8111-000000000003', 'Kantor Kelurahan Contoh',       -6.927200, 107.771800, 'manual', true),
  ('11111111-1111-4111-8111-000000000004', 'Perpustakaan Contoh',           -6.929100, 107.773400, 'manual', true),
  ('11111111-1111-4111-8111-000000000005', 'Gedung Latihan Uji Penolakan',  -6.926000, 107.769000, 'manual', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Kontribusi demo
-- ---------------------------------------------------------------------

-- 3.1 Stasiun — segar, terverifikasi, dikuatkan dua kontributor.
--     tactile_paving sengaja not_visible: tercatat, masuk audit, TIDAK
--     membentuk attribute_state. Dan usulan AI-nya 'yes' dengan confidence
--     0,62 — jadi was_corrected = true. Ini bahan demo terbaik untuk
--     "AI asisten, bukan otoritas".
SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000001',
  '11111111-1111-4111-8111-000000000001', 'entrance',
  '22222222-2222-4222-8222-000000000901', 5,
  '[{"code":"step_count","confirmed":"0","suggested":"0","confidence":0.91},
    {"code":"ramp_wheelchair","confirmed":"yes","suggested":"yes","confidence":0.88},
    {"code":"kerb","confirmed":"flush"},
    {"code":"tactile_paving","confirmed":"not_visible","suggested":"yes","confidence":0.62}]'::jsonb
);

SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000002',
  '11111111-1111-4111-8111-000000000001', 'entrance',
  '22222222-2222-4222-8222-000000000902', 3,
  '[{"code":"step_count","confirmed":"0","suggested":"0","confidence":0.93},
    {"code":"ramp_wheelchair","confirmed":"yes","suggested":"yes","confidence":0.90}]'::jsonb
);

SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000003',
  '11111111-1111-4111-8111-000000000001', 'toilet',
  '22222222-2222-4222-8222-000000000901', 3,
  '[{"code":"toilets_wheelchair","confirmed":"yes"}]'::jsonb
);

-- 3.2 Puskesmas — dua status berbeda di satu tempat.
--     entrance (tinjau 365 hari, umur 120 hari) -> terverifikasi
--     elevator (tinjau  90 hari, umur 120 hari) -> perlu_ditinjau_ulang
SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000004',
  '11111111-1111-4111-8111-000000000002', 'entrance',
  '22222222-2222-4222-8222-000000000902', 120,
  '[{"code":"step_count","confirmed":"2","suggested":"2","confidence":0.86},
    {"code":"ramp_wheelchair","confirmed":"no","suggested":"no","confidence":0.89},
    {"code":"surface_condition","confirmed":"uneven"}]'::jsonb
);

SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000005',
  '11111111-1111-4111-8111-000000000002', 'interior',
  '22222222-2222-4222-8222-000000000903', 120,
  '[{"code":"elevator_status","confirmed":"working"}]'::jsonb
);

-- 3.3 Kantor Kelurahan — sengketa.
--     ramp_wheelchair: 'no' 40 hari lalu, 'yes' 5 hari lalu, keduanya masih
--     dalam jendela 365 hari -> is_disputed = true, previous_value = 'no'.
--     step_count: sama-sama '3' dari dua kontributor -> corroboration 2.
SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000006',
  '11111111-1111-4111-8111-000000000003', 'entrance',
  '22222222-2222-4222-8222-000000000901', 40,
  '[{"code":"step_count","confirmed":"3","suggested":"3","confidence":0.84},
    {"code":"ramp_wheelchair","confirmed":"no","suggested":"no","confidence":0.87}]'::jsonb
);

SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000007',
  '11111111-1111-4111-8111-000000000003', 'entrance',
  '22222222-2222-4222-8222-000000000903', 5,
  '[{"code":"step_count","confirmed":"3","suggested":"3","confidence":0.85},
    {"code":"ramp_wheelchair","confirmed":"yes","suggested":"no","confidence":0.79}]'::jsonb
);

-- 3.3b Pelengkap supaya keempat penilaian muncul di demo (hasil rules engine):
--     Stasiun   → dapat_diakses untuk ketiga profil
--     Puskesmas → tidak_dapat_diakses (kursi roda), dengan_catatan (alat bantu, netra)
--     Kelurahan → dapat_diakses (kursi roda, alat bantu), dengan_catatan (netra)
--     Tanpa ini tiap tempat demo kurang satu atribut minimum, dan semuanya
--     berhenti di belum_dapat_dipastikan untuk alat bantu dan netra.
SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000008',
  '11111111-1111-4111-8111-000000000001', 'entrance',
  '22222222-2222-4222-8222-000000000903', 2,
  '[{"code":"surface_condition","confirmed":"good"},
    {"code":"door_width_band","confirmed":"gt90"},
    {"code":"tactile_paving","confirmed":"yes","suggested":"yes","confidence":0.90}]'::jsonb
);

SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000009',
  '11111111-1111-4111-8111-000000000002', 'entrance',
  '22222222-2222-4222-8222-000000000901', 60,
  '[{"code":"kerb","confirmed":"flush"},
    {"code":"door_width_band","confirmed":"gt90"},
    {"code":"tactile_paving","confirmed":"yes","suggested":"yes","confidence":0.88}]'::jsonb
);

SELECT trust_seed_chain(
  '33333333-3333-4333-8333-000000000010',
  '11111111-1111-4111-8111-000000000003', 'entrance',
  '22222222-2222-4222-8222-000000000902', 4,
  '[{"code":"kerb","confirmed":"lowered"},
    {"code":"door_width_band","confirmed":"80_90"},
    {"code":"surface_condition","confirmed":"good"},
    {"code":"tactile_paving","confirmed":"no","suggested":"no","confidence":0.81}]'::jsonb
);

-- 3.4 Perpustakaan — TIDAK ADA kontribusi. Hanya klaim OSM.
--     Ini justru masalah yang sedang dikerjakan produk ini: banyak tempat,
--     atributnya kosong. Jangan ubah narasinya jadi "seeding gagal".
INSERT INTO attribute_state (
  place_id, attribute_code, current_value, is_disputed,
  corroboration_count, source, last_verified_at, next_review_at, is_demo_seed
) VALUES
  ('11111111-1111-4111-8111-000000000004', 'ramp_wheelchair', 'yes', false, 0, 'osm_seed', NULL, NULL, true)
ON CONFLICT DO NOTHING;

-- 3.5 Gedung Latihan: sengaja kosong. Dipakai suite pytest.

-- ---------------------------------------------------------------------
-- 4. Hitung ulang attribute_state dari observation yang baru ditanam.
--
--    CERMIN dari lib/trust/attribute-state.ts §3. Kalau salah satunya
--    diubah, ubah keduanya. Duplikasi ini disadari dan diterima karena
--    seed harus bisa jalan tanpa menyalakan aplikasi; yang menjaganya
--    tetap sinkron adalah blok verifikasi §5.
-- ---------------------------------------------------------------------
WITH terbaru AS (
  SELECT DISTINCT ON (o.place_id, o.attribute_code)
         o.place_id, o.attribute_code, o.confirmed_value, o.observed_at
    FROM observation o
    -- Hanya observation dari bukti demo. Tanpa penyaring ini, atribut hasil
    -- kontribusi NYATA ikut ditulis ulang dengan is_demo_seed = true.
    JOIN evidence e ON e.id = o.evidence_id AND e.is_demo_seed
   WHERE o.confirmed_value <> 'not_visible'
   ORDER BY o.place_id, o.attribute_code, o.observed_at DESC, o.id DESC
),
hitung AS (
  SELECT
    l.place_id, l.attribute_code, l.confirmed_value, l.observed_at,
    t.review_interval_days AS hari,
    (SELECT count(DISTINCT o2.contributor_id)::int
       FROM observation o2
      WHERE o2.place_id = l.place_id AND o2.attribute_code = l.attribute_code
        AND o2.confirmed_value = l.confirmed_value
        AND o2.observed_at > now() - make_interval(days => t.review_interval_days)
    ) AS penguat,
    (SELECT o3.confirmed_value FROM observation o3
      WHERE o3.place_id = l.place_id AND o3.attribute_code = l.attribute_code
        AND o3.confirmed_value NOT IN ('not_visible', l.confirmed_value)
        AND o3.observed_at > now() - make_interval(days => t.review_interval_days)
      ORDER BY o3.observed_at DESC LIMIT 1) AS nilai_sebelum,
    (SELECT o3.observed_at FROM observation o3
      WHERE o3.place_id = l.place_id AND o3.attribute_code = l.attribute_code
        AND o3.confirmed_value NOT IN ('not_visible', l.confirmed_value)
        AND o3.observed_at > now() - make_interval(days => t.review_interval_days)
      ORDER BY o3.observed_at DESC LIMIT 1) AS waktu_sebelum
  FROM terbaru l
  JOIN attribute_type t ON t.code = l.attribute_code
),
tulis AS (
  INSERT INTO attribute_state (
    place_id, attribute_code, current_value, is_disputed,
    previous_value, previous_observed_at, corroboration_count,
    source, last_verified_at, next_review_at, is_demo_seed, updated_at
  )
  SELECT
    place_id, attribute_code, confirmed_value, (nilai_sebelum IS NOT NULL),
    nilai_sebelum, waktu_sebelum, penguat,
    'contribution', observed_at, observed_at + make_interval(days => hari), true, now()
  FROM hitung
  ON CONFLICT (place_id, attribute_code) DO UPDATE SET
    current_value        = EXCLUDED.current_value,
    is_disputed          = EXCLUDED.is_disputed,
    previous_value       = EXCLUDED.previous_value,
    previous_observed_at = EXCLUDED.previous_observed_at,
    corroboration_count  = EXCLUDED.corroboration_count,
    source               = EXCLUDED.source,
    last_verified_at     = EXCLUDED.last_verified_at,
    next_review_at       = EXCLUDED.next_review_at,
    is_demo_seed         = true,
    updated_at           = now()
  -- Baris yang tidak berubah tidak ditulis dan tidak dikembalikan, supaya
  -- menjalankan ulang seed tidak menambah audit state_updated kembar.
  WHERE (attribute_state.current_value, attribute_state.is_disputed, attribute_state.previous_value,
         attribute_state.corroboration_count, attribute_state.last_verified_at, attribute_state.source)
        IS DISTINCT FROM
        (EXCLUDED.current_value, EXCLUDED.is_disputed, EXCLUDED.previous_value,
         EXCLUDED.corroboration_count, EXCLUDED.last_verified_at, EXCLUDED.source)
  RETURNING place_id, attribute_code, current_value, is_disputed,
            corroboration_count, last_verified_at, next_review_at
)
INSERT INTO audit_event (entity_type, entity_id, action, actor, payload_snapshot, is_demo_seed)
SELECT 'attribute_state', place_id, 'state_updated', 'system',
       jsonb_build_object(
         'before', NULL,
         'after', jsonb_build_object(
           'attribute_code', attribute_code,
           'current_value', current_value,
           'is_disputed', is_disputed,
           'corroboration_count', corroboration_count,
           'last_verified_at', last_verified_at,
           'next_review_at', next_review_at,
           'catatan', 'ditanam seed_demo.sql'
         )
       ), true
FROM tulis;

-- ---------------------------------------------------------------------
-- 5. Verifikasi. Gagal keras, bukan gagal senyap.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  n_tanpa_bukti int;
  n_tanpa_audit int;
  n_tak_berlabel int;
  n_not_visible_bocor int;
BEGIN
  -- Keterlacakan harus 100 persen. Ini gerbangnya.
  SELECT count(*) INTO n_tanpa_bukti
  FROM attribute_state s
  WHERE s.source = 'contribution'
    AND NOT EXISTS (
      SELECT 1 FROM observation o
       WHERE o.place_id = s.place_id AND o.attribute_code = s.attribute_code
    );
  IF n_tanpa_bukti > 0 THEN
    RAISE EXCEPTION 'CACAT: % atribut bersumber kontribusi tanpa observation apa pun', n_tanpa_bukti;
  END IF;

  SELECT count(*) INTO n_tanpa_audit
  FROM attribute_state s
  WHERE s.source = 'contribution'
    AND NOT EXISTS (
      SELECT 1 FROM audit_event a
       WHERE a.entity_type = 'attribute_state' AND a.entity_id = s.place_id
         AND a.payload_snapshot->'after'->>'attribute_code' = s.attribute_code
    );
  IF n_tanpa_audit > 0 THEN
    RAISE EXCEPTION 'CACAT: % atribut terverifikasi tanpa jejak audit', n_tanpa_audit;
  END IF;

  -- not_visible tidak boleh pernah jadi nilai berlaku.
  SELECT count(*) INTO n_not_visible_bocor
  FROM attribute_state WHERE current_value = 'not_visible';
  IF n_not_visible_bocor > 0 THEN
    RAISE EXCEPTION 'CACAT: % baris attribute_state bernilai not_visible', n_not_visible_bocor;
  END IF;

  -- Seluruh data benih wajib berlabel.
  SELECT
    (SELECT count(*) FROM evidence         WHERE NOT is_demo_seed)
  + (SELECT count(*) FROM provenance_check WHERE NOT is_demo_seed)
  + (SELECT count(*) FROM attribute_state  WHERE NOT is_demo_seed)
  INTO n_tak_berlabel;
  IF n_tak_berlabel > 0 THEN
    RAISE WARNING
      'Ada % baris tanpa is_demo_seed. Wajar kalau sudah ada kontribusi nyata; '
      'periksa kalau basis data ini seharusnya kosong.', n_tak_berlabel;
  END IF;

  RAISE NOTICE 'Seed demo lolos verifikasi keterlacakan.';
END
$$;

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Ringkasan untuk dibaca operator setelah seeding
-- ---------------------------------------------------------------------
SELECT
  p.name AS tempat,
  s.attribute_code AS atribut,
  s.current_value AS nilai,
  trust_derive_status(s.last_verified_at, s.next_review_at) AS status,
  s.is_disputed AS sengketa,
  s.previous_value AS nilai_sebelumnya,
  s.corroboration_count AS penguat,
  s.source AS sumber
FROM attribute_state s
JOIN place p ON p.id = s.place_id
ORDER BY p.name, s.attribute_code;
