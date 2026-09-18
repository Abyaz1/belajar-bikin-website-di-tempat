import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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

/** Satu-satunya tempat bentuk kunci objek ditentukan. Jangan dirakit di tempat lain. */
export function objectKey(buf: Buffer, placeId: string): string {
  const digest = createHash('sha256').update(buf).digest('hex').slice(0, 32);
  return `evidence/${placeId}/${digest}.jpg`;
}

// --- GCS -------------------------------------------------------------------
// Bentuk minimal yang benar-benar dipakai, supaya berkas ini tidak bergantung
// pada tipe paket yang belum tentu terpasang.
interface GcsFileLike {
  save(data: Buffer, options: Record<string, unknown>): Promise<unknown>;
}
interface GcsBucketLike {
  file(name: string): GcsFileLike;
}

let bucketPromise: Promise<GcsBucketLike> | null = null;

/**
 * Impor dinamis, bukan impor statis. @google-cloud/storage adalah dependensi
 * opsional: selama STORAGE_DRIVER=local, paketnya tidak perlu terpasang dan
 * `next build` tetap hijau. Harganya satu peringatan module-not-found saat
 * build — sama persis dengan pola di lib/trust/verification-port.ts.
 */
async function ambilBucket(): Promise<GcsBucketLike> {
  if (!bucketPromise) {
    bucketPromise = (async () => {
      let mod: { Storage: new (...args: unknown[]) => { bucket(n: string): GcsBucketLike } };
      try {
        // @ts-ignore - dependensi opsional, hanya dibutuhkan saat STORAGE_DRIVER=gcs
        mod = await import('@google-cloud/storage');
      } catch {
        throw new Error(
          'STORAGE_DRIVER=gcs tetapi paket @google-cloud/storage belum terpasang. ' +
          'Jalankan: npm i @google-cloud/storage',
        );
      }
      // Kredensial diambil dari GOOGLE_APPLICATION_CREDENTIALS saat lokal, atau
      // dari metadata server saat berjalan di Cloud Run. Tidak ada kunci yang
      // ditulis di kode.
      const storage = new mod.Storage();
      return storage.bucket(namaBucket());
    })();
  }
  try {
    return await bucketPromise;
  } catch (err) {
    bucketPromise = null;   // jangan mengunci kegagalan sekali jadi kegagalan selamanya
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
 *
 * Kerahasiaannya ditegakkan IAM bucket, bukan ACL per objek: bucket dengan
 * uniform bucket-level access justru MENOLAK setiap permintaan ACL per objek,
 * jadi menambahkan opsi ACL di sini akan membuat unggahan gagal, bukan lebih
 * aman. Yang menjaga: tidak ada binding allUsers pada bucket.
 */
export async function putOriginal(buf: Buffer, placeId: string): Promise<string> {
  const key = objectKey(buf, placeId);

  if (storageDriver() === 'gcs') {
    const bucket = await ambilBucket();
    await bucket.file(key).save(buf, {
      contentType: 'image/jpeg',
      resumable: false,           // berkas maks 5 MB, sekali tembak lebih cepat
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
