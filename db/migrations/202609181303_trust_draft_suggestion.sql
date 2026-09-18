-- =====================================================================
-- 202609181303_trust_draft_suggestion.sql
--
-- docs/10-trust.md §E5 mengunci kiriman klien ke [{attribute_code,
-- confirmed_value}] — tanpa nilai usulan. Tapi observation punya
-- ai_suggested_value dan ai_confidence, dan was_corrected diturunkan dari
-- keduanya. Artinya server harus mengingat sendiri apa yang diusulkan model
-- di E4.
--
-- Menerima nilai usulan dari klien di E5 bukan pilihan: klien bisa berbohong
-- soal apa yang diusulkan, dan was_corrected — satu-satunya catatan seberapa
-- sering kontributor mengoreksi AI — jadi angka yang ditulis pihak yang paling
-- berkepentingan mengubahnya.
-- =====================================================================

BEGIN;

CREATE TABLE draft_suggestion (
  evidence_id        uuid NOT NULL REFERENCES evidence(id),
  attribute_code     text NOT NULL REFERENCES attribute_type(code),
  ai_suggested_value text NOT NULL,
  ai_confidence      numeric(4,3) NOT NULL CHECK (ai_confidence BETWEEN 0 AND 1),
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evidence_id, attribute_code)
);

COMMENT ON TABLE draft_suggestion IS
  'Ingatan server atas usulan model, supaya E5 tidak perlu mempercayai klien '
  'soal apa yang diusulkan. Tanpa tabel ini, was_corrected adalah angka yang '
  'ditulis pihak yang paling berkepentingan mengubahnya.';

ALTER TABLE draft_suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_suggestion FORCE  ROW LEVEL SECURITY;
CREATE POLICY draft_suggestion_select ON draft_suggestion FOR SELECT USING (true);
CREATE POLICY draft_suggestion_insert ON draft_suggestion FOR INSERT WITH CHECK (true);

CREATE TRIGGER draft_suggestion_append_only
  BEFORE UPDATE OR DELETE ON draft_suggestion
  FOR EACH ROW EXECUTE FUNCTION trust_deny_mutation();

GRANT SELECT, INSERT ON draft_suggestion TO app_rw;

COMMIT;
