/**
 * Pemetaan elemen OpenStreetMap ke tempat dan atribut kontrak (docs-20 §3).
 * MURNI: tanpa jaringan dan tanpa basis data, supaya aturan pengambilan tag bisa
 * dites dan dijelaskan baris demi baris.
 *
 * Yang diambil: ramp:wheelchair, step_count, tactile_paving, kerb,
 * toilets:wheelchair, dan lebar (width / est_width / entrance:width) pada node
 * entrance yang dibulatkan ke pita.
 *
 * Yang sengaja TIDAK diambil:
 *  - door:width  → kunci ini untuk dermaga muat, bukan pintu masuk.
 *  - smoothness  → tag milik way jalan, bukan node tempat.
 *  - wheelchair  → itu penilaian, bukan fakta. Disimpan ke third_party_claims
 *                  dan hanya tampil di audit, tidak pernah menggerakkan penilaian.
 *  - highway=elevator → hanya menyatakan liftnya ada, bukan berfungsi atau tidak,
 *                  jadi tidak bisa dipetakan ke elevator_status tanpa mengarang.
 *
 * Semua hasilnya berstatus belum_terverifikasi (source = osm_seed): klaim OSM
 * tidak membawa foto, jadi tidak pernah dihitung sebagai verifikasi.
 */

import { ATTRIBUTE_TYPES } from "../../lib/rules/reference";

export interface ElemenOsm {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  nodes?: number[];
  tags?: Record<string, string>;
}

export type Kategori = "kampus" | "halte" | "fasilitas kesehatan";

export interface TempatSeed {
  osm_type: ElemenOsm["type"];
  osm_id: number;
  name: string;
  category: Kategori;
  lat: number;
  lon: number;
  address: string | null;
  third_party_claims: Record<string, string> | null;
  /** attribute_code → nilai; hanya nilai yang sah menurut kamus kontrak. */
  atribut: Record<string, string>;
}

export function kategori(tags: Record<string, string>): Kategori | null {
  const amenity = tags.amenity ?? "";
  if (amenity === "university" || amenity === "college") return "kampus";
  if (["hospital", "clinic", "doctors", "dentist"].includes(amenity)) return "fasilitas kesehatan";
  if (["hospital", "clinic", "doctor", "dentist", "centre"].includes(tags.healthcare ?? "")) return "fasilitas kesehatan";
  if (tags.highway === "bus_stop" || amenity === "bus_station") return "halte";
  if (tags.public_transport === "platform" && tags.bus === "yes") return "halte";
  return null;
}

/** Lebar OSM (meter bawaan; "cm" dan "m" dikenali) → pita lebar_pintu. Nilai tak masuk akal diabaikan. */
export function lebarKePita(v: string | undefined): "lt80" | "80_90" | "gt90" | null {
  if (!v) return null;
  const m = v.trim().toLowerCase().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(cm|m)?$/);
  if (!m) return null;
  const meter = m[2] === "cm" ? Number(m[1]) / 100 : Number(m[1]);
  if (!(meter >= 0.3 && meter <= 3)) return null;
  if (meter < 0.8) return "lt80";
  if (meter <= 0.9) return "80_90";
  return "gt90";
}

const KERB: Record<string, string> = { raised: "raised", lowered: "lowered", flush: "flush" };
const YA_TIDAK = (v: string | undefined) => (v === "yes" || v === "no" ? v : null);

/** Tag fakta pada satu elemen → atribut kontrak. Lebar ditangani terpisah (hanya dari node entrance). */
export function atributDariTag(tags: Record<string, string>): Record<string, string> {
  const hasil: Record<string, string> = {};
  const set = (kode: string, nilai: string | null) => {
    if (nilai !== null) hasil[kode] = nilai;
  };
  set("ramp_wheelchair", YA_TIDAK(tags["ramp:wheelchair"]));
  set("tactile_paving", YA_TIDAK(tags.tactile_paving));
  set("toilets_wheelchair", YA_TIDAK(tags["toilets:wheelchair"]));
  set("kerb", KERB[tags.kerb ?? ""] ?? null);
  const anakTangga = tags.step_count;
  set("step_count", anakTangga !== undefined && /^\d+$/.test(anakTangga.trim()) ? String(Number(anakTangga)) : null);
  return hasil;
}

const SAH = new Map(ATTRIBUTE_TYPES.map((a) => [a.code, new Set(a.allowed_values)]));

function hanyaYangSah(atribut: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(atribut).filter(([k, v]) => SAH.get(k)?.has(v)));
}

function alamat(tags: Record<string, string>): string | null {
  const jalan = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  return jalan || tags["addr:full"] || null;
}

/** Semua elemen Overpass → tempat. Node entrance dipakai sebagai bahan, bukan sebagai tempat. */
export function petakan(elemen: ElemenOsm[]): TempatSeed[] {
  const entrance = new Map(elemen.filter((e) => e.type === "node" && e.tags?.entrance).map((e) => [e.id, e]));
  const hasil: TempatSeed[] = [];

  for (const e of elemen) {
    const tags = e.tags ?? {};
    const kat = kategori(tags);
    const name = tags.name?.trim();
    const pos = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!kat || !name || !pos) continue;

    const atribut = atributDariTag(tags);
    // Node entrance milik way ini: pintu utama didahulukan. Tag di node entrance
    // lebih spesifik dari tag di bangunan, jadi yang menang node entrance.
    const pintu = (e.nodes ?? [])
      .map((id) => entrance.get(id))
      .filter((n): n is ElemenOsm => n !== undefined)
      .sort((a, b) => Number(b.tags?.entrance === "main") - Number(a.tags?.entrance === "main"))[0];
    if (pintu?.tags) {
      Object.assign(atribut, atributDariTag(pintu.tags));
      const pita =
        lebarKePita(pintu.tags.width) ?? lebarKePita(pintu.tags.est_width) ?? lebarKePita(pintu.tags["entrance:width"]);
      if (pita) atribut.door_width_band = pita;
    }

    hasil.push({
      osm_type: e.type,
      osm_id: e.id,
      name,
      category: kat,
      lat: Number(pos.lat.toFixed(6)),
      lon: Number(pos.lon.toFixed(6)),
      address: alamat(tags),
      third_party_claims: tags.wheelchair ? { wheelchair: tags.wheelchair } : null,
      atribut: hanyaYangSah(atribut),
    });
  }
  return hasil;
}

function jarakM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Batasi ke `maks` tempat (docs-20 §3: 30–60). Kampus dan fasilitas kesehatan
 * didahulukan karena jumlahnya sedikit dan jadi tujuan; sisanya halte terdekat
 * dari pusat koridor.
 */
export function pilih(tempat: TempatSeed[], pusat: { lat: number; lon: number }, maks: number): TempatSeed[] {
  const bobot = (t: TempatSeed) => (t.category === "halte" ? 1 : 0);
  return [...tempat]
    .sort((a, b) => bobot(a) - bobot(b) || jarakM(pusat, a) - jarakM(pusat, b))
    .slice(0, maks)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}
