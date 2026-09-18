import { trustConfig } from './config';
import type { ProvenanceCheckResult } from './types';

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Radius rata-rata bumi menurut IUGG (R1). Dipakai konsisten di seluruh
 * sistem supaya angka jarak di layar penolakan sama dengan angka di jejak audit.
 * HARUS sama dengan konstanta di trust_haversine_m (002_trust_functions.sql).
 */
const EARTH_MEAN_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

function assertLatLon(p: LatLon, label: string): void {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) {
    throw new RangeError(`Koordinat ${label} bukan angka: ${JSON.stringify(p)}`);
  }
  if (p.lat < -90 || p.lat > 90) {
    throw new RangeError(`Lintang ${label} di luar rentang: ${p.lat}`);
  }
  if (p.lon < -180 || p.lon > 180) {
    throw new RangeError(`Bujur ${label} di luar rentang: ${p.lon}`);
  }
}

/**
 * Jarak lingkaran besar antara dua koordinat, dalam meter.
 *
 * Memakai asin(sqrt(h)) dengan penjepit ke 1, bukan atan2. Keduanya setara
 * secara matematis; bentuk ini menghindari NaN ketika galat pembulatan
 * membuat h sedikit melebihi 1 pada dua titik yang berimpit.
 *
 * Bumi dianggap bola. Galatnya di bawah 0,5 persen, yaitu sekitar 0,6 m pada
 * jarak 120 m — jauh di bawah ketelitian GPS ponsel, yang puluhan meter.
 * Vincenty tidak dipakai karena tidak menambah apa pun yang bisa diukur di sini.
 */
export function haversineMeters(a: LatLon, b: LatLon): number {
  assertLatLon(a, 'a');
  assertLatLon(b, 'b');

  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lon - a.lon);

  const sinPhi = Math.sin(dPhi / 2);
  const sinLambda = Math.sin(dLambda / 2);

  const h =
    sinPhi * sinPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;

  return 2 * EARTH_MEAN_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * radius_efektif = min(radius_dasar + client_accuracy_m, batas_gagal)
 *
 * Penjepit min(..., 120) WAJIB. Tanpa itu, akurasi 45 m ke atas membuat
 * radius efektif melewati batas gagal, dan dua aturan saling bertabrakan.
 */
export function effectiveRadiusM(accuracyM: number): number {
  if (!Number.isFinite(accuracyM) || accuracyM < 0) {
    throw new RangeError(`client_accuracy_m tidak sah: ${accuracyM}`);
  }
  return Math.min(
    trustConfig.geoBaseRadiusM + accuracyM,
    trustConfig.geoFailRadiusM,
  );
}

export interface C7Input {
  client: LatLon;
  place: LatLon;
  /** client_accuracy_m, sudah lolos C6 (≤ 150). */
  accuracyM: number;
}

export interface C7Output {
  check: ProvenanceCheckResult;
  /** Disimpan ke evidence.distance_to_place_m. */
  distanceM: number;
  effectiveRadiusM: number;
}

/**
 * C7 — jarak ke tempat, bertingkat.
 *
 *   jarak ≤ radius_efektif        → pass
 *   radius_efektif < jarak ≤ 120  → flag  (diterima, ditandai di audit)
 *   jarak > 120                   → fail  (GEO_TOO_FAR)
 *
 * Catatan yang harus bisa dijelaskan ke juri: koordinat ini dinyatakan klien.
 * Pemeriksaan ini tidak membuktikan orangnya ada di sana. Yang dilakukannya
 * adalah menaikkan biaya: pemalsu harus menyiapkan koordinat yang konsisten
 * dengan accuracy, umur fix, timestamp, dan token sesi sekaligus.
 */
export function evaluateC7(input: C7Input): C7Output {
  const distanceRaw = haversineMeters(input.client, input.place);
  const distanceM = Math.round(distanceRaw * 10) / 10;
  const radius = Math.round(effectiveRadiusM(input.accuracyM) * 10) / 10;
  const failRadius = trustConfig.geoFailRadiusM;

  if (distanceM <= radius) {
    return {
      distanceM,
      effectiveRadiusM: radius,
      check: {
        code: 'C7',
        result: 'pass',
        measured: `${distanceM} m`,
        threshold: `${radius} m`,
        reason: null,
      },
    };
  }

  if (distanceM <= failRadius) {
    return {
      distanceM,
      effectiveRadiusM: radius,
      check: {
        code: 'C7',
        result: 'flag',
        measured: `${distanceM} m`,
        threshold: `${radius} m`,
        reason: null,
      },
    };
  }

  return {
    distanceM,
    effectiveRadiusM: radius,
    check: {
      code: 'C7',
      result: 'fail',
      measured: `${distanceM} m`,
      threshold: `${failRadius} m`,
      reason: 'GEO_TOO_FAR',
    },
  };
}
