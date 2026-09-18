/**
 * Perakit jalur baca E1/E2/E3 (00-KONTRAK §8, docs-20 §6). MURNI: menerima baris
 * yang sudah dibaca muat.ts, mengembalikan bentuk di lib/ui/api/types.ts.
 *
 * Tiga pagar yang dijaga di sini, bukan di layar:
 *  - Penilaian dihitung saat request oleh lib/rules/engine.ts, tidak dibaca dari
 *    kolom mana pun (aturan 1).
 *  - Status datang dari view attribute_state_read — satu-satunya fungsi status
 *    (aturan 3). Berkas ini tidak pernah menghitung status sendiri.
 *  - Keluaran dirakit dari allow-list medan, bukan menyalin baris. ai_confidence
 *    dan storage_path tidak pernah sampai ke sini, apalagi ke respons (aturan 5).
 */

import { evaluate } from "@/lib/rules/engine";
import { RULE_MESSAGES } from "@/lib/rules/reference";
import type { AttributeFact, EvaluationResult, MinimumAttribute, RuleGroup } from "@/lib/rules/types";
import {
  isProfile,
  type AttributeDetail,
  type AttributeStatus,
  type AuditEntry,
  type AuditTrail,
  type CheckOutcome,
  type CheckResult,
  type FreshnessNote,
  type PlaceDetail,
  type PlaceSummary,
  type ProfileCode,
  type Vantage,
} from "@/lib/ui/api/types";

// ── Baris dari basis data ────────────────────────────────────────────────────
// pg mengembalikan numeric sebagai teks dan timestamptz sebagai Date.

type Waktu = Date | string | null;

export interface BarisTempat {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: string | number;
  lon: string | number;
  source: "osm_seed" | "manual";
  layanan_di_atas_lantai_dasar: boolean;
  third_party_claims: Record<string, unknown> | null;
  is_demo_seed: boolean;
}

/** Baris view attribute_state_read. `status` sudah diturunkan oleh trust_derive_status(). */
export interface BarisState {
  place_id: string;
  attribute_code: string;
  current_value: string;
  is_disputed: boolean;
  previous_value: string | null;
  previous_observed_at: Waktu;
  corroboration_count: number;
  source: "osm_seed" | "contribution";
  last_verified_at: Waktu;
  next_review_at: Waktu;
  is_demo_seed: boolean;
  status: AttributeStatus;
}

export interface BarisTipeAtribut {
  code: string;
  label_id: string;
  vantage: Vantage;
}

/** Foto di balik nilai berlaku sebuah atribut: evidence.public_path, bukan storage_path. */
export interface BarisFoto {
  attribute_code: string;
  public_path: string | null;
}

export interface BarisBukti {
  id: string;
  client_captured_at: Waktu;
  distance_to_place_m: string | number | null;
  client_accuracy_m: string | number | null;
  capture_method: string;
  public_path: string | null;
  is_demo_seed: boolean;
}

export interface BarisPemeriksaan {
  evidence_id: string;
  check_code: string;
  result: CheckResult;
  measured: string | null;
  threshold: string | null;
}

export interface BarisAudit {
  id: string;
  entity_type: "evidence" | "observation" | "attribute_state";
  entity_id: string;
  action: "evidence_submitted" | "provenance_failed" | "observation_confirmed" | "state_updated";
  actor: string;
  payload_snapshot: { before: unknown; after: unknown };
  is_demo_seed: boolean;
  created_at: Waktu;
}

// ── Parameter permintaan ─────────────────────────────────────────────────────

export interface GalatBody {
  code: string;
  message: string;
  measured: null;
  threshold: null;
}

/** Bentuk galat seragam (00-KONTRAK §6), satu objek seperti E6. */
export function galat(status: number, code: string, message: string): Response {
  const body: GalatBody = { code, message, measured: null, threshold: null };
  return Response.json(body, { status });
}

