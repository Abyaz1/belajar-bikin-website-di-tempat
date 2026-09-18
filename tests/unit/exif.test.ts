import { describe, expect, it } from 'vitest';
import { isJpeg, scanJpegMetadata } from '@/lib/trust/exif';

/** Satu segmen JPEG: penanda + panjang (termasuk dirinya) + muatan. */
function segmen(penanda: number, muatan: Buffer): Buffer {
  const kepala = Buffer.alloc(4);
  kepala.writeUInt16BE(penanda, 0);
  kepala.writeUInt16BE(muatan.length + 2, 2);
  return Buffer.concat([kepala, muatan]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const SOS = Buffer.from([0xff, 0xda, 0x00, 0x02]);
const DATA_GAMBAR = Buffer.alloc(32, 0x5a);

function jpeg(...segmenSegmen: Buffer[]): Buffer {
  return Buffer.concat([SOI, ...segmenSegmen, SOS, DATA_GAMBAR]);
}

/** APP0/JFIF — yang dihasilkan canvas.toBlob(), tanpa EXIF sama sekali. */
const APP0_JFIF = segmen(0xffe0, Buffer.concat([
  Buffer.from('JFIF\0', 'latin1'),
  Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
]));

/** APP1/Exif dengan TIFF little-endian berisi satu entri IFD0. */
function app1Exif(tag: number): Buffer {
  const ifd = Buffer.alloc(2 + 12);
  ifd.writeUInt16LE(1, 0);            // jumlah entri
  ifd.writeUInt16LE(tag, 2);          // tag
  ifd.writeUInt16LE(3, 4);            // tipe SHORT
  ifd.writeUInt32LE(1, 6);            // jumlah nilai
  ifd.writeUInt32LE(0, 10);           // nilai

  const tiff = Buffer.alloc(8);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(0x002a, 2);
  tiff.writeUInt32LE(8, 4);           // offset ke IFD0

  return segmen(0xffe1, Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    tiff,
    ifd,
  ]));
}

const APP1_XMP = segmen(0xffe1, Buffer.concat([
  Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'),
  Buffer.from('<x:xmpmeta/>', 'latin1'),
]));

/** APP2 ICC — Chrome menyisipkan ini pada keluaran canvas.toBlob(). */
const APP2_ICC = segmen(0xffe2, Buffer.concat([
  Buffer.from('ICC_PROFILE\0', 'latin1'),
  Buffer.from([0x01, 0x01]),
  Buffer.alloc(128, 0x00),
]));

/** APP13 Photoshop IRB dan APP14 Adobe — jejak perkakas penyunting. */
const APP13_PHOTOSHOP = segmen(0xffed, Buffer.from('Photoshop 3.0\0 jejak', 'latin1'));
const APP14_ADOBE = segmen(0xffee, Buffer.from('Adobe\0 jejak', 'latin1'));

const TAG_MAKE = 0x010f;
const TAG_GPS_IFD = 0x8825;

describe('isJpeg', () => {
  it('mengenali penanda SOI', () => {
    expect(isJpeg(jpeg(APP0_JFIF))).toBe(true);
  });

  it('menolak berkas lain dan buffer terlalu pendek', () => {
    expect(isJpeg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);   // PNG
    expect(isJpeg(Buffer.alloc(0))).toBe(false);
    expect(isJpeg(Buffer.from([0xff]))).toBe(false);
  });
});

