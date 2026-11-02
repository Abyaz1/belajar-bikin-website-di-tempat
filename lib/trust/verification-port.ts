import type {
  AttributeFlag,
  ModelStatus,
  SuggestInput,
  SuggestResult,
  Suggestion,
} from '@/lib/verification/core';

export type { AttributeFlag, ModelStatus, SuggestInput, SuggestResult, Suggestion };

/**
 * Seam ke modul verifikasi (`lib/verification`).
 *
 * Tipe kontrak diimpor langsung dari `@/lib/verification/core` agar tidak ada
 * duplikasi definisi antarmuka, sementara pemanggilan runtime tetap menjaga
 * jalur mundur yang aman (tidak pernah melempar).
 */

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
 */
export async function mintaUsulan(input: SuggestInput): Promise<SuggestResult> {
  let modul: ModulVerifikasi;
  try {
    modul = (await import('@/lib/verification')) as unknown as ModulVerifikasi;
  } catch {
    return tanpaModel('Modul lib/verification belum ada di build ini.');
  }

  if (typeof modul.suggestWithVertex !== 'function') {
    return tanpaModel('lib/verification tidak mengekspor suggestWithVertex.');
  }

  try {
    return await modul.suggestWithVertex(input);
  } catch (galat) {
    return {
      ...tanpaModel(galat instanceof Error ? galat.message : String(galat)),
      status: 'failed',
    };
  }
}
