import { describe, expect, it } from 'vitest';
import { CAPTURE_MODE, trustConfig } from '@/lib/trust/config';

/**
 * Berkas ini menjaga agar seluruh berkas uji lain punya pijakan.
 *
 * Ambang di lib/trust/config.ts bisa ditimpa lewat env. Kalau ada yang
 * menjalankan suite dengan RATE_LIMIT_PER_HOUR atau GEO_FAIL_RADIUS_M yang
 * berbeda, tes-tes di berkas lain akan gagal di tempat yang membingungkan.
 * Yang gagal duluan harus yang ini, dengan pesan yang jelas.
 */
describe('konfigurasi terpusat sama dengan docs/00-KONTRAK.md §7', () => {
  it('memakai nilai kontrak yang dibekukan jam 10:00', () => {
    expect(trustConfig).toMatchObject({
      rateLimitPerHour: 10,
      skewMaxBehindS: 180,
      skewMaxAheadS: 60,
      geoMaxAccuracyM: 150,
      geoMaxFixAgeS: 60,
      geoBaseRadiusM: 75,
      geoFailRadiusM: 120,
      phashBits: 64,
      phashIdenticalMax: 2,
      phashSimilarMax: 6,
      captureTokenTtlS: 600,
      uploadMaxBytes: 5 * 1024 * 1024,
    });
  });

  it('mekanisme kamera dibekukan ke getUserMedia', () => {
    // Kalau ini berubah, aturan C3 ikut berubah dari "ada EXIF apa pun"
    // menjadi "ada tag GPS", dan bobotnya turun dari fail jadi flag.
    // Itu perubahan kontrak, bukan penyetelan.
    expect(CAPTURE_MODE).toBe('getusermedia');
  });

  it('radius dasar tidak melebihi batas gagal', () => {
    // Kalau dilanggar, tidak akan pernah ada jalur pass di C7.
    expect(trustConfig.geoBaseRadiusM).toBeLessThanOrEqual(trustConfig.geoFailRadiusM);
  });

  it('ambang duplikat identik tidak melebihi ambang mirip', () => {
    expect(trustConfig.phashIdenticalMax).toBeLessThanOrEqual(trustConfig.phashSimilarMax);
  });
});
