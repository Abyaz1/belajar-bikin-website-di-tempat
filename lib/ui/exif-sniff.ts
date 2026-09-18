/**
 * Pengendus metadata berkas gambar, sisi klien, KHUSUS untuk /uji-kamera-produk.
 *
 * Ini bukan pemeriksaan keaslian. Pemeriksaan yang sah (C3) berjalan di server
 * atas byte yang benar-benar diterima. Berkas ini hanya menjawab pertanyaan tes
 * jam 0: "file hasil cara ambil foto ini bawa EXIF atau tidak, di HP ini?"
 */

export interface MetadataReport {
  kind: "jpeg" | "png" | "webp" | "heic" | "lain";
  bytes: number;
  /** Segmen yang ditemukan sebelum data gambar, misal "APP0 JFIF", "APP1 Exif". */
  segments: string[];
  exif: boolean;
  exifGps: boolean;
  orientation: number | null;
  make: string | null;
  model: string | null;
  dateTimeOriginal: string | null;
  xmp: boolean;
}

export async function sniffMetadata(blob: Blob): Promise<MetadataReport> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const report: MetadataReport = {
    kind: "lain",
    bytes: buf.length,
    segments: [],
    exif: false,
    exifGps: false,
    orientation: null,
    make: null,
    model: null,
    dateTimeOriginal: null,
    xmp: false,
  };

  if (buf[0] === 0xff && buf[1] === 0xd8) {
    report.kind = "jpeg";
    sniffJpeg(buf, report);
  } else if (ascii(buf, 1, 3) === "PNG") {
    report.kind = "png";
    report.exif = indexOfAscii(buf, "eXIf") >= 0;
    report.segments.push(report.exif ? "chunk eXIf" : "tanpa chunk eXIf");
  } else if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WEBP") {
    report.kind = "webp";
    report.exif = indexOfAscii(buf, "EXIF") >= 0;
    report.xmp = indexOfAscii(buf, "XMP ") >= 0;
  } else if (/^ftyp(heic|heix|mif1|msf1|hevc)/.test(ascii(buf, 4, 8))) {
    report.kind = "heic";
    report.exif = indexOfAscii(buf, "Exif") >= 0;
    report.segments.push("HEIC: metadata tidak diurai rinci");
  }
  return report;
}

function sniffJpeg(buf: Uint8Array, r: MetadataReport) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 2;
  while (off + 4 <= buf.length) {
    if (buf[off] !== 0xff) break;
    const marker = buf[off + 1];
    if (marker === 0xff) {
      off += 1; // byte pengisi
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // awal data gambar
    const len = view.getUint16(off + 2);
    const start = off + 4;
    const end = Math.min(buf.length, off + 2 + len);
    if (marker >= 0xe0 && marker <= 0xef) {
      const n = marker - 0xe0;
      if (n === 1 && ascii(buf, start, 6) === "Exif\0\0") {
        r.segments.push("APP1 Exif");
        r.exif = true;
        try {
          parseTiff(view, start + 6, end, r);
        } catch {
          r.segments.push("(EXIF rusak / tidak terbaca)");
        }
      } else if (n === 1 && ascii(buf, start, 28) === "http://ns.adobe.com/xap/1.0/") {
        r.segments.push("APP1 XMP");
        r.xmp = true;
      } else if (n === 0 && ascii(buf, start, 4) === "JFIF") {
        r.segments.push("APP0 JFIF");
      } else if (n === 2 && ascii(buf, start, 11) === "ICC_PROFILE") {
        r.segments.push("APP2 ICC");
      } else {
        r.segments.push(`APP${n}`);
      }
    }
    off = off + 2 + len;
  }
}

function parseTiff(view: DataView, tiff: number, end: number, r: MetadataReport) {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  const str = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
    if (at + count > end) return null;
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = view.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim() || null;
  };

  const ifd0 = tiff + u32(tiff + 4);
  const n = u16(ifd0);
  let exifIfd: number | null = null;
  for (let i = 0; i < n; i++) {
    const e = ifd0 + 2 + i * 12;
    if (e + 12 > end) break;
    const tag = u16(e);
    if (tag === 0x0112) r.orientation = u16(e + 8);
    else if (tag === 0x010f) r.make = str(e);
    else if (tag === 0x0110) r.model = str(e);
    else if (tag === 0x8825) {
      const gps = tiff + u32(e + 8);
      // Pointer GPS kadang ada tapi isinya kosong. Hitung sebagai GPS hanya
      // kalau IFD-nya punya entri.
      r.exifGps = gps + 2 <= end && u16(gps) > 0;
    } else if (tag === 0x8769) exifIfd = tiff + u32(e + 8);
  }
  if (exifIfd !== null && exifIfd + 2 <= end) {
    const m = u16(exifIfd);
    for (let i = 0; i < m; i++) {
      const e = exifIfd + 2 + i * 12;
      if (e + 12 > end) break;
      if (u16(e) === 0x9003) r.dateTimeOriginal = str(e);
    }
  }
}

function ascii(buf: Uint8Array, start: number, length: number): string {
  let s = "";
  for (let i = start; i < start + length && i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

function indexOfAscii(buf: Uint8Array, needle: string): number {
  const limit = Math.min(buf.length, 256 * 1024);
  outer: for (let i = 0; i + needle.length <= limit; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}
