import sharp from 'sharp';
import { trustConfig } from './config';

const N = 32;          // ukuran citra kerja sebelum DCT
const K = 8;           // blok frekuensi rendah yang dipakai → 64 bit

/** Tabel kosinus DCT-II, dihitung sekali. */
const COS = (() => {
  const t = new Float64Array(N * N);
  for (let u = 0; u < N; u += 1) {
    for (let x = 0; x < N; x += 1) {
      t[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
    }
  }
  return t;
})();

/**
 * Perceptual hash 64 bit, DCT-based, ditulis sendiri.
 *
 * Grayscale → 32x32 → DCT-II 2D → ambil blok 8x8 frekuensi terendah →
 * bandingkan tiap koefisien terhadap median → 64 bit → hex.
 *
 * Koefisien DC (0,0) dikeluarkan dari perhitungan median karena dia hanya
 * mencerminkan kecerahan rata-rata; memasukkannya membuat median bergeser
 * dan hash jadi sensitif terhadap pencahayaan, padahal justru dua orang
 * memotret pintu yang sama pada pencahayaan berbeda adalah kasus yang
 * harus tetap berdekatan.
 */
export async function computePhash(buf: Buffer): Promise<string> {
  const px = await sharp(buf)
    .greyscale()
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer();

  if (px.length < N * N) throw new Error('Gagal membaca piksel citra untuk pHash.');

  // DCT baris
  const rows = new Float64Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let u = 0; u < K; u += 1) {
      let s = 0;
      for (let x = 0; x < N; x += 1) s += px[y * N + x] * COS[u * N + x];
      rows[y * N + u] = s;
    }
  }

  // DCT kolom, hanya blok KxK yang dipakai
  const block = new Float64Array(K * K);
  for (let u = 0; u < K; u += 1) {
    for (let v = 0; v < K; v += 1) {
      let s = 0;
      for (let y = 0; y < N; y += 1) s += rows[y * N + u] * COS[v * N + y];
      block[v * K + u] = s;
    }
  }

  const forMedian = Array.from(block).slice(1).sort((a, b) => a - b);
  const median = (forMedian[30] + forMedian[31]) / 2;

  let hex = '';
  for (let i = 0; i < K * K; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j += 1) {
      nibble = (nibble << 1) | (block[i + j] > median ? 1 : 0);
    }
    hex += nibble.toString(16);
  }

  if (hex.length !== trustConfig.phashBits / 4) {
    throw new Error(`pHash panjangnya ${hex.length}, seharusnya ${trustConfig.phashBits / 4}.`);
  }
  return hex;
}
