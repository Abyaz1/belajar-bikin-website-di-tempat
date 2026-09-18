import "server-only";

/**
 * Pembaca basis data untuk E1/E2/E3. Hanya SELECT, dan hanya kolom yang disebut
 * satu per satu (CLAUDE.md §14: tidak ada SELECT * di jalur yang keluar ke
 * respons). Status atribut SELALU dari view attribute_state_read — tidak ada
 * query di sini yang menghitung status sendiri. observation hanya dipakai untuk
 * mencari id dan nilai terkonfirmasi, jadi ai_confidence tidak pernah terbaca.
 */

import { db } from "@/lib/db";
import { ATTRIBUTE_TYPES } from "@/lib/rules/reference";
import type {
  BarisAudit,
  BarisBukti,
  BarisFoto,
  BarisPemeriksaan,
  BarisState,
  BarisTempat,
  BarisTipeAtribut,
  Bbox,
} from "./rakit";

const KOLOM_TEMPAT = `id, name, category, address, lat, lon, source,
  layanan_di_atas_lantai_dasar, third_party_claims, is_demo_seed`;

export async function muatDaftarTempat(bbox: Bbox | null, limit: number): Promise<BarisTempat[]> {
  const { rows } = await (await db()).query<BarisTempat>(
    `select ${KOLOM_TEMPAT} from place
      where ($1::numeric is null or (lon between $1 and $3 and lat between $2 and $4))
      order by name, id
      limit $5`,
    [bbox?.minLon ?? null, bbox?.minLat ?? null, bbox?.maxLon ?? null, bbox?.maxLat ?? null, limit],
  );
  return rows;
}

export async function muatTempat(id: string): Promise<BarisTempat | null> {
  const { rows } = await (await db()).query<BarisTempat>(`select ${KOLOM_TEMPAT} from place where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function muatState(placeIds: string[]): Promise<BarisState[]> {
  if (placeIds.length === 0) return [];
  const { rows } = await (await db()).query<BarisState>(
    `select place_id, attribute_code, current_value, is_disputed, previous_value,
            previous_observed_at, corroboration_count, source, last_verified_at,
            next_review_at, is_demo_seed, status
       from attribute_state_read
      where place_id = any($1::uuid[])`,
    [placeIds],
  );
  return rows;
}

// Urutan tampil mengikuti kamus kontrak (reference.ts); isinya tetap dari tabel.
const POSISI = new Map(ATTRIBUTE_TYPES.map((a, i) => [a.code, i]));

export async function muatTipeAtribut(): Promise<BarisTipeAtribut[]> {
  const { rows } = await (await db()).query<BarisTipeAtribut>(`select code, label_id, vantage from attribute_type`);
  return rows.sort((a, b) => (POSISI.get(a.code) ?? 99) - (POSISI.get(b.code) ?? 99) || a.code.localeCompare(b.code));
}

/** Foto terbaru di balik nilai berlaku tiap atribut. Hanya public_path (hasil blur), tidak pernah storage_path. */
export async function muatFoto(placeId: string): Promise<BarisFoto[]> {
  const { rows } = await (await db()).query<BarisFoto>(
    `select distinct on (o.attribute_code) o.attribute_code, e.id as evidence_id, e.public_path
       from observation o
       join attribute_state s
         on s.place_id = o.place_id and s.attribute_code = o.attribute_code
        and s.current_value = o.confirmed_value
       join evidence e on e.id = o.evidence_id
      where o.place_id = $1
      -- Bukti yang punya foto tayang didahulukan: nilai yang sama dari bukti lebih
      -- lama tetap sah sebagai fotonya kalau bukti terbaru tidak punya foto.
      order by o.attribute_code, (e.public_path is null), o.observed_at desc, o.id desc`,
    [placeId],
  );
  return rows;
}

export interface BahanJejak {
  bukti: BarisBukti[];
  pemeriksaan: BarisPemeriksaan[];
  audit: BarisAudit[];
}

/**
 * Bahan jejak audit satu atribut (E3). Bukti yang dihitung adalah semua bukti
 * di tempat dan titik pandang atribut itu — termasuk yang DITOLAK, karena
 * kontribusi yang ditolak tetap masuk audit (aturan 4).
 */
export async function muatJejak(placeId: string, code: string, vantage: string): Promise<BahanJejak> {
  const pool = await db();
  const [bukti, pemeriksaan, audit] = await Promise.all([
    pool.query<BarisBukti>(
      `select id, client_captured_at, distance_to_place_m, client_accuracy_m,
              capture_method, public_path, is_demo_seed
         from evidence
        where place_id = $1 and vantage = $2::vantage`,
      [placeId, vantage],
    ),
    pool.query<BarisPemeriksaan>(
      `select pc.evidence_id, pc.check_code, pc.result, pc.measured, pc.threshold
         from provenance_check pc
         join evidence e on e.id = pc.evidence_id
        where e.place_id = $1 and e.vantage = $2::vantage`,
      [placeId, vantage],
    ),
    pool.query<BarisAudit>(
      `select id, entity_type, entity_id, action, actor, payload_snapshot, is_demo_seed, created_at
         from audit_event
        where (entity_type = 'evidence'
                and action in ('evidence_submitted', 'provenance_failed')
                and entity_id in (select id from evidence where place_id = $1 and vantage = $3::vantage))
           or (entity_type = 'observation'
                and action = 'observation_confirmed'
                and entity_id in (select id from observation where place_id = $1 and attribute_code = $2))
           or (entity_type = 'attribute_state'
                and action = 'state_updated'
                and entity_id = $1
                and payload_snapshot -> 'after' ->> 'attribute_code' = $2)
        order by created_at, id`,
      [placeId, code, vantage],
    ),
  ]);
  return { bukti: bukti.rows, pemeriksaan: pemeriksaan.rows, audit: audit.rows };
}
