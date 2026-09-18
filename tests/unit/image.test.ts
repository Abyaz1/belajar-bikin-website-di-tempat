import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { computePhash } from '@/lib/trust/image';

/** Citra gradien 64x64 abu-abu, ditentukan sepenuhnya oleh `seed`. */
async function citra(seed: number): Promise<Buffer> {
  const sisi = 64;
  const piksel = Buffer.alloc(sisi * sisi);
  for (let y = 0; y < sisi; y += 1) {
    for (let x = 0; x < sisi; x += 1) {
      piksel[y * sisi + x] = (x * seed + y * (seed * 7 + 3)) % 256;
    }
  }
  return sharp(piksel, { raw: { width: sisi, height: sisi, channels: 1 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe('computePhash', () => {
  it('menghasilkan 16 digit hex huruf kecil', async () => {
    const hash = await computePhash(await citra(3));
    // Bentuk ini dijaga CHECK di DDL: phash ~ '^[0-9a-f]{16}$'.
    // Kalau berubah, INSERT ke evidence akan ditolak basis data.
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('deterministik untuk berkas yang sama', async () => {
    const berkas = await citra(5);
    expect(await computePhash(berkas)).toBe(await computePhash(berkas));
  });

  it('membedakan citra yang berbeda', async () => {
    const a = await computePhash(await citra(3));
    const b = await computePhash(await citra(11));
    expect(a).not.toBe(b);
  });

  it('melempar untuk berkas yang bukan gambar', async () => {
    await expect(computePhash(Buffer.from('bukan gambar', 'latin1'))).rejects.toThrow();
  });
});
