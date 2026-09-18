// Kosakata bersama dari kontrak tim (docs/docs-00-KONTRAK.md §3–§6), dipakai
// server dan klien. Isinya hanya kode dan tipe: kamus atribut lengkap (nilai
// sah, titik pandang, interval tinjau ulang, ai_suggestable) tinggal di tabel
// attribute_type, dan parameter konfigurasi di env atau tabel config.

export const KODE_ATRIBUT = [
  "step_count",
  "ramp_wheelchair",
  "kerb",
  "door_width_band",
  "surface_condition",
  "tactile_paving",
  "elevator_status",
  "toilets_wheelchair",
] as const;
export type KodeAtribut = (typeof KODE_ATRIBUT)[number];

// Sah di level observation untuk atribut mana pun, tetapi tidak membentuk
// attribute_state.
export const TIDAK_TERLIHAT = "not_visible";

export const TITIK_PANDANG = ["entrance", "interior", "toilet"] as const;
export type TitikPandang = (typeof TITIK_PANDANG)[number];

export const PROFIL = ["kursi_roda_manual", "alat_bantu_jalan", "netra"] as const;
export type Profil = (typeof PROFIL)[number];

// Diturunkan saat dibaca; tidak pernah disimpan sebagai kolom.
export const STATUS_ATRIBUT = [
  "belum_terverifikasi",
  "terverifikasi",
  "perlu_ditinjau_ulang",
] as const;
export type StatusAtribut = (typeof STATUS_ATRIBUT)[number];

// Dihitung saat request; tidak pernah disimpan ke database.
export const PENILAIAN = [
  "dapat_diakses",
  "dengan_catatan",
  "tidak_dapat_diakses",
  "belum_dapat_dipastikan",
] as const;
export type Penilaian = (typeof PENILAIAN)[number];

export const KODE_PENOLAKAN = [
  "CAPTURE_SESSION_INVALID",
  "RATE_LIMITED",
  "FILE_METADATA_PRESENT",
  "TIMESTAMP_SKEW",
  "GEO_MISSING",
  "GEO_ACCURACY_LOW",
  "GEO_FIX_STALE",
  "GEO_TOO_FAR",
  "DUPLICATE_IMAGE",
] as const;
export type KodePenolakan = (typeof KODE_PENOLAKAN)[number];

// Untuk kode-kode ini, `measured` dan `threshold` wajib terisi.
export const PENOLAKAN_WAJIB_TERUKUR = [
  "GEO_TOO_FAR",
  "TIMESTAMP_SKEW",
  "DUPLICATE_IMAGE",
  "GEO_ACCURACY_LOW",
] as const satisfies readonly KodePenolakan[];

// Bentuk galat seragam untuk setiap penolakan. Kalimat `message` ditentukan
// server; klien menampilkannya apa adanya.
export type GalatPenolakan = {
  code: KodePenolakan;
  message: string;
  measured: string | number | null;
  threshold: string | number | null;
};
