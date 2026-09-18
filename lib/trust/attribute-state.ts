import type { PoolClient } from 'pg';
import { writeAudit } from './audit';

export interface StateSnapshot {
  current_value: string;
  is_disputed: boolean;
  previous_value: string | null;
  previous_observed_at: string | null;
  corroboration_count: number;
  source: 'osm_seed' | 'contribution';
  last_verified_at: string | null;
  next_review_at: string | null;
  /** Diturunkan, tidak disimpan. Ikut di sini hanya untuk payload response. */
  status: string;
}

export interface StateChange {
  attribute_code: string;
  before: StateSnapshot | null;
  after: StateSnapshot | null;
}

const SNAPSHOT_COLUMNS = `
  current_value, is_disputed, previous_value, previous_observed_at,
  corroboration_count, source, last_verified_at, next_review_at,
  trust_derive_status(last_verified_at, next_review_at) AS status
`;

async function readState(
  c: PoolClient,
  placeId: string,
  code: string,
): Promise<StateSnapshot | null> {
  const { rows } = await c.query<StateSnapshot>(
    `SELECT ${SNAPSHOT_COLUMNS} FROM attribute_state
      WHERE place_id = $1 AND attribute_code = $2`,
    [placeId, code],
  );
  return rows[0] ?? null;
}

/**
 * Mesin status — docs/10-trust.md §3. Dihitung ulang tiap ada observation baru.
 *
 * Dua hal yang sengaja TIDAK dilakukan fungsi ini:
 *
 *  1. Tidak menulis kolom status. Tidak ada kolom status. belum_terverifikasi /
 *     terverifikasi / perlu_ditinjau_ulang diturunkan trust_derive_status()
 *     saat dibaca. Kalau suatu saat ada yang menambahkan kolomnya karena
 *     "query-nya jadi lebih gampang", itu pelanggaran aturan 3 dan migrasi
 *     berikutnya akan gagal keras di pagar DO-block 001 §8.
 *
 *  2. Tidak menyembunyikan konflik. Dua nilai berbeda untuk atribut yang sama
 *     adalah perilaku yang dirancang, bukan bug yang harus diratakan. Yang
 *     dilakukan adalah memunculkannya lewat is_disputed dan previous_value.
 *
 * CERMIN: logika yang sama diulang di db/seed/seed_demo.sql §4 supaya seed
 * bisa jalan tanpa menyalakan aplikasi. Kalau satu diubah, ubah keduanya.
 */
export async function recomputeAttributeState(
  c: PoolClient,
  placeId: string,
  attributeCode: string,
  actor: string,
): Promise<StateChange> {
  const before = await readState(c, placeId, attributeCode);

  const { rows: at } = await c.query<{ review_interval_days: number }>(
    'SELECT review_interval_days FROM attribute_type WHERE code = $1',
    [attributeCode],
  );
  if (!at[0]) throw new Error(`Atribut tidak dikenal: ${attributeCode}`);
  const intervalDays = at[0].review_interval_days;

  // Langkah 1 — semua observation untuk pasangan tempat–atribut, buang not_visible.
  // not_visible tetap tercatat di observation dan tetap masuk audit; dia hanya
  // tidak membentuk state. "Tidak terlihat di foto" bukan fakta tentang tempat,
  // itu fakta tentang fotonya.
  const { rows: latest } = await c.query<{ confirmed_value: string; observed_at: string }>(
    `SELECT confirmed_value, observed_at
       FROM observation
      WHERE place_id = $1 AND attribute_code = $2
        AND confirmed_value <> 'not_visible'
      ORDER BY observed_at DESC, id DESC
      LIMIT 1`,
    [placeId, attributeCode],
  );

  // Langkah 2 — kosong. Seluruh observation yang ada berisi not_visible.
  // Baris seed OSM yang mungkin sudah ada dibiarkan apa adanya: kontribusi
  // yang bilang "tidak terlihat" tidak boleh menghapus klaim pihak ketiga,
  // dan juga tidak boleh naik derajat jadi verifikasi.
  if (!latest[0]) {
    return { attribute_code: attributeCode, before, after: before };
  }

  // Langkah 3 dan 4
  const currentValue = latest[0].confirmed_value;
  const lastVerifiedAt = latest[0].observed_at;

  // Langkah 5 dan 6 — keduanya memakai jendela kesegaran yang sama.
  // Jendela dihitung dari review_interval_days atributnya: observation yang
  // sudah lewat tenggat tinjau ulang tidak lagi menguatkan, dan juga tidak
  // lagi menyengketakan. Lift yang dilaporkan rusak sembilan bulan lalu tidak
  // boleh terus-menerus menandai sengketa pada laporan hari ini.
  const { rows: agg } = await c.query<{
    corroboration: number;
    prev_value: string | null;
    prev_at: string | null;
  }>(
    `WITH fresh AS (
       SELECT contributor_id, confirmed_value, observed_at
         FROM observation
        WHERE place_id = $1 AND attribute_code = $2
          AND confirmed_value <> 'not_visible'
          AND observed_at > now() - make_interval(days => $3::int)
     )
     SELECT
       (SELECT count(DISTINCT contributor_id)::int FROM fresh
         WHERE confirmed_value = $4)                                AS corroboration,
       (SELECT confirmed_value FROM fresh
         WHERE confirmed_value <> $4 ORDER BY observed_at DESC LIMIT 1) AS prev_value,
       (SELECT observed_at     FROM fresh
         WHERE confirmed_value <> $4 ORDER BY observed_at DESC LIMIT 1) AS prev_at`,
    [placeId, attributeCode, intervalDays, currentValue],
  );

  const corroboration = agg[0].corroboration;
  const previousValue = agg[0].prev_value;
  const previousObservedAt = agg[0].prev_at;
  const isDisputed = previousValue !== null;

  const { rows: after } = await c.query<StateSnapshot>(
    `INSERT INTO attribute_state (
       place_id, attribute_code, current_value, is_disputed,
       previous_value, previous_observed_at, corroboration_count,
       source, last_verified_at, next_review_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       'contribution', $8, $8::timestamptz + make_interval(days => $9::int), now()
     )
     ON CONFLICT (place_id, attribute_code) DO UPDATE SET
       current_value        = EXCLUDED.current_value,
       is_disputed          = EXCLUDED.is_disputed,
       previous_value       = EXCLUDED.previous_value,
       previous_observed_at = EXCLUDED.previous_observed_at,
       corroboration_count  = EXCLUDED.corroboration_count,
       source               = EXCLUDED.source,
       last_verified_at     = EXCLUDED.last_verified_at,
       next_review_at       = EXCLUDED.next_review_at,
       updated_at           = now()
     RETURNING ${SNAPSHOT_COLUMNS}`,
    [
      placeId, attributeCode, currentValue, isDisputed,
      previousValue, previousObservedAt, corroboration,
      lastVerifiedAt, intervalDays,
    ],
  );

  // Langkah 7
  await writeAudit(c, {
    entityType: 'attribute_state',
    entityId: placeId,
    action: 'state_updated',
    actor,
    before,
    after: { attribute_code: attributeCode, ...after[0] },
  });

  return { attribute_code: attributeCode, before, after: after[0] };
}