describe('scanJpegMetadata', () => {
  it('JPEG hasil canvas tidak membawa EXIF', () => {
    // Inilah bentuk yang dihasilkan getUserMedia lewat canvas.toBlob().
    expect(scanJpegMetadata(jpeg(APP0_JFIF))).toEqual({
      exifPresent: false,
      exifGpsPresent: false,
    });
  });

  it('mengenali EXIF tanpa blok GPS', () => {
    expect(scanJpegMetadata(jpeg(APP0_JFIF, app1Exif(TAG_MAKE)))).toEqual({
      exifPresent: true,
      exifGpsPresent: false,
    });
  });

  it('mengenali pointer GPS IFD', () => {
    expect(scanJpegMetadata(jpeg(APP0_JFIF, app1Exif(TAG_GPS_IFD)))).toEqual({
      exifPresent: true,
      exifGpsPresent: true,
    });
  });

  it('menghitung XMP sebagai metadata galeri', () => {
    // XMP juga jejak perkakas galeri, walau bukan EXIF secara teknis.
    const hasil = scanJpegMetadata(jpeg(APP0_JFIF, APP1_XMP));
    expect(hasil.exifPresent).toBe(true);
    expect(hasil.exifGpsPresent).toBe(false);
  });

  it('berhenti di SOS dan tidak memindai data gambar', () => {
    // Data gambar bisa saja memuat urutan byte yang mirip penanda segmen.
    const palsu = Buffer.concat([
      SOI, APP0_JFIF, SOS,
      Buffer.from([0xff, 0xe1, 0x00, 0x10]),
      Buffer.from('Exif\0\0', 'latin1'),
    ]);
    expect(scanJpegMetadata(palsu).exifPresent).toBe(false);
  });

  it('tidak melempar untuk berkas terpotong atau rusak', () => {
    const utuh = jpeg(APP0_JFIF, app1Exif(TAG_GPS_IFD));
    for (const panjang of [2, 5, 10, 20, utuh.length - 3]) {
      expect(() => scanJpegMetadata(utuh.subarray(0, panjang))).not.toThrow();
    }
    expect(() => scanJpegMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00]))).not.toThrow();
  });

  it('mengembalikan false untuk berkas yang bukan JPEG', () => {
    expect(scanJpegMetadata(Buffer.from('bukan gambar', 'latin1'))).toEqual({
      exifPresent: false,
      exifGpsPresent: false,
    });
  });

  /**
   * Catatan review: JPEG hasil kanvas Chrome membawa segmen APP2 ICC.
   *
   * C3 harus menolak berdasarkan EXIF secara spesifik, bukan berdasarkan
   * adanya segmen metadata apa pun. Kalau tidak, kontribusi yang sah dari
   * kamera aplikasi ikut tertolak, dan penolakan itu akan terlihat seperti
   * sistem yang galak padahal cuma salah baca.
   *
   * Perilakunya sudah benar sejak awal, tetapi tidak ada yang menguncinya.
   * Keempat kasus di bawah ini yang menguncinya.
   */
  describe('segmen non-EXIF tidak boleh memicu penolakan', () => {
    it('APP2 ICC saja bukan EXIF', () => {
      expect(scanJpegMetadata(jpeg(APP0_JFIF, APP2_ICC))).toEqual({
        exifPresent: false,
        exifGpsPresent: false,
      });
    });

    it('APP13 Photoshop dan APP14 Adobe juga bukan EXIF', () => {
      // Dicatat apa adanya: keduanya jejak perkakas penyunting, tapi kontrak
      // menyebut EXIF. Memperluas gerbang ke sini akan menambah risiko salah
      // tolak tanpa dasar kontrak.
      expect(scanJpegMetadata(jpeg(APP0_JFIF, APP13_PHOTOSHOP, APP14_ADOBE)).exifPresent).toBe(false);
    });

    it('EXIF tetap tertangkap walau berdampingan dengan ICC', () => {
      // Urutan segmen tidak boleh membuat pemindai berhenti lebih awal.
      expect(scanJpegMetadata(jpeg(APP0_JFIF, APP2_ICC, app1Exif(TAG_MAKE))).exifPresent).toBe(true);
      expect(scanJpegMetadata(jpeg(APP0_JFIF, app1Exif(TAG_MAKE), APP2_ICC)).exifPresent).toBe(true);
      expect(scanJpegMetadata(jpeg(APP2_ICC, app1Exif(TAG_GPS_IFD))).exifGpsPresent).toBe(true);
    });

    it('APP1 yang bukan Exif maupun XMP diabaikan', () => {
      const app1Asing = segmen(0xffe1, Buffer.from('SesuatuYangLain\0', 'latin1'));
      expect(scanJpegMetadata(jpeg(APP0_JFIF, app1Asing)).exifPresent).toBe(false);
    });
  });
});
