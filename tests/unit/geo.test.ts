import { describe, expect, it } from 'vitest';
import { effectiveRadiusM, evaluateC7, haversineMeters } from '@/lib/trust/geo';

const TEMPAT = { lat: -6.926, lon: 107.769 };

/** Geser ke utara sejauh `m` meter. 1 derajat lintang ~ 111.320 m. */
const utara = (m: number) => ({ lat: TEMPAT.lat + m / 111_320, lon: TEMPAT.lon });

describe('haversineMeters', () => {
  it('nol untuk dua titik yang sama', () => {
    expect(haversineMeters(TEMPAT, TEMPAT)).toBe(0);
  });

  it('satu derajat lintang kira-kira 111,19 km', () => {
    const d = haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(111_100);
    expect(d).toBeLessThan(111_300);
  });

  it('simetris', () => {
    const a = { lat: -6.9, lon: 107.6 };
    const b = { lat: -6.93, lon: 107.78 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 9);
  });

  it('menolak koordinat di luar rentang, bukan mengembalikan NaN diam-diam', () => {
    expect(() => haversineMeters({ lat: 91, lon: 0 }, TEMPAT)).toThrow(RangeError);
    expect(() => haversineMeters({ lat: 0, lon: 181 }, TEMPAT)).toThrow(RangeError);
    expect(() => haversineMeters({ lat: Number.NaN, lon: 0 }, TEMPAT)).toThrow(RangeError);
  });
});

describe('effectiveRadiusM — penjepit min(75 + accuracy, 120)', () => {
  it('menambahkan akurasi selama masih di bawah batas gagal', () => {
    expect(effectiveRadiusM(0)).toBe(75);
    expect(effectiveRadiusM(10)).toBe(85);
    expect(effectiveRadiusM(44)).toBe(119);
  });

  it('terjepit tepat di 120 saat akurasi 45', () => {
    expect(effectiveRadiusM(45)).toBe(120);
  });

  it('tidak pernah melewati batas gagal, berapa pun akurasinya', () => {
    // Tanpa penjepit ini, akurasi 150 m memberi radius efektif 225 m dan
    // dua aturan saling bertabrakan: jarak 200 m akan "pass" sekaligus "fail".
    expect(effectiveRadiusM(150)).toBe(120);
    expect(effectiveRadiusM(10_000)).toBe(120);
  });

  it('menolak akurasi negatif atau bukan angka', () => {
    expect(() => effectiveRadiusM(-1)).toThrow(RangeError);
    expect(() => effectiveRadiusM(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('evaluateC7 — jarak bertingkat', () => {
  const nilai = (jarakM: number, accuracyM: number) =>
    evaluateC7({ client: utara(jarakM), place: TEMPAT, accuracyM });

  it('pass tepat di radius efektif, flag tepat setelahnya', () => {
    expect(nilai(84, 10).check.result).toBe('pass');   // radius efektif 85
    expect(nilai(86, 10).check.result).toBe('flag');
  });

  it('flag sampai batas gagal, fail sesudahnya', () => {
    expect(nilai(119, 10).check.result).toBe('flag');
    expect(nilai(121, 10).check.result).toBe('fail');
  });

  it('akurasi besar menghapus pita flag sama sekali', () => {
    // radius efektif terjepit di 120 = batas gagal, jadi tidak ada ruang flag.
    expect(nilai(119, 100).check.result).toBe('pass');
    expect(nilai(121, 100).check.result).toBe('fail');
  });

  it('melaporkan batas gagal sebagai threshold saat fail, bukan radius efektif', () => {
    const { check } = nilai(300, 10);
    expect(check.result).toBe('fail');
    expect(check.reason).toBe('GEO_TOO_FAR');
    expect(check.threshold).toBe('120 m');          // bukan '85 m'
    expect(check.measured).toMatch(/^\d+(\.\d+)? m$/);
  });

  it('membawa nilai terukur pada setiap hasil, termasuk saat pass', () => {
    // Aturan 6: setiap penolakan menampilkan alasan DAN nilai terukurnya.
    // Nilai terukur juga disimpan saat lolos, supaya jejak audit lengkap.
    for (const hasil of [nilai(10, 10), nilai(100, 10), nilai(300, 10)]) {
      expect(hasil.check.measured).not.toBeNull();
      expect(hasil.check.threshold).not.toBeNull();
    }
  });

  it('hanya mengisi reason saat fail', () => {
    expect(nilai(10, 10).check.reason).toBeNull();
    expect(nilai(100, 10).check.reason).toBeNull();   // flag bukan penolakan
    expect(nilai(300, 10).check.reason).toBe('GEO_TOO_FAR');
  });

  it('mengembalikan jarak untuk disimpan ke evidence.distance_to_place_m', () => {
    const { distanceM } = nilai(50, 10);
    expect(distanceM).toBeGreaterThan(49);
    expect(distanceM).toBeLessThan(51);
  });
});
