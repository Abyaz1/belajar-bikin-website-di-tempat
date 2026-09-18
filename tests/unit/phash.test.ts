import { describe, expect, it } from 'vitest';
import {
  classifyDuplicate,
  evaluateC8,
  hammingDistance,
  normalizePhash,
  type C8Context,
  type PriorEvidence,
} from '@/lib/trust/phash';

const NOL = '0'.repeat(16);

/** Hash dengan tepat `n` bit menyala, sehingga jaraknya ke NOL persis `n`. */
function hashBit(n: number): string {
  const bit = '1'.repeat(n).padEnd(64, '0');
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bit.slice(i, i + 4), 2).toString(16);
  return hex;
}

const KTX: C8Context = {
  placeId: 'tempat-A',
  vantage: 'entrance',
  contributorId: 'orang-1',
};

const bukti = (over: Partial<PriorEvidence> = {}): PriorEvidence => ({
  evidenceId: 'bukti-lama',
  phash: NOL,
  placeId: 'tempat-A',
  vantage: 'entrance',
  contributorId: 'orang-1',
  ...over,
});

describe('normalizePhash', () => {
  it('menerima 16 digit hex dan menormalkan ke huruf kecil', () => {
    expect(normalizePhash('ABCDEF0123456789')).toBe('abcdef0123456789');
    expect(normalizePhash('  abcdef0123456789  ')).toBe('abcdef0123456789');
  });

  it('menolak panjang yang salah dan karakter non-hex', () => {
    expect(() => normalizePhash('abc')).toThrow(RangeError);
    expect(() => normalizePhash('0'.repeat(17))).toThrow(RangeError);
    expect(() => normalizePhash('z'.repeat(16))).toThrow(RangeError);
  });
});

describe('hammingDistance', () => {
  it('nol untuk hash yang sama, 64 untuk kebalikan penuh', () => {
    expect(hammingDistance(NOL, NOL)).toBe(0);
    expect(hammingDistance(NOL, 'f'.repeat(16))).toBe(64);
  });

  it('menghitung tepat, dan simetris', () => {
    for (const n of [1, 2, 3, 6, 7, 31]) {
      expect(hammingDistance(NOL, hashBit(n))).toBe(n);
      expect(hammingDistance(hashBit(n), NOL)).toBe(n);
    }
  });
});

/**
 * Matriks docs/10-trust.md §2.2, keenam kotaknya.
 *
 * Dua baris di bawah ini TIDAK BISA diuji lewat HTTP: "tempat berbeda" dan
 * "kontributor sama" menuntut menyiapkan bukti pada tempat lain atau memakai
 * ulang sesi yang sama, dan keduanya mengotori jejak audit tempat demo.
 * Di sini keduanya cuma dua baris.
 */
describe('classifyDuplicate — matriks konteks C8', () => {
  const kasus: Array<[string, Partial<PriorEvidence>, number, string]> = [
    ['kontributor sama, tempat sama     | hamming <= 2', {}, 1, 'fail'],
    ['kontributor sama, tempat sama     | hamming 3-6 ', {}, 5, 'fail'],
    ['kontributor beda, tempat+vantage  | hamming <= 2', { contributorId: 'orang-2' }, 2, 'fail'],
    ['kontributor beda, tempat+vantage  | hamming 3-6 ', { contributorId: 'orang-2' }, 5, 'flag'],
    ['tempat berbeda                    | hamming <= 2', { placeId: 'tempat-B', contributorId: 'orang-2' }, 2, 'fail'],
    ['tempat berbeda                    | hamming 3-6 ', { placeId: 'tempat-B', contributorId: 'orang-2' }, 5, 'fail'],
  ];

  for (const [nama, over, jarak, harap] of kasus) {
    it(`${nama} -> ${harap}`, () => {
      expect(classifyDuplicate(jarak, bukti(over), KTX)).toBe(harap);
    });
  }

  it('titik pandang berbeda di tempat yang sama bukan penguatan', () => {
    // Penguatan berarti dua orang memotret PINTU yang sama. Foto pintu masuk
    // dan foto toilet di gedung yang sama bukan saling menguatkan.
    expect(
      classifyDuplicate(5, bukti({ contributorId: 'orang-2', vantage: 'toilet' }), KTX),
    ).toBe('fail');
  });

  it('di luar ambang mirip tidak dianggap kecocokan, apa pun konteksnya', () => {
    for (const over of [{}, { contributorId: 'orang-2' }, { placeId: 'tempat-B' }]) {
      expect(classifyDuplicate(7, bukti(over), KTX)).toBe('none');
      expect(classifyDuplicate(64, bukti(over), KTX)).toBe('none');
    }
  });

  it('batasnya tepat di 2 dan 6, bukan di sekitarnya', () => {
    const beda = bukti({ contributorId: 'orang-2' });
    expect(classifyDuplicate(2, beda, KTX)).toBe('fail');   // masih identik
    expect(classifyDuplicate(3, beda, KTX)).toBe('flag');   // mulai penguatan
    expect(classifyDuplicate(6, beda, KTX)).toBe('flag');   // masih penguatan
    expect(classifyDuplicate(7, beda, KTX)).toBe('none');   // sudah berbeda
  });
});

