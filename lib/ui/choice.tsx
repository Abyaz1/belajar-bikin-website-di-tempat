"use client";

/**
 * Pemilih atribut untuk layar konfirmasi (L10).
 *
 *  - Kartu penuh lebar bertumpuk, bukan segmen kecil. Tinggi 48px.
 *  - Terpilih = garis tebal + centang + teks "dipilih", bukan cuma isian warna.
 *  - Selalu ada opsi "Tidak terlihat dari sini".
 *  - NILAI USULAN TIDAK PERNAH TERPILIH OTOMATIS. Kalau terpilih otomatis,
 *    "konfirmasi wajib" berubah jadi stempel karet bagi kontributor yang
 *    terburu-buru — halusinasi model tersimpan atas nama manusia. Aturan yang
 *    sama ditegakkan di API (E5), bukan hanya di sini.
 */

import { useId } from "react";
import type { Suggestion } from "./api/types";
import type { ChoiceOption, ChoiceValue } from "./choice-logic";
import { STEP_MORE } from "./choice-logic";
import { valueOption } from "./copy";
import { IconCheck } from "./icons";

export { EMPTY_CHOICE, STEP_MORE, optionsFor, resolveChoice } from "./choice-logic";
export type { ChoiceOption, ChoiceValue } from "./choice-logic";

export function AttributeChoice({
  code,
  question,
  required,
  options,
  value,
  onChange,
  suggestion,
  modelNote,
  error,
}: {
  code: string;
  question: string;
  required: boolean;
  options: ChoiceOption[];
  value: ChoiceValue;
  onChange: (v: ChoiceValue) => void;
  suggestion: Suggestion | null;
  /** Teks netral bila tidak ada usulan untuk atribut ini. */
  modelNote: string | null;
  error: string | null;
}) {
  const id = useId();
  const errorId = `${id}-galat`;
  const suggestedValue = suggestion?.active ? suggestion.value : null;

  return (
    <fieldset
      id={`atribut-${code}`}
      tabIndex={-1}
      aria-describedby={error ? errorId : undefined}
      className="space-y-3 rounded-md border border-line p-4"
    >
      <legend className="px-1 text-card">
        {question}{" "}
        <span className="text-meta font-normal text-ink-muted">{required ? "(wajib)" : "(boleh dilewati)"}</span>
      </legend>

      {suggestedValue !== null && suggestedValue !== undefined ? (
        <SuggestionMarker code={code} value={suggestedValue} />
      ) : modelNote ? (
        <p className="text-meta text-ink-muted">{modelNote}</p>
      ) : null}

      {error ? (
        <p id={errorId} className="rounded-sm border-2 border-tidak-line bg-tidak-fill px-3 py-2 font-semibold text-tidak-ink">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2">
        {options.map((opt) => (
          <label key={opt.value} className="choice">
            <input
              type="radio"
              name={`${id}-${code}`}
              value={opt.value}
              checked={value.pick === opt.value}
              onChange={() => onChange({ ...value, pick: opt.value })}
              className="sr-only"
            />
            <span aria-hidden="true" className="choice-box grid size-6 shrink-0 place-items-center rounded-pill border-2 border-line-control">
              <span className="choice-mark text-action">
                <IconCheck />
              </span>
            </span>
            <span className="flex-1">{opt.label}</span>
            {suggestedValue === opt.value ? (
              <span className="text-label text-ink-muted">usulan sistem</span>
            ) : null}
            <span aria-hidden="true" className="choice-mark text-label text-action">
              dipilih
            </span>
          </label>
        ))}
      </div>

      {code === "step_count" && value.pick === STEP_MORE ? (
        <div className="space-y-1">
          <label htmlFor={`${id}-lebih`} className="block font-semibold">
            Jumlah anak tangga (4 sampai 20)
          </label>
          <input
            id={`${id}-lebih`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value.more}
            onChange={(e) => onChange({ ...value, more: e.target.value })}
            className="block min-h-12 w-32 rounded-md border-2 border-line-control px-3 text-body"
          />
        </div>
      ) : null}
    </fieldset>
  );
}

/** "Usulan sistem: [nilai]" + ajakan memeriksa. Netral, tanpa warna semantik. */
export function SuggestionMarker({ code, value }: { code: string; value: string }) {
  return (
    <div className="rounded-sm border border-line-control bg-surface-alt px-3 py-2">
      <p>
        <span className="font-semibold">Usulan sistem:</span> {valueOption(code, value)}
      </p>
      <p className="text-meta text-ink-muted">Periksa dan konfirmasi sebelum dikirim. Usulan ini belum dipilih.</p>
    </div>
  );
}
