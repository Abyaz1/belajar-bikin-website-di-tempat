import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Bucket } from '@google-cloud/storage';
import { isUuid } from './types';

/**
 * Adapter penyimpanan objek bukti: lokal untuk pengembangan, GCS untuk deploy.
 *
 * SATU JAMINAN YANG TIDAK BOLEH PECAH: kedua driver mengembalikan kunci objek
 * dengan bentuk yang sama persis, `evidence/<place_id>/<sha256 32 hex>.jpg`.
 * Nilai itu masuk ke kolom evidence.storage_path, dan kolom itu sudah terisi
 * baris-baris lama. Kalau bentuknya berubah saat driver diganti, jejak bukti
 * pecah jadi dua dialek dan keterlacakan yang kita klaim 100 persen jadi bohong.
 * Karena itu kuncinya dihitung SATU fungsi, objectKey(), di luar percabangan
 * driver — bukan dirakit ulang di tiap cabang.
 */

export type StorageDriver = 'local' | 'gcs';

export function storageDriver(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'local') return 'local';
  if (raw === 'gcs') return 'gcs';
  throw new Error(
    `STORAGE_DRIVER tidak dikenal: ${JSON.stringify(process.env.STORAGE_DRIVER)}. ` +
    'Pilihan: local, gcs.',
  );
}

/**
 * GCS_BUCKET adalah satu-satunya nama yang dibaca, tanpa alias. Nama yang sama
 * dipakai .env.example dan perintah `gcloud run deploy --set-env-vars` di
 * README.md, supaya tidak ada dua sumber kebenaran untuk satu bucket.
 */
function namaBucket(): string {
  const nama = (process.env.GCS_BUCKET ?? '').trim();
  if (!nama) {
    throw new Error('STORAGE_DRIVER=gcs tetapi GCS_BUCKET kosong.');
  }
  return nama;
}

function pastikanPlaceIdSah(placeId: string): void {
  if (!isUuid(placeId)) {
    throw new Error('placeId tidak valid: ' + placeId);
  }
}

/** Satu-satunya tempat bentuk kunci objek ditentukan. Jangan dirakit di tempat lain. */
export function objectKey(buf: Buffer, placeId: string): string {
  pastikanPlaceIdSah(placeId);
  const digest = createHash('sha256').update(buf).digest('hex').slice(0, 32);
  return `evidence/${placeId}/${digest}.jpg`;
}

/**
 * Kunci objek TAYANG (hasil pengaburan wajah) untuk evidence.public_path.
 * Awalan berbeda dari objek asli, jadi penyaji foto cukup menolak apa pun yang
 * tidak berawalan `tayang/`, dan objek asli tidak pernah tersaji lewat sana.
 */
export function publicKey(buf: Buffer, placeId: string): string {
  pastikanPlaceIdSah(placeId);
  const digest = createHash('sha256').update(buf).digest('hex').slice(0, 32);
  return `tayang/${placeId}/${digest}.jpg`;
}

// --- GCS -------------------------------------------------------------------

let bucketPromise: Promise<Bucket> | null = null;

/**
 * Impor dinamis saat STORAGE_DRIVER=gcs supaya jalur lokal tidak memuat SDK GCS.
 */
async function ambilBucket(): Promise<Bucket> {
  if (!bucketPromise) {
    bucketPromise = (async () => {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage();
      return storage.bucket(namaBucket());
    })();
  }
  try {
    return await bucketPromise;
  } catch (err) {
    bucketPromise = null; // jangan mengunci kegagalan sekali jadi kegagalan selamanya
    throw err;
  }
}

/**
 * Simpan objek ASLI. Mengembalikan kunci objek untuk evidence.storage_path.
 *
 * OBJEK INI TIDAK PERNAH DIJADIKAN PUBLIK. Tidak ada `public: true`, tidak ada
 * `predefinedAcl: 'publicRead'`, tidak ada `makePublic()` di berkas ini, dan
 * tidak boleh ditambahkan. Yang tayang ke pengguna adalah turunannya setelah
 * pengaburan wajah, lewat kolom evidence.public_path yang terpisah.
 */
export async function putOriginal(buf: Buffer, placeId: string): Promise<string> {
  const key = objectKey(buf, placeId);

  if (storageDriver() === 'gcs') {
    const bucket = await ambilBucket();
    await bucket.file(key).save(buf, {
      contentType: 'image/jpeg',
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0, no-store' },
    });
    return key;
  }

  const root = process.env.STORAGE_LOCAL_ROOT ?? '.storage';
  const path = join(root, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  return key;
}

/**
 * Simpan foto TAYANG. Bucket-nya sama dan tetap privat: foto tayang sampai ke
 * pengguna lewat rute baca aplikasi, bukan lewat URL publik bucket.
 */
export async function putPublic(buf: Buffer, placeId: string): Promise<string> {
  const key = publicKey(buf, placeId);
  if (storageDriver() === 'gcs') {
    const bucket = await ambilBucket();
    await bucket.file(key).save(buf, { contentType: 'image/jpeg', resumable: false });
    return key;
  }
  const path = join(process.env.STORAGE_LOCAL_ROOT ?? '.storage', key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  return key;
}

/** Baca objek TAYANG. Kunci di luar awalan `tayang/` ditolak: objek asli tidak pernah dibaca lewat sini. */
export async function readPublic(key: string): Promise<Buffer> {
  if (!/^tayang\/[0-9a-f-]{36}\/[0-9a-f]{32}\.jpg$/.test(key)) {
    throw new Error('Kunci objek tayang tidak sah.');
  }
  if (storageDriver() === 'gcs') {
    const [isi] = await (await ambilBucket()).file(key).download();
    return isi;
  }
  // Driver lokal hanya untuk pengembangan; jangan biarkan pelacak build menyalin seluruh proyek.
  return readFile(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ process.env.STORAGE_LOCAL_ROOT ?? '.storage', key));
}
