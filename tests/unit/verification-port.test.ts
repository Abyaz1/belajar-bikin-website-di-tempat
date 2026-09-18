import { describe, expect, it } from 'vitest';
import { mintaUsulan } from '@/lib/trust/verification-port';

/**
 * Seam ini pernah gagal SENYAP: bentuk yang dicari tidak cocok dengan modul yang
 * mendarat, impor dinamisnya melempar, catch menelannya, dan alur kontribusi
 * berjalan tanpa usulan tanpa satu pun galat di log. Tes di bawah mengunci agar
 * kegagalan seperti itu selalu punya nama dan sebab.
 *
 * Di cabang ini lib/verification memang belum ada, jadi jalur mundurnya justru
 * yang sedang diuji dengan kondisi sungguhan, bukan tiruan.
 */
describe('mintaUsulan saat modul verifikasi tidak tersedia', () => {
  it('tidak pernah melempar', async () => {
    // Alur kontribusi tidak boleh bergantung pada model. Kalau ini melempar,
    // E4 membalas 500 dan kontribusi yang sah ikut gagal.
    await expect(
      mintaUsulan({ image: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', vantage: 'entrance', attributes: [] }),
    ).resolves.toBeDefined();
  });

  it('melaporkan status dan sebab, bukan daftar kosong tanpa keterangan', async () => {
    const hasil = await mintaUsulan({
      image: new Uint8Array([1, 2, 3]),
      mimeType: 'image/jpeg',
      vantage: 'entrance',
      attributes: [{ attribute_code: 'step_count', ai_suggestable: true, allowed_values: ['0', '1'] }],
    });

    expect(hasil.suggestions).toEqual([]);
    // Yang membedakan "model bilang tidak ada yang terlihat" dari "model tidak
    // pernah menjawab". Tanpa keduanya, antarmuka hanya melihat daftar kosong.
    expect(hasil.status).not.toBe('ok');
    expect(hasil.reason).toBeTruthy();
  });

  it('memenuhi bentuk SuggestResult secara utuh', async () => {
    const hasil = await mintaUsulan({
      image: new Uint8Array([1]), mimeType: 'image/jpeg', vantage: 'toilet', attributes: [],
    });
    expect(Object.keys(hasil).sort()).toEqual(
      ['latency_ms', 'model', 'prompt_version', 'reason', 'status', 'suggestions'],
    );
    expect(['ok', 'off', 'failed', 'timeout']).toContain(hasil.status);
  });
});
