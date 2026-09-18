import { NextResponse } from 'next/server';
import type { ReasonCode } from './types';

/** Bentuk galat seragam — docs/00-KONTRAK.md §6. Tidak ada bentuk lain. */
export interface ApiErrorBody {
  code: string;
  message: string;
  measured: string | null;
  threshold: string | null;
}

/** Kalimat untuk manusia ditentukan server, bukan klien. */
export const REASON_MESSAGE: Record<ReasonCode, string> = {
  CAPTURE_SESSION_INVALID: 'Sesi pengambilan foto sudah kedaluwarsa. Buka ulang layar kamera',
  RATE_LIMITED: 'Terlalu banyak kontribusi dalam waktu singkat',
  FILE_METADATA_PRESENT: 'Berkas ini tampak berasal dari galeri, bukan dari kamera aplikasi',
  TIMESTAMP_SKEW: 'Waktu pengambilan tidak wajar',
  GEO_MISSING: 'Izin lokasi diperlukan untuk memverifikasi kontribusi',
  GEO_ACCURACY_LOW: 'Ketelitian lokasi terlalu rendah untuk diverifikasi',
  GEO_FIX_STALE: 'Posisi terakhir terlalu lama. Tunggu sebentar lalu ulangi',
  GEO_TOO_FAR: 'Lokasi pengambilan terlalu jauh dari tempat yang dipilih',
  DUPLICATE_IMAGE: 'Foto ini sudah pernah dikirim sebelumnya',
};

/**
 * Keempat kode ini WAJIB membawa measured dan threshold (docs/00-KONTRAK.md §6).
 * Dicek runtime, bukan diserahkan ke kedisiplinan penulis kode — aturan 6
 * adalah salah satu dari enam yang tidak boleh dilanggar.
 */
const MEASURED_REQUIRED: ReadonlySet<string> = new Set<ReasonCode>([
  'GEO_TOO_FAR',
  'TIMESTAMP_SKEW',
  'DUPLICATE_IMAGE',
  'GEO_ACCURACY_LOW',
]);

export function assertErrorShape(e: ApiErrorBody): ApiErrorBody {
  if (MEASURED_REQUIRED.has(e.code) && (e.measured === null || e.threshold === null)) {
    throw new Error(
      `Pelanggaran aturan 6: ${e.code} dikirim tanpa measured/threshold. ` +
      'Setiap penolakan menampilkan alasan DAN nilai terukurnya.',
    );
  }
  return e;
}

/** Galat bentuk-permintaan (bukan penolakan provenans). Selalu 400. */
export class BadRequest extends Error {
  constructor(readonly body: ApiErrorBody) {
    super(body.message);
  }
}

export function badRequest(code: string, message: string) {
  return new BadRequest({ code, message, measured: null, threshold: null });
}

export function jsonError(status: number, errors: ApiErrorBody[]) {
  return NextResponse.json({ errors: errors.map(assertErrorShape) }, { status });
}
