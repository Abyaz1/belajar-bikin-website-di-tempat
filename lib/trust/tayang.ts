import { GoogleAuth } from 'google-auth-library';
import sharp from 'sharp';
import { trustConfig } from './config';
import { putPublic } from './storage';

/**
 * Foto TAYANG: turunan foto bukti yang boleh dilihat publik.
 *
 * Aslinya (evidence.storage_path) tidak pernah keluar. Turunannya:
 *   1. dikecilkan ke sisi terpanjang DISPLAY_MAX_EDGE_PX,
 *   2. wajah yang terdeteksi dipikselkan lalu dikaburkan,
 *   3. disimpan ulang sebagai JPEG baru tanpa metadata.
 *
 * Deteksi wajah memakai Cloud Vision API (FACE_DETECTION).
 *
 * Yang TIDAK dijamin: semua wajah tertangkap. Wajah kecil di kejauhan, wajah
 * dari samping, dan wajah yang tertutup bisa lolos dari detektor. Yang
 * dilakukan sistem adalah mengurangi kemungkinan wajah orang yang lewat tampil
 * dikenali, bukan menghilangkannya. Pelat nomor dan tubuh tidak dideteksi.
 *
 * GAGAL TERTUTUP. Kalau deteksi gagal (API mati, timeout, jawaban rusak), fungsi
 * ini melempar galat dan pemanggil tidak menulis public_path — foto itu tidak
 * tayang sama sekali. Menayangkan foto yang belum diperiksa wajahnya bukan
 * pilihan cadangan.
 */

export interface Kotak {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Mengembalikan kotak wajah dalam koordinat piksel citra yang diberikan. */
export type DeteksiWajah = (jpeg: Buffer) => Promise<Kotak[]>;

// Parameter bentuk, bukan ambang keputusan: kotak Vision dilebarkan supaya
// rambut dan dagu ikut tertutup, lalu isi kotak diperkecil jadi blok kasar.
const MARGIN_KOTAK = 0.25;
const BLOK_PIKSEL = 10;

function perlebar(k: Kotak, lebar: number, tinggi: number): Kotak | null {
  const dx = k.width * MARGIN_KOTAK;
  const dy = k.height * MARGIN_KOTAK;
  const left = Math.max(0, Math.floor(k.left - dx));
  const top = Math.max(0, Math.floor(k.top - dy));
  const right = Math.min(lebar, Math.ceil(k.left + k.width + dx));
  const bottom = Math.min(tinggi, Math.ceil(k.top + k.height + dy));
  if (right - left < 2 || bottom - top < 2) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/** Isi kotak diperkecil ke beberapa blok lalu dibesarkan ulang: detailnya hilang, bukan sekadar buram. */
async function tambalan(citra: Buffer, k: Kotak): Promise<Buffer> {
  const kolom = Math.min(BLOK_PIKSEL, k.width);
  const baris = Math.max(1, Math.round((kolom * k.height) / k.width));
  const kecil = await sharp(citra).extract(k).resize(kolom, baris, { fit: 'fill' }).toBuffer();
  return sharp(kecil)
    .resize(k.width, k.height, { fit: 'fill', kernel: 'nearest' })
    .blur(Math.max(1, Math.min(k.width, k.height) / BLOK_PIKSEL / 2))
    .toBuffer();
}

export async function buatFotoTayang(
  asli: Buffer,
  deteksi: DeteksiWajah,
): Promise<{ jpeg: Buffer; wajah: number }> {
  const sisi = trustConfig.displayMaxEdgePx;
  // rotate() tanpa argumen menerapkan orientasi EXIF sebelum metadata dibuang.
  const dasar = await sharp(asli)
    .rotate()
    .resize(sisi, sisi, { fit: 'inside', withoutEnlargement: true })
    .jpeg()
    .toBuffer();
  const { width = 0, height = 0 } = await sharp(dasar).metadata();

  const kotak = (await deteksi(dasar))
    .map((k) => perlebar(k, width, height))
    .filter((k): k is Kotak => k !== null);

  const lapisan = await Promise.all(
    kotak.map(async (k) => ({ input: await tambalan(dasar, k), left: k.left, top: k.top })),
  );
  // sharp tidak menyalin metadata kecuali diminta withMetadata(): hasilnya bersih.
  const jpeg = await sharp(dasar).composite(lapisan).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return { jpeg, wajah: kotak.length };
}

// --- Cloud Vision ------------------------------------------------------------

let auth: GoogleAuth | null = null;

interface VisionVertex {
  x?: number;
  y?: number;
}
interface VisionJawaban {
  responses?: Array<{
    faceAnnotations?: Array<{ boundingPoly?: { vertices?: VisionVertex[] } }>;
    error?: { code?: number; message?: string };
  }>;
}

/** Kotak dari boundingPoly Vision. Koordinat yang tidak ada berarti 0 (perilaku API). */
export function kotakDariVision(jawaban: VisionJawaban): Kotak[] {
  const r = jawaban.responses?.[0];
  if (!r) throw new Error('Cloud Vision tidak mengembalikan jawaban.');
  if (r.error) throw new Error(`Cloud Vision menolak: ${r.error.message ?? r.error.code}`);
  return (r.faceAnnotations ?? []).flatMap((f) => {
    const v = f.boundingPoly?.vertices ?? [];
    if (v.length === 0) return [];
    const xs = v.map((p) => p.x ?? 0);
    const ys = v.map((p) => p.y ?? 0);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return [{ left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }];
  });
}

export const deteksiWajahVision: DeteksiWajah = async (jpeg) => {
  auth ??= new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const { token } = await (await auth.getClient()).getAccessToken();
  if (!token) throw new Error('Tidak ada kredensial Google untuk Cloud Vision.');
  const project = process.env.GCP_PROJECT_ID?.trim();

  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Kredensial pengguna (lokal) wajib menyebut proyek penagihan; di Cloud Run tidak berpengaruh.
      ...(project ? { 'x-goog-user-project': project } : {}),
    },
    body: JSON.stringify({
      requests: [{ image: { content: jpeg.toString('base64') }, features: [{ type: 'FACE_DETECTION', maxResults: 100 }] }],
    }),
    signal: AbortSignal.timeout(trustConfig.faceDetectTimeoutMs),
  });
  if (!res.ok) throw new Error(`Cloud Vision HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return kotakDariVision((await res.json()) as VisionJawaban);
};

/**
 * Buat dan simpan foto tayang satu bukti. Mengembalikan kunci untuk
 * evidence.public_path, atau null kalau gagal di langkah mana pun.
 *
 * Tidak pernah melempar: kegagalan di sini tidak boleh menggagalkan kontribusi.
 * Akibatnya cuma satu, dan itu yang disengaja: fotonya tidak tayang.
 */
export async function simpanFotoTayang(
  asli: Buffer,
  placeId: string,
  deteksi: DeteksiWajah = deteksiWajahVision,
): Promise<string | null> {
  try {
    const { jpeg } = await buatFotoTayang(asli, deteksi);
    return await putPublic(jpeg, placeId);
  } catch (e) {
    console.error('Foto tayang tidak dibuat; bukti tetap tersimpan tanpa foto publik.', e instanceof Error ? e.message : e);
    return null;
  }
}
