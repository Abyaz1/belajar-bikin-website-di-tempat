-- =====================================================================
-- 003_trust_fixups.sql
--
-- Dua koreksi yang ditemukan saat menulis E4 dan E7:
--
-- 1. docs/10-trust.md §E4 mewajibkan `evidence` TETAP DITULIS walau C0 gagal.
--    Tapi C0 gagal justru ketika tokennya tidak ada di capture_session, dan
--    kolom capture_token di 001 berupa NOT NULL dengan foreign key — sehingga
--    barisnya mustahil ditulis dan aturan 4 tidak bisa ditegakkan.
--
-- 2. display_handle butuh nomor urut yang tidak diperebutkan dua sesi yang
--    dibuat bersamaan.
-- =====================================================================

BEGIN;

-- 3.a Pemisahan klaim klien vs hasil verifikasi server.
-- claimed_capture_token : apa yang dikirim klien. Selalu disimpan, tanpa FK,
--                         tanpa UNIQUE. Ini data, bukan kebenaran.
-- capture_session_token : terisi HANYA kalau C0 berhasil mencocokkan token ke
--                         sesi yang sah. UNIQUE-nya yang menegakkan
--                         "satu token satu bukti".
ALTER TABLE evidence RENAME COLUMN capture_token TO capture_session_token;
ALTER TABLE evidence ALTER COLUMN capture_session_token DROP NOT NULL;
ALTER TABLE evidence ADD COLUMN claimed_capture_token text NOT NULL DEFAULT '';
ALTER TABLE evidence ALTER COLUMN claimed_capture_token DROP DEFAULT;

COMMENT ON COLUMN evidence.claimed_capture_token IS
  'Token sebagaimana dikirim klien. Disimpan apa adanya untuk jejak audit, '
  'termasuk ketika tokennya palsu atau kedaluwarsa. Tanpa FK: barisnya harus '
  'tetap bisa ditulis justru ketika C0 gagal (aturan 4).';
COMMENT ON COLUMN evidence.capture_session_token IS
  'Terisi hanya kalau C0 pass. NULL berarti server tidak pernah berhasil '
  'mencocokkan pengiriman ini ke sesi penangkapan mana pun.';

-- 3.b Nomor kontributor anonim. Sequence, bukan count(*), supaya dua sesi
-- yang dibuat bersamaan tidak memperebutkan handle yang sama.
CREATE SEQUENCE IF NOT EXISTS contributor_handle_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE contributor_handle_seq TO app_rw;

COMMIT;
