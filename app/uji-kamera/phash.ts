// pHash 64 bit (docs-00 §7): gambar abu-abu 32×32, DCT-II tanpa normalisasi,
// ambil blok 8×8 frekuensi terendah, bit = 1 kalau koefisien di atas median.
// Sama dengan imagehash.phash kecuali cara mengecilkan gambar, jadi server (C8)
// harus memakai langkah yang sama supaya ambangnya berlaku.

export const SISI = 32;
const BLOK = 8;

// cos((2x+1)uπ/64) untuk u < 8 dan x < 32.
const COS = Array.from({ length: BLOK }, (_, u) =>
  Array.from({ length: SISI }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * SISI))),
);

/** `abu`: 32×32 nilai kecerahan, baris demi baris. Hasil: 16 karakter heksa. */
export function phash(abu: ArrayLike<number>): string {
  const koef: number[] = [];
  for (let u = 0; u < BLOK; u++) {
    for (let v = 0; v < BLOK; v++) {
      let jumlah = 0;
      for (let y = 0; y < SISI; y++) {
        const cosY = COS[u][y];
        for (let x = 0; x < SISI; x++) jumlah += abu[y * SISI + x] * cosY * COS[v][x];
      }
      koef.push(jumlah);
    }
  }
  const urut = [...koef].sort((a, b) => a - b);
  const median = (urut[31] + urut[32]) / 2;
  let hex = "";
  for (let i = 0; i < koef.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (koef[i + j] > median ? 1 : 0);
    hex += nibble.toString(16);
  }
  return hex;
}

const JUMLAH_BIT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function jarakHamming(a: string, b: string): number {
  let jarak = 0;
  for (let i = 0; i < 16; i++) jarak += JUMLAH_BIT[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return jarak;
}

// Kontrak §7: identik bila jarak ≤ 2, mirip bila 3–6.
export function kategori(jarak: number): "identik" | "mirip" | "berbeda" {
  if (jarak <= 2) return "identik";
  if (jarak <= 6) return "mirip";
  return "berbeda";
}

export const POLA_HASH = /^[0-9a-f]{16}$/;
