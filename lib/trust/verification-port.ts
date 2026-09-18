/**
 * Seam ke modul Verification engineer. Kepemilikan folder mutlak: berkas
 * di lib/verification/ bukan milikku, jadi yang kutulis hanya bentuk
 * kontraknya plus fallback aman.
 */
export interface Suggestion {
  attribute_code: string;
  value: string;
}

export interface SuggestionPort {
  suggest(input: {
    imageBytes: Buffer;
    vantage: string;
    attributeCodes: string[];
    timeoutMs: number;
  }): Promise<Array<Suggestion & { confidence: number }>>;
}

/** Dipakai sampai lib/verification/ mendarat, dan saat wifi venue memblokir model. */
const noopPort: SuggestionPort = { async suggest() { return []; } };

export async function loadSuggestionPort(): Promise<SuggestionPort> {
  try {
    // @ts-ignore - Modul ini akan ditulis oleh Verification Engineer nanti
    const mod = await import('@/lib/verification/suggest');
    return (mod as { port?: SuggestionPort }).port ?? noopPort;
  } catch {
    // Alur manual tanpa usulan AI. Konfirmasi wajib tetap jalan, karena
    // confirmed_value tidak pernah berasal dari model.
    return noopPort;
  }
}