describe('evaluateC8', () => {
  it('lolos kalau tidak ada bukti sebelumnya', () => {
    const hasil = evaluateC8(NOL, [], KTX);
    expect(hasil.verdict).toBe('none');
    expect(hasil.check.result).toBe('pass');
    expect(hasil.check.reason).toBeNull();
    expect(hasil.matchedEvidenceId).toBeNull();
  });

  it('melaporkan ambang yang benar-benar dilanggar, bukan ambang umum', () => {
    const identik = evaluateC8(NOL, [bukti({ phash: hashBit(1) })], KTX);
    expect(identik.check.threshold).toBe('hamming 2');

    const mirip = evaluateC8(
      NOL,
      [bukti({ phash: hashBit(5), contributorId: 'orang-2' })],
      KTX,
    );
    expect(mirip.check.threshold).toBe('hamming 6');
  });

  it('fail mengalahkan flag walau flag-nya lebih dekat', () => {
    const hasil = evaluateC8(
      NOL,
      [
        bukti({ evidenceId: 'penguatan', phash: hashBit(3), contributorId: 'orang-2' }),
        bukti({ evidenceId: 'dioper', phash: hashBit(6), placeId: 'tempat-B', contributorId: 'orang-3' }),
      ],
      KTX,
    );
    expect(hasil.verdict).toBe('fail');
    expect(hasil.matchedEvidenceId).toBe('dioper');
    expect(hasil.check.reason).toBe('DUPLICATE_IMAGE');
  });

  it('di antara sesama fail, yang paling dekat yang dilaporkan', () => {
    const hasil = evaluateC8(
      NOL,
      [
        bukti({ evidenceId: 'jauh', phash: hashBit(2) }),
        bukti({ evidenceId: 'dekat', phash: hashBit(1) }),
      ],
      KTX,
    );
    expect(hasil.matchedEvidenceId).toBe('dekat');
    expect(hasil.check.measured).toBe('hamming 1');
  });

  it('penguatan diterima sebagai flag, bukan ditolak', () => {
    // Inilah kotak yang menentukan di atas panggung: juri ikut memotret pintu
    // yang sama dan kontribusinya harus DITERIMA, ditandai sebagai penguatan.
    const hasil = evaluateC8(
      NOL,
      [bukti({ phash: hashBit(4), contributorId: 'juri' })],
      KTX,
    );
    expect(hasil.verdict).toBe('flag');
    expect(hasil.check.result).toBe('flag');
    expect(hasil.check.reason).toBeNull();   // flag bukan penolakan
    expect(hasil.check.measured).toBe('hamming 4');
  });

  it('mengabaikan bukti yang jaraknya di luar ambang mirip', () => {
    const hasil = evaluateC8(NOL, [bukti({ phash: hashBit(20) })], KTX);
    expect(hasil.check.result).toBe('pass');
    expect(hasil.matchedHamming).toBeNull();
  });
});
