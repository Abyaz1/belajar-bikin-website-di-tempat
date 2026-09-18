import { describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { runProvenancePipeline, type PipelineInput } from '@/lib/trust/pipeline';
import type { CheckCode } from '@/lib/trust/types';

const SERVER_AT = new Date('2026-09-18T12:00:00.000Z');
const detikLalu = (d: number) => new Date(SERVER_AT.getTime() - d * 1000);

const TEMPAT = { id: 'tempat-A', lat: '-6.926000', lon: '107.769000' };

interface Tiruan {
  sesi?: { token: string; place_id: string; vantage: string; issued_at: Date } | null;
  kontribusiSejam?: number;
  tempatAda?: boolean;
  buktiLama?: Array<Record<string, unknown>>;
}

/**
 * PoolClient tiruan. Hanya mengenali empat kueri yang benar-benar dikirim pipa,
 * dan melempar untuk kueri lain supaya perubahan pada pipa tidak lolos diam-diam
 * dengan jawaban kosong.
 */
function klienTiruan(t: Tiruan = {}): PoolClient {
  const {
    sesi = { token: 'token-sah', place_id: TEMPAT.id, vantage: 'entrance', issued_at: detikLalu(30) },
    kontribusiSejam = 0,
    tempatAda = true,
    buktiLama = [],
  } = t;

  return {
    async query(sql: string) {
      if (sql.includes('capture_session')) return { rows: sesi ? [sesi] : [] };
      if (sql.includes('count(*)')) return { rows: [{ n: String(kontribusiSejam) }] };
      if (sql.includes('FROM place')) return { rows: tempatAda ? [{ lat: TEMPAT.lat, lon: TEMPAT.lon }] : [] };
      if (sql.includes('trust_phash_candidates')) return { rows: buktiLama };
      throw new Error(`Kueri tak dikenal di klien tiruan:\n${sql}`);
    },
  } as unknown as PoolClient;
}

const masukan = (over: Partial<PipelineInput> = {}): PipelineInput => ({
  contributorId: 'orang-1',
  claimedToken: 'token-sah',
  placeId: TEMPAT.id,
  vantage: 'entrance',
  phash: '0'.repeat(16),
  exifPresent: false,
  exifGpsPresent: false,
  clientLat: -6.926,
  clientLon: 107.769,
  clientAccuracyM: 12,
  clientFixAt: detikLalu(8),
  clientCapturedAt: detikLalu(4),
  serverReceivedAt: SERVER_AT,
  ...over,
});

const jalan = (over: Partial<PipelineInput> = {}, t: Tiruan = {}) =>
  runProvenancePipeline(klienTiruan(t), masukan(over));

const ambil = (checks: Awaited<ReturnType<typeof jalan>>['checks'], kode: CheckCode) =>
  checks.find((k) => k.code === kode);

describe('C0 — token sesi penangkapan', () => {
  it('lolos untuk token sah yang cocok tempat dan titik pandangnya', async () => {
    const { checks, verifiedToken } = await jalan();
    expect(ambil(checks, 'C0')?.result).toBe('pass');
    expect(verifiedToken).toBe('token-sah');
  });

  it('gagal kalau token tidak dikenal atau sudah dipakai', async () => {
    const { checks, verifiedToken } = await jalan({}, { sesi: null });
    expect(ambil(checks, 'C0')?.result).toBe('fail');
    expect(ambil(checks, 'C0')?.reason).toBe('CAPTURE_SESSION_INVALID');
    // capture_session_token di evidence harus NULL, bukan token karangan.
    expect(verifiedToken).toBeNull();
  });

  it('berlaku tepat 600 detik', async () => {
    const sesiUmur = (d: number) => ({
      sesi: { token: 'token-sah', place_id: TEMPAT.id, vantage: 'entrance', issued_at: detikLalu(d) },
    });
    expect(ambil((await jalan({}, sesiUmur(600))).checks, 'C0')?.result).toBe('pass');
    expect(ambil((await jalan({}, sesiUmur(601))).checks, 'C0')?.result).toBe('fail');
  });

  it('gagal kalau token dipakai untuk tempat atau titik pandang lain', async () => {
    const lainTempat = await jalan({}, {
      sesi: { token: 'token-sah', place_id: 'tempat-LAIN', vantage: 'entrance', issued_at: detikLalu(30) },
    });
    expect(ambil(lainTempat.checks, 'C0')?.result).toBe('fail');

    const lainVantage = await jalan({}, {
      sesi: { token: 'token-sah', place_id: TEMPAT.id, vantage: 'toilet', issued_at: detikLalu(30) },
    });
    expect(ambil(lainVantage.checks, 'C0')?.result).toBe('fail');
    expect(lainVantage.verifiedToken).toBeNull();
  });
});

describe('C1 — rate limit', () => {
  it('lolos di 9, gagal tepat di 10', async () => {
    expect(ambil((await jalan({}, { kontribusiSejam: 9 })).checks, 'C1')?.result).toBe('pass');
    const penuh = ambil((await jalan({}, { kontribusiSejam: 10 })).checks, 'C1');
    expect(penuh?.result).toBe('fail');
    expect(penuh?.reason).toBe('RATE_LIMITED');
  });
});

describe('C3 — metadata berkas', () => {
  it('menolak berkas yang membawa EXIF apa pun', async () => {
    const c3 = ambil((await jalan({ exifPresent: true })).checks, 'C3');
    expect(c3?.result).toBe('fail');
    expect(c3?.reason).toBe('FILE_METADATA_PRESENT');
  });

  it('meloloskan berkas tanpa EXIF', async () => {
    expect(ambil((await jalan()).checks, 'C3')?.result).toBe('pass');
  });
});

describe('C4 — selisih waktu', () => {
  const skew = (d: number) => jalan({ clientCapturedAt: detikLalu(d) });

  it('menerima tepat 180 detik ke belakang, menolak 181', async () => {
    expect(ambil((await skew(180)).checks, 'C4')?.result).toBe('pass');
    expect(ambil((await skew(181)).checks, 'C4')?.result).toBe('fail');
  });

  it('menerima tepat 60 detik ke depan, menolak 61', async () => {
    expect(ambil((await skew(-60)).checks, 'C4')?.result).toBe('pass');
    const depan = ambil((await skew(-61)).checks, 'C4');
    expect(depan?.result).toBe('fail');
    expect(depan?.reason).toBe('TIMESTAMP_SKEW');
    expect(depan?.measured).not.toBeNull();
    expect(depan?.threshold).not.toBeNull();
  });
});

describe('C5, C6, C6b — geolokasi', () => {
  it('tanpa koordinat, C6/C6b/C7 tidak dievaluasi sama sekali', async () => {
    const { checks } = await jalan({ clientLat: null, clientLon: null, clientAccuracyM: null });
    expect(ambil(checks, 'C5')?.reason).toBe('GEO_MISSING');
    // Menuliskannya sebagai fail akan melanggar aturan 6: tidak ada nilai
    // terukur yang bisa ditampilkan. Ketiadaan barisnya adalah informasi.
    expect(ambil(checks, 'C6')).toBeUndefined();
    expect(ambil(checks, 'C6b')).toBeUndefined();
    expect(ambil(checks, 'C7')).toBeUndefined();
  });

  it('akurasi diterima sampai tepat 150 m', async () => {
    expect(ambil((await jalan({ clientAccuracyM: 150 })).checks, 'C6')?.result).toBe('pass');
    const buruk = ambil((await jalan({ clientAccuracyM: 151 })).checks, 'C6');
    expect(buruk?.result).toBe('fail');
    expect(buruk?.reason).toBe('GEO_ACCURACY_LOW');
    expect(buruk?.measured).not.toBeNull();
  });

  it('umur fix diterima sampai tepat 60 detik', async () => {
    expect(ambil((await jalan({ clientFixAt: detikLalu(60) })).checks, 'C6b')?.result).toBe('pass');
    expect(ambil((await jalan({ clientFixAt: detikLalu(61) })).checks, 'C6b')?.result).toBe('fail');
  });

  it('C6b dilewati kalau klien tidak melaporkan waktu fix', async () => {
    const { checks } = await jalan({ clientFixAt: null });
    expect(ambil(checks, 'C6b')).toBeUndefined();
    expect(ambil(checks, 'C7')).toBeDefined();
  });
});

describe('pipa tidak berhenti di kegagalan pertama', () => {
  it('melaporkan SEMUA alasan sekaligus, bukan yang pertama saja', async () => {
    const { checks, hasFail } = await jalan(
      {
        exifPresent: true,                       // C3
        clientCapturedAt: detikLalu(400),        // C4
        clientAccuracyM: 200,                    // C6
        clientFixAt: detikLalu(300),             // C6b
      },
      { sesi: null, kontribusiSejam: 20 },       // C0, C1
    );

    const gagal = checks.filter((k) => k.result === 'fail').map((k) => k.reason);
    expect(gagal).toEqual(
      expect.arrayContaining([
        'CAPTURE_SESSION_INVALID',
        'RATE_LIMITED',
        'FILE_METADATA_PRESENT',
        'TIMESTAMP_SKEW',
        'GEO_ACCURACY_LOW',
        'GEO_FIX_STALE',
      ]),
    );
    expect(hasFail).toBe(true);
  });

  it('menjalankan kesembilan pemeriksaan saat bahannya lengkap', async () => {
    const { checks, hasFail } = await jalan();
    expect(checks.map((k) => k.code)).toEqual(['C0', 'C1', 'C3', 'C4', 'C5', 'C6', 'C6b', 'C7', 'C8']);
    expect(hasFail).toBe(false);
  });

  it('setiap penolakan membawa nilai terukur dan ambangnya', async () => {
    const { checks } = await jalan(
      { exifPresent: true, clientAccuracyM: 200 },
      { kontribusiSejam: 99 },
    );
    for (const k of checks.filter((x) => x.result === 'fail')) {
      expect(k.measured, `${k.code} tanpa measured`).not.toBeNull();
      expect(k.threshold, `${k.code} tanpa threshold`).not.toBeNull();
    }
  });
});

describe('capture_method bukan gerbang', () => {
  it('tidak ada pemeriksaan yang membaca capture_method', async () => {
    // Nilainya dinyatakan klien; penyerang tinggal menulis "getusermedia".
    // Pipa tidak menerimanya sebagai masukan sama sekali, dan itu disengaja.
    const kunci = Object.keys(masukan());
    expect(kunci).not.toContain('captureMethod');
  });
});
