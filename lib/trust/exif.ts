/**
 * Pemindai metadata JPEG, ditulis sendiri tanpa pustaka.
 *
 * Mekanisme kamera dibekukan ke getUserMedia. canvas.toBlob() menghasilkan
 * JPEG yang di-encode ulang browser, dan proses itu membuang seluruh segmen
 * APP1. Jadi ADANYA EXIF adalah tanda berkas tidak lewat jalur kamera aplikasi.
 *
 * Batasnya, dan ini harus disebut apa adanya: kebalikannya tidak berlaku.
 * TIDAK adanya EXIF bukan bukti berkas berasal dari kamera. Siapa pun bisa
 * me-re-encode foto galeri dan menghapus EXIF-nya. C3 menyaring yang malas,
 * bukan yang niat. Yang menahan yang niat adalah C0, dan itu pun tidak mutlak.
 */
export interface JpegMetadataScan {
  exifPresent: boolean;
  exifGpsPresent: boolean;
}

const SOI = 0xffd8;
const APP1 = 0xffe1;
const SOS = 0xffda;
const EXIF_MAGIC = Buffer.from('Exif\0\0', 'latin1');
const XMP_MAGIC = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1');
const GPS_IFD_TAG = 0x8825;

export function isJpeg(buf: Buffer): boolean {
  return buf.length >= 2 && buf.readUInt16BE(0) === SOI;
}

export function scanJpegMetadata(buf: Buffer): JpegMetadataScan {
  const out: JpegMetadataScan = { exifPresent: false, exifGpsPresent: false };
  if (!isJpeg(buf)) return out;

  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) break;                 // bukan penanda segmen, berhenti
    const marker = buf.readUInt16BE(p);
    if (marker === SOS) break;                  // mulai data gambar
    const len = buf.readUInt16BE(p + 2);
    if (len < 2) break;

    const body = buf.subarray(p + 4, Math.min(p + 2 + len, buf.length));

    if (marker === APP1) {
      if (body.subarray(0, EXIF_MAGIC.length).equals(EXIF_MAGIC)) {
        out.exifPresent = true;
        out.exifGpsPresent ||= hasGpsIfd(body.subarray(EXIF_MAGIC.length));
      } else if (body.subarray(0, XMP_MAGIC.length).equals(XMP_MAGIC)) {
        // XMP juga metadata galeri. Dihitung sebagai EXIF present.
        out.exifPresent = true;
      }
    }

    p += 2 + len;
  }
  return out;
}

/** Baca header TIFF di dalam APP1/Exif, cari pointer GPS IFD (tag 0x8825). */
function hasGpsIfd(tiff: Buffer): boolean {
  if (tiff.length < 8) return false;

  const order = tiff.toString('latin1', 0, 2);
  const le = order === 'II';
  if (!le && order !== 'MM') return false;

  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));

  if (u16(2) !== 0x002a) return false;

  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return false;

  const count = u16(ifd0);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > tiff.length) return false;
    if (u16(entry) === GPS_IFD_TAG) return true;
  }
  return false;
}
