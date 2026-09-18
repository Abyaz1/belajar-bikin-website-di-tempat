/**
 * Kalibrasi ambang pHash dari hash yang dihitung SERVER.
 *
 * docs/10-trust.md §2.2 menyuruh menguji ambang dengan dua orang memotret
 * pintu yang sama. Perkakas yang ada untuk itu, halaman /uji-kamera, menghitung
 * hash di peramban — dan hash peramban BUKAN hash yang menegakkan ambangnya.
 * Keduanya berbeda karena dua hal: basis median (klien menyertakan koefisien DC,
 * server membuangnya) dan cara mengecilkan gambar (canvas vs sharp). Ambang yang
 * dikalibrasi dari angka peramban karena itu tidak berlaku untuk C8.
 *
 * Skrip ini memanggil lib/trust/image.ts dan lib/trust/phash.ts — modul yang
 * persis sama dengan yang dijalankan E4. Angkanya angka yang akan dipakai
 * memutuskan, bukan pendekatannya.
 *
 * Pakai:
 *   npm run phash:kalibrasi -- --sama pintuA-1.jpg pintuA-2.jpg \
 *                             --beda pintuB.jpg pintuC.jpg
 *
 *   --sama  foto-foto dari PINTU YANG SAMA, diambil orang berbeda.
 *           Semua pasangannya harus masuk pita penguatan, bukan ditolak.
 *   --beda  foto dari pintu BERBEDA.
 *           Tidak satu pun pasangannya boleh dianggap cocok.
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { trustConfig } from '../lib/trust/config';
import { computePhash } from '../lib/trust/image';
import { classifyDuplicate, hammingDistance } from '../lib/trust/phash';
import type { PriorEvidence, C8Context } from '../lib/trust/phash';

interface Berkas {
  nama: string;
  hash: string;
  grup: 'sama' | 'beda';
}

function baca(argv: string[]): { sama: string[]; beda: string[] } {
  const out = { sama: [] as string[], beda: [] as string[] };
  let grup: 'sama' | 'beda' | null = null;
  for (const arg of argv) {
    if (arg === '--sama') { grup = 'sama'; continue; }
    if (arg === '--beda') { grup = 'beda'; continue; }
    if (arg.startsWith('-')) continue;
    if (!grup) {
      console.error('Setiap berkas harus didahului --sama atau --beda.');
      process.exit(2);
    }
    out[grup].push(arg);
  }
  return out;
}

// Konteks kalibrasi: orang BERBEDA, tempat dan titik pandang SAMA. Itu satu-
// satunya kotak matriks §2.2 yang boleh menghasilkan flag.
const KONTEKS: C8Context = {
  placeId: 'kalibrasi',
  vantage: 'entrance',
  contributorId: 'orang-1',
};

const sebagaiBukti = (b: Berkas): PriorEvidence => ({
  evidenceId: b.nama,
  phash: b.hash,
  placeId: 'kalibrasi',
  vantage: 'entrance',
  contributorId: 'orang-2',      // sengaja berbeda dari KONTEKS
});

async function main() {
  const { sama, beda } = baca(process.argv.slice(2));
  if (sama.length + beda.length < 2) {
    console.error('Butuh minimal dua berkas. Jalankan tanpa argumen untuk melihat contoh di kepala berkas ini.');
    process.exit(2);
  }

  const berkas: Berkas[] = [];
  for (const [grup, daftar] of [['sama', sama], ['beda', beda]] as const) {
    for (const jalur of daftar) {
      berkas.push({
        nama: basename(jalur),
        hash: await computePhash(await readFile(jalur)),
        grup,
      });
    }
  }

  console.log('\npHash dihitung SERVER (lib/trust/image.ts), bukan peramban.');
  console.log(`Ambang berlaku: identik <= ${trustConfig.phashIdenticalMax}, `
    + `mirip ${trustConfig.phashIdenticalMax + 1}-${trustConfig.phashSimilarMax}\n`);

  for (const b of berkas) {
    console.log(`  ${b.hash}  [${b.grup}] ${b.nama}`);
  }

  const pasangan: Array<{ a: Berkas; b: Berkas; jarak: number; hasil: string }> = [];
  for (let i = 0; i < berkas.length; i += 1) {
    for (let j = i + 1; j < berkas.length; j += 1) {
      const a = berkas[i];
      const b = berkas[j];
      const jarak = hammingDistance(a.hash, b.hash);
      pasangan.push({ a, b, jarak, hasil: classifyDuplicate(jarak, sebagaiBukti(b), KONTEKS) });
    }
  }

  console.log('\nJarak antar pasangan:');
  for (const p of pasangan.sort((x, y) => x.jarak - y.jarak)) {
    const label = p.a.grup === p.b.grup && p.a.grup === 'sama' ? 'pintu sama' : 'pintu beda';
    console.log(`  ${String(p.jarak).padStart(3)}  ${p.hasil.padEnd(5)}  ${label}  ${p.a.nama} <-> ${p.b.nama}`);
  }

  const pintuSama = pasangan.filter((p) => p.a.grup === 'sama' && p.b.grup === 'sama');
  const pintuBeda = pasangan.filter((p) => !(p.a.grup === 'sama' && p.b.grup === 'sama'));

  console.log('\nKesimpulan:');
  let sehat = true;

  if (pintuSama.length) {
    const maks = Math.max(...pintuSama.map((p) => p.jarak));
    const tertolak = pintuSama.filter((p) => p.hasil === 'fail');
    console.log(`  Pintu sama : jarak terjauh ${maks}`);
    if (tertolak.length) {
      sehat = false;
      console.log(`    ${tertolak.length} pasangan DITOLAK. Ambang mirip terlalu ketat,`);
      console.log(`    atau jaraknya <= ${trustConfig.phashIdenticalMax} sehingga dianggap berkas yang sama.`);
      for (const p of tertolak) console.log(`      ${p.jarak}  ${p.a.nama} <-> ${p.b.nama}`);
    }
    // Hasil yang BENAR untuk pasangan pintu-sama adalah `flag`, bukan sekadar
    // "tidak ditolak". Hasil `none` berarti jaraknya di atas pita penguatan,
    // sehingga dua kontributor yang memotret pintu yang sama dianggap tidak
    // berhubungan sama sekali — penguatan terlewat, bukan penguatan tertangkap.
    const terlewat = pintuSama.filter((p) => p.hasil === 'none');
    if (terlewat.length) {
      sehat = false;
      console.log(`    ${terlewat.length} pasangan TIDAK tertangkap sebagai penguatan.`);
      console.log(`    Jaraknya di atas ambang mirip ${trustConfig.phashSimilarMax}, jadi dua kontributor`);
      console.log(`    yang memotret pintu sama dianggap tidak berhubungan. Pita penguatan`);
      console.log(`    tidak terjangkau oleh tangkapan yang benar-benar terpisah.`);
      for (const p of terlewat) console.log(`      ${p.jarak}  ${p.a.nama} <-> ${p.b.nama}`);
    }
    if (!tertolak.length && !terlewat.length) {
      console.log(`    Semua masuk pita penguatan. Ambang mirip ${trustConfig.phashSimilarMax} memadai`);
      console.log(`    dengan sisa ruang ${trustConfig.phashSimilarMax - maks}.`);
    }
  }

  if (pintuBeda.length) {
    const min = Math.min(...pintuBeda.map((p) => p.jarak));
    const salahCocok = pintuBeda.filter((p) => p.hasil !== 'none');
    console.log(`  Pintu beda : jarak terdekat ${min}`);
    if (salahCocok.length) {
      sehat = false;
      console.log(`    ${salahCocok.length} pasangan salah dianggap cocok. Ambang mirip terlalu longgar.`);
      for (const p of salahCocok) console.log(`      ${p.jarak}  ${p.a.nama} <-> ${p.b.nama}`);
    } else {
      console.log(`    Tidak ada yang salah cocok. Jarak aman ${min - trustConfig.phashSimilarMax} di atas ambang.`);
    }
  }

  if (pintuSama.length && pintuBeda.length) {
    const maksSama = Math.max(...pintuSama.map((p) => p.jarak));
    const minBeda = Math.min(...pintuBeda.map((p) => p.jarak));
    console.log(`\n  Celah pemisah: ${maksSama} .. ${minBeda}`);
    if (minBeda - maksSama <= 1) {
      sehat = false;
      console.log('    Terlalu sempit. Tidak ada ambang yang memisahkan keduanya dengan bersih;');
      console.log('    sebut ini apa adanya sebagai batasan, jangan dipaksa dengan memilih satu angka.');
    } else {
      console.log(`    Ambang mana pun di ${maksSama} .. ${minBeda - 1} memisahkan keduanya.`);
    }
  }

  console.log(sehat
    ? '\n  Ambang yang berlaku sekarang konsisten dengan citra uji ini.\n'
    : '\n  Ambang yang berlaku sekarang TIDAK konsisten. Catat angkanya di PERUBAHAN.md sebelum mengubahnya.\n');
}

main().catch((galat: unknown) => {
  console.error(galat instanceof Error ? galat.message : galat);
  process.exit(1);
});