export const PESAN_PROFIL_WAJIB = "Parameter profile wajib: kursi_roda_manual, alat_bantu_jalan, atau netra.";

export function bacaProfil(v: string | null): ProfileCode | null {
  return isProfile(v) ? v : null;
}

export interface Bbox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** `bbox=minLon,minLat,maxLon,maxLat`. Kosong berarti tanpa batas; bentuk salah → "salah". */
export function bacaBbox(v: string | null): Bbox | null | "salah" {
  if (v === null || v.trim() === "") return null;
  const n = v.split(",").map((s) => Number(s.trim()));
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return "salah";
  const [minLon, minLat, maxLon, maxLat] = n;
  const sah =
    minLon >= -180 && maxLon <= 180 && minLat >= -90 && maxLat <= 90 && minLon <= maxLon && minLat <= maxLat;
  return sah ? { minLon, minLat, maxLon, maxLat } : "salah";
}

export const LIMIT_BAWAAN = 200;
export const LIMIT_MAKS = 500;

export function bacaLimit(v: string | null): number {
  const n = Number(v);
  if (v === null || v.trim() === "" || !Number.isInteger(n) || n < 1) return LIMIT_BAWAAN;
  return Math.min(n, LIMIT_MAKS);
}

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** id tempat berupa uuid. Selain itu pasti tidak ada, jadi tidak perlu menanyai basis data. */
export function idSah(id: string): boolean {
  return POLA_UUID.test(id);
}

// ── Pembantu ─────────────────────────────────────────────────────────────────

