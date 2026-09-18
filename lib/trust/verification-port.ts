import type { Vantage } from './types';

/**
 * Seam ke modul Verification engineer.
 *
 * Bentuknya mengikuti kontrak MEREKA, bukan sebaliknya. Versi pertama berkas ini
 * mengarang bentuknya sendiri — mencari `lib/verification/suggest.ts` dengan
 * `export const port` — dan ketika modul aslinya mendarat sebagai
 * `lib/verification/index.ts` dengan `suggestWithVertex`, impor dinamisnya gagal
 * lalu tertangkap catch dan jatuh diam-diam ke jalur tanpa usulan. Tidak ada
 * galat, tidak ada log, usulan sekadar tidak pernah muncul di layar konfirmasi.
 * Kegagalan senyap itu justru alasan seam ini sekarang meniru bentuk mereka
 * persis, termasuk `status` dan `latency_ms` yang dulu kubuang.
 *
 * Kepemilikan folder tetap: lib/verification/ bukan milikku. Yang di sini hanya
 * bentuk kontraknya plus jalur mundur yang aman.
 */

export type ModelStatus = 'ok' | 'off' | 'failed' | 'timeout';

/** Satu atribut yang boleh diklaim, persis sebagaimana tersimpan di attribute_type. */
export interface AttributeFlag {
  attribute_code: string;
  ai_suggestable: boolean;
  allowed_values: string[];
}

export interface Suggestion {
  attribute_code: string;
  value: string | null;
  /** Disimpan ke observation.ai_confidence. TIDAK PERNAH dikirim ke klien. */
  confidence: number | null;
  active: boolean;
}

export interface SuggestResult {
  status: ModelStatus;
  model: string;
  prompt_version: string;
  latency_ms: number;
  suggestions: Suggestion[];
  reason: string | null;
}

export interface SuggestInput {
  image: Uint8Array;
  mimeType: string;
  vantage: Vantage;
  attributes: AttributeFlag[];
}

type ModulVerifikasi = {
  suggestWithVertex?: (input: SuggestInput) => Promise<SuggestResult>;
};

function tanpaModel(reason: string): SuggestResult {
  return {
    status: 'off',
    model: '',
    prompt_version: '',
    latency_ms: 0,
    suggestions: [],
    reason,
  };
}

/**
 * Meminta usulan ke modul verifikasi. TIDAK PERNAH melempar.
 *
 * Alur kontribusi tidak boleh bergantung pada model: kalau modulnya belum ada,
 * kuncinya belum diisi, wifi venue memblokir penyedia model, atau panggilannya
 * lewat batas waktu, kontributor tetap bisa mengisi seluruh atribut secara
 * manual. Konfirmasi wajib tetap berlaku apa pun yang terjadi di sini, karena
 * confirmed_value tidak pernah berasal dari model.
 *
 * Bedanya dengan versi lama: sebabnya sekarang ikut terbawa lewat `status` dan
 * `reason`, alih-alih ditelan `.catch(() => [])`. Itu yang membuat antarmuka
 * bisa membedakan "model bilang tidak ada yang terlihat" dari "model tidak
 * pernah menjawab" — dan keduanya memang beda hal.
 */
export async function mintaUsulan(input: SuggestInput): Promise<SuggestResult> {
  let modul: ModulVerifikasi;
  try {
    // @ts-ignore - modul milik Verification engineer, belum tentu ada di cabang ini
    modul = (await import('@/lib/verification')) as ModulVerifikasi;
  } catch {
    return tanpaModel('Modul lib/verification belum ada di build ini.');
  }

  if (typeof modul.suggestWithVertex !== 'function') {
    return tanpaModel('lib/verification tidak mengekspor suggestWithVertex.');
  }

  try {
    return await modul.suggestWithVertex(input);
  } catch (galat) {
    // Modulnya berjanji tidak melempar, tapi janji bukan jaminan.
    return {
      ...tanpaModel(galat instanceof Error ? galat.message : String(galat)),
      status: 'failed',
    };
  }
}
