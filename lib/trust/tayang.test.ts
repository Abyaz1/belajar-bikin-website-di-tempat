import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { readPublic } from './storage';
import { buatFotoTayang, kotakDariVision, simpanFotoTayang, type Kotak } from './tayang';

/** Citra uji berpola papan catur halus: wilayah yang dipikselkan kehilangan polanya. */
async function citra(lebar: number, tinggi: number): Promise<Buffer> {
  const px = Buffer.alloc(lebar * tinggi * 3);
  for (let y = 0; y < tinggi; y += 1) {
    for (let x = 0; x < lebar; x += 1) {
      const v = (x >> 2) % 2 === (y >> 2) % 2 ? 230 : 20;
      px.set([v, v, v], (y * lebar + x) * 3);
    }
  }
  return sharp(px, { raw: { width: lebar, height: tinggi, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

/** Simpangan baku kecerahan di dalam kotak: pola tajam tinggi, hasil pemikselan rendah. */
async function ragam(jpeg: Buffer, k: Kotak): Promise<number> {
  const { data } = await sharp(jpeg).extract(k).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rata = data.reduce((a, b) => a + b, 0) / data.length;
  return Math.sqrt(data.reduce((a, b) => a + (b - rata) ** 2, 0) / data.length);
}

describe('buatFotoTayang', () => {
  it('mengecilkan ke sisi 1200 px dan memikselkan wilayah wajah, sisanya tetap tajam', async () => {
    const wajah: Kotak = { left: 400, top: 300, width: 200, height: 200 };
    const { jpeg, wajah: n } = await buatFotoTayang(await citra(1600, 1200), async () => [wajah]);
    const meta = await sharp(jpeg).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 900]);
    expect(n).toBe(1);
    expect(await ragam(jpeg, wajah)).toBeLessThan(20);
    expect(await ragam(jpeg, { left: 900, top: 600, width: 200, height: 200 })).toBeGreaterThan(60);
  });

  it('tanpa wajah terdeteksi tetap menghasilkan foto tayang tanpa metadata', async () => {
    const asli = await sharp(await citra(800, 600)).withMetadata({ exif: { IFD0: { Make: 'Uji' } } }).toBuffer();
    const { jpeg, wajah } = await buatFotoTayang(asli, async () => []);
    expect(wajah).toBe(0);
    expect((await sharp(jpeg).metadata()).exif).toBeUndefined();
  });

  it('kotak di tepi dipotong ke batas citra, bukan membuat galat', async () => {
    const { wajah } = await buatFotoTayang(await citra(800, 600), async () => [{ left: 760, top: 560, width: 100, height: 100 }]);
    expect(wajah).toBe(1);
  });
});

describe('gagal tertutup', () => {
  it('deteksi gagal → null, jadi public_path tidak ditulis dan foto tidak tayang', async () => {
    const hasil = await simpanFotoTayang(await citra(400, 300), '11111111-1111-4111-8111-000000000001', async () => {
      throw new Error('Cloud Vision HTTP 403');
    });
    expect(hasil).toBeNull();
  });

  it('penyaji menolak kunci objek asli', async () => {
    await expect(readPublic('evidence/11111111-1111-4111-8111-000000000001/0123456789abcdef0123456789abcdef.jpg')).rejects.toThrow(
      'tidak sah',
    );
    await expect(readPublic('tayang/../evidence/x.jpg')).rejects.toThrow('tidak sah');
  });
});

describe('kotakDariVision', () => {
  it('boundingPoly jadi kotak; koordinat yang tidak dikirim API berarti 0', () => {
    expect(
      kotakDariVision({
        responses: [{ faceAnnotations: [{ boundingPoly: { vertices: [{ y: 10 }, { x: 50, y: 10 }, { x: 50, y: 80 }, { y: 80 }] } }] }],
      }),
    ).toEqual([{ left: 0, top: 10, width: 50, height: 70 }]);
    expect(kotakDariVision({ responses: [{}] })).toEqual([]);
  });

  it('galat dari API dilempar, bukan dianggap nol wajah', () => {
    expect(() => kotakDariVision({ responses: [{ error: { code: 7, message: 'API belum aktif' } }] })).toThrow('API belum aktif');
    expect(() => kotakDariVision({})).toThrow();
  });
});
