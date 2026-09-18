/**
 * Logika murni pemilih atribut (tanpa JSX), supaya bisa dites langsung.
 * Komponen tampilannya ada di choice.tsx.
 */

import { NOT_VISIBLE } from "./api/types";
import { ATTRIBUTE, valueOption } from "./copy";

export interface ChoiceOption {
  value: string;
  label: string;
}

/** Nilai isian untuk satu atribut. `lebih` hanya untuk step_count. */
export interface ChoiceValue {
  pick: string | null;
  more: string;
}

export const EMPTY_CHOICE: ChoiceValue = { pick: null, more: "" };
export const STEP_MORE = "lebih";

export function optionsFor(code: string, allowed?: string[] | null): ChoiceOption[] {
  let values: string[];
  if (code === "step_count") values = ["0", "1", "2", "3", STEP_MORE];
  else values = allowed && allowed.length > 0 ? allowed : (ATTRIBUTE[code]?.values ?? []);
  // E8 menyertakan not_visible di allowed_values, dan itu benar: kontrak §3
  // menyatakan not_visible sah untuk atribut mana pun, dan E5 memvalidasi
  // terhadap daftar yang sama. Tapi opsi itu SELALU ditambahkan di baris bawah
  // sini, jadi tanpa penyaringan ini ia muncul dua kali dengan nilai yang sama
  // persis -- pilihan pengguna tidak terdaftar, dan kolomnya dianggap belum
  // diisi sehingga tombol kirim menolak. Nilai lain yang kebetulan berulang
  // ikut dibuang supaya satu nilai selalu satu pilihan.
  values = [...new Set(values)].filter((v) => v !== NOT_VISIBLE);
  return [
    ...values.map((v) => ({
      value: v,
      label: v === STEP_MORE ? "Lebih dari 3" : valueOption(code, v),
    })),
    { value: NOT_VISIBLE, label: "Tidak terlihat dari sini" },
  ];
}

/** Nilai final yang dikirim ke E5, atau pesan galat untuk kolom ini. */
export function resolveChoice(code: string, v: ChoiceValue): { value: string } | { error: string } | null {
  if (v.pick === null) return null;
  if (code === "step_count" && v.pick === STEP_MORE) {
    const n = Number(v.more);
    if (v.more.trim() === "" || !Number.isInteger(n) || n < 4 || n > 20)
      return { error: "Tulis jumlah anak tangga sebagai angka 4 sampai 20." };
    return { value: String(n) };
  }
  return { value: v.pick };
}