function iso(v: Waktu | undefined): string | null {
  if (v === null || v === undefined) return null;
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

function angka(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const LABEL_TITIK: Record<Vantage, string> = {
  entrance: "pintu masuk",
  interior: "bagian dalam",
  toilet: "toilet",
};

function klaimPihakKetiga(v: Record<string, unknown> | null): Record<string, string> | null {
  if (!v || typeof v !== "object") return null;
  const isi = Object.entries(v).map(([k, x]) => [k, String(x)] as const);
  return isi.length ? Object.fromEntries(isi) : null;
}

function peta<T extends { attribute_code: string }>(baris: T[]): Map<string, T> {
  return new Map(baris.map((b) => [b.attribute_code, b]));
}

// ── Penilaian ────────────────────────────────────────────────────────────────

export interface Aturan {
  rules: RuleGroup[];
  minimum: MinimumAttribute[];
}

function nilai(tempat: BarisTempat, states: BarisState[], profile: ProfileCode, aturan: Aturan): EvaluationResult {
  const attributes: Record<string, AttributeFact> = {};
  for (const s of states) {
    attributes[s.attribute_code] = {
      value: s.current_value,
      status: s.status,
      last_verified_at: iso(s.last_verified_at),
    };
  }
  return evaluate({
    profile,
    place: { layanan_di_atas_lantai_dasar: tempat.layanan_di_atas_lantai_dasar },
    attributes,
    rules: aturan.rules,
    minimum: aturan.minimum,
  });
}

function catatanKesegaran(hasil: EvaluationResult, states: Map<string, BarisState>): FreshnessNote[] {
  return hasil.freshness.map((f) => ({
    attribute_code: f.attribute_code,
    last_verified_at: f.last_verified_at,
    next_review_at: iso(states.get(f.attribute_code)?.next_review_at),
  }));
}

function hitungStatus(tipe: BarisTipeAtribut[], states: Map<string, BarisState>): Record<AttributeStatus, number> {
  const hitung: Record<AttributeStatus, number> = { belum_terverifikasi: 0, terverifikasi: 0, perlu_ditinjau_ulang: 0 };
  for (const t of tipe) hitung[states.get(t.code)?.status ?? "belum_terverifikasi"] += 1;
  return hitung;
}

// ── E1 ───────────────────────────────────────────────────────────────────────

export function rakitRingkasan(
  tempat: BarisTempat,
  states: BarisState[],
  tipe: BarisTipeAtribut[],
  profile: ProfileCode,
  aturan: Aturan,
): PlaceSummary {
  const petaState = peta(states);
  const hasil = nilai(tempat, states, profile, aturan);
  return {
    id: tempat.id,
    name: tempat.name,
    category: tempat.category,
    lat: Number(tempat.lat),
    lon: Number(tempat.lon),
    source: tempat.source,
    verdict: hasil.verdict,
    status_counts: hitungStatus(tipe, petaState),
    unknown_attributes: hasil.unknown,
    freshness_notes: catatanKesegaran(hasil, petaState),
    is_demo_seed: tempat.is_demo_seed,
  };
}

// ── E2 ───────────────────────────────────────────────────────────────────────

export function rakitRincian(
  tempat: BarisTempat,
  states: BarisState[],
  tipe: BarisTipeAtribut[],
  foto: BarisFoto[],
  profile: ProfileCode,
  aturan: Aturan,
): PlaceDetail {
  const petaState = peta(states);
  const petaFoto = peta(foto);
  const hasil = nilai(tempat, states, profile, aturan);

  const attributes: AttributeDetail[] = tipe.map((t) => {
    const s = petaState.get(t.code);
    const photoUrl = petaFoto.get(t.code)?.public_path ?? null;
    return {
      code: t.code,
      label: t.label_id,
      current_value: s?.current_value ?? null,
      status: s?.status ?? "belum_terverifikasi",
      is_disputed: s?.is_disputed ?? false,
      previous_value: s?.previous_value ?? null,
      previous_observed_at: iso(s?.previous_observed_at),
      corroboration_count: s?.corroboration_count ?? 0,
      last_verified_at: iso(s?.last_verified_at),
      next_review_at: iso(s?.next_review_at),
      source: s?.source ?? null,
      photo_url: photoUrl,
      // A8: teks alternatif menyebut lokasi dan atribut, hanya kalau fotonya ada.
      photo_alt: photoUrl
        ? `Foto ${LABEL_TITIK[t.vantage]} ${tempat.name}, bukti untuk atribut ${t.label_id.toLowerCase()}`
        : null,
      is_demo_seed: tempat.is_demo_seed || (s?.is_demo_seed ?? false),
      audit_url: `/api/places/${tempat.id}/attributes/${t.code}/audit`,
    };
  });

  return {
    id: tempat.id,
    name: tempat.name,
    category: tempat.category,
    address: tempat.address,
    lat: Number(tempat.lat),
    lon: Number(tempat.lon),
    source: tempat.source,
    profile,
    verdict: hasil.verdict,
    notes: hasil.notes.map((n) => ({
      rule_id: n.rule_id,
      verdict: n.verdict,
      message: RULE_MESSAGES[n.message_id] ?? n.message_id,
    })),
    unknown_attributes: hasil.unknown,
    freshness_notes: catatanKesegaran(hasil, petaState),
    attributes,
    is_demo_seed: tempat.is_demo_seed,
  };
}

// ── E3 ───────────────────────────────────────────────────────────────────────

const URUTAN_PEMERIKSAAN = ["C0", "C1", "C3", "C4", "C5", "C6", "C6b", "C7", "C8"];

// Urutan tampil untuk kejadian yang tercatat pada detik yang sama (satu
// transaksi): bukti, lalu konfirmasi, lalu perubahan state.
const PERINGKAT_AKSI: Record<BarisAudit["action"], number> = {
  evidence_submitted: 0,
  provenance_failed: 0,
  observation_confirmed: 1,
  state_updated: 2,
};

function medan(v: unknown, kunci: string): string | null {
  if (!v || typeof v !== "object") return null;
  const x = (v as Record<string, unknown>)[kunci];
  return x === null || x === undefined ? null : String(x);
}

export interface MasukanJejak {
  tempat: BarisTempat;
  atribut: BarisTipeAtribut;
  state: BarisState | null;
  bukti: BarisBukti[];
  pemeriksaan: BarisPemeriksaan[];
  audit: BarisAudit[];
}

export function rakitJejakAudit(m: MasukanJejak): AuditTrail {
  const buktiPerId = new Map(m.bukti.map((b) => [b.id, b]));
  const cekPerBukti = new Map<string, CheckOutcome[]>();
  for (const p of m.pemeriksaan) {
    const daftar = cekPerBukti.get(p.evidence_id) ?? [];
    daftar.push({ code: p.check_code, result: p.result, measured: p.measured, threshold: p.threshold });
    cekPerBukti.set(p.evidence_id, daftar);
  }
  for (const daftar of cekPerBukti.values()) {
    daftar.sort((a, b) => URUTAN_PEMERIKSAAN.indexOf(a.code) - URUTAN_PEMERIKSAAN.indexOf(b.code));
  }

  // Satu bukti menulis evidence_submitted, dan kalau ditolak juga
  // provenance_failed, dalam satu transaksi. Keduanya digabung jadi satu entri
  // supaya pemeriksaan yang sama tidak tampil dua kali; yang dipilih kejadian
  // penolakan, karena itu yang menentukan nasib bukti tersebut.
  const kejadianBukti = new Map<string, BarisAudit>();
  const lainnya: BarisAudit[] = [];
  for (const a of m.audit) {
    if (a.entity_type !== "evidence") {
      lainnya.push(a);
      continue;
    }
    const ada = kejadianBukti.get(a.entity_id);
    if (!ada || a.action === "provenance_failed") kejadianBukti.set(a.entity_id, a);
  }

  const entri: { e: AuditEntry; urut: [number, number] }[] = [];
  const urut = (a: BarisAudit): [number, number] => [new Date(iso(a.created_at)!).getTime(), PERINGKAT_AKSI[a.action]];

  for (const [buktiId, a] of kejadianBukti) {
    const b = buktiPerId.get(buktiId);
    entri.push({
      e: {
        id: a.id,
        at: iso(a.created_at)!,
        action: a.action,
        actor: a.actor,
        checks: cekPerBukti.get(buktiId) ?? [],
        before: null,
        after: null,
        evidence: b
          ? {
              id: b.id,
              photo_url: b.public_path,
              distance_to_place_m: angka(b.distance_to_place_m),
              client_accuracy_m: angka(b.client_accuracy_m),
              captured_at: iso(b.client_captured_at),
              capture_method: b.capture_method,
            }
          : null,
        is_demo_seed: a.is_demo_seed || (b?.is_demo_seed ?? false),
      },
      urut: urut(a),
    });
  }

  for (const a of lainnya) {
    const sesudah = a.payload_snapshot?.after;
    const sebelum = a.payload_snapshot?.before;
    const dasar = { id: a.id, at: iso(a.created_at)!, action: a.action, actor: a.actor, checks: [], is_demo_seed: a.is_demo_seed };
    const e: AuditEntry =
      a.action === "observation_confirmed"
        ? {
            ...dasar,
            before: null,
            after: null,
            ai_suggested_value: medan(sesudah, "ai_suggested_value"),
            confirmed_value: medan(sesudah, "confirmed_value"),
          }
        : { ...dasar, before: medan(sebelum, "current_value"), after: medan(sesudah, "current_value") };
    entri.push({ e, urut: urut(a) });
  }

  entri.sort((x, y) => x.urut[0] - y.urut[0] || x.urut[1] - y.urut[1] || x.e.id.localeCompare(y.e.id));

  return {
    place: { id: m.tempat.id, name: m.tempat.name },
    attribute: { code: m.atribut.code, label: m.atribut.label_id },
    entries: entri.map((x) => x.e),
    third_party_claims: klaimPihakKetiga(m.tempat.third_party_claims),
    is_demo_seed: m.state?.is_demo_seed ?? m.tempat.is_demo_seed,
  };
}
