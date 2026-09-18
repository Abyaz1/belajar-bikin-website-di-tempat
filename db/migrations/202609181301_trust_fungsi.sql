-- =====================================================================
-- 202609181301_trust_fungsi.sql — padanan SQL untuk C7 dan C8
-- =====================================================================

BEGIN;

-- Haversine sisi server. Konstanta radius HARUS sama dengan EARTH_MEAN_RADIUS_M
-- di lib/trust/geo.ts, supaya angka di jejak audit sama dengan angka di layar.
CREATE OR REPLACE FUNCTION trust_haversine_m(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT 2 * 6371008.8 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
    * power(sin(radians(lon2 - lon1) / 2), 2)
  )));
$$;

-- Hamming distance dua pHash hex 64 bit.
-- ('x' || hex)::bit(64) adalah cara baku Postgres membaca hex jadi bit string.
CREATE OR REPLACE FUNCTION trust_phash_hamming(a text, b text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT length(replace(
    ((('x' || a)::bit(64)) # (('x' || b)::bit(64)))::text, '0', ''
  ));
$$;

/*
 * Kandidat duplikat untuk C8.
 *
 * Batasannya jujur: tidak ada indeks yang bisa mempercepat Hamming distance
 * di Postgres polos, jadi ini pemindaian berurutan atas seluruh tabel evidence.
 * Pada skala demo (puluhan sampai ratusan baris) biayanya tidak terasa. Pada
 * skala kota, ini harus pindah ke indeks BK-tree atau pembagian hash jadi
 * beberapa potongan. Catat sebagai batasan, jangan diklaim sudah beres.
 */
CREATE OR REPLACE FUNCTION trust_phash_candidates(
  p_phash       text,
  p_similar_max integer DEFAULT 6
) RETURNS TABLE (
  evidence_id    uuid,
  phash          text,
  place_id       uuid,
  vantage        vantage,
  contributor_id uuid,
  hamming        integer
)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT e.id, e.phash, e.place_id, e.vantage, e.contributor_id,
         trust_phash_hamming(e.phash, p_phash) AS hamming
  FROM evidence e
  WHERE trust_phash_hamming(e.phash, p_phash) <= p_similar_max
  ORDER BY hamming ASC;
$$;

GRANT EXECUTE ON FUNCTION
  trust_haversine_m(numeric, numeric, numeric, numeric),
  trust_phash_hamming(text, text),
  trust_phash_candidates(text, integer),
  trust_derive_status(timestamptz, timestamptz, timestamptz)
TO app_rw;

COMMIT;
