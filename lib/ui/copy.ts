/**
 * Kosakata antarmuka — docs/30-product.md §7.
 *
 *  1. Hambatan disebut pada BANGUNAN, bukan pada orang.
 *  2. Kata "aksesibel"/"dapat diakses" tidak pernah tampil tanpa nama profil.
 *  3. Setiap penolakan menyebut angka dan ambangnya.
 *  4. Setiap status menyebut tanggal.
 *  5. Terverifikasi-tidak-ada dan belum-diketahui dibedakan dengan STRUKTUR
 *     kalimat, bukan satu kata. Kalau tertukar, produk gagal di intinya.
 *  6. Kosakata mesin diterjemahkan; kode aslinya tetap tampil kecil.
 *  7. Tanpa permintaan maaf, tanpa nada riang.
 *
 * Kamus atribut yang berlaku ada di tabel `attribute_type`. Yang di sini hanya
 * cara MENGUCAPKANNYA. Atribut yang tidak dikenal tetap tampil lewat jalur umum.
 */

import type { AttributeStatus, ProfileCode, ReasonCode, Vantage, Verdict } from "./api/types";
import { NOT_VISIBLE } from "./api/types";

// ── Profil ──────────────────────────────────────────────────────────────────

export const PROFILE_LABEL: Record<ProfileCode, string> = {
  kursi_roda_manual: "kursi roda manual",
  alat_bantu_jalan: "alat bantu jalan",
  netra: "netra",
};

export const PROFILE_TITLE: Record<ProfileCode, string> = {
  kursi_roda_manual: "Kursi roda manual",
  alat_bantu_jalan: "Alat bantu jalan",
  netra: "Netra",
};

export const PROFILE_HINT: Record<ProfileCode, string> = {
  kursi_roda_manual: "Anak tangga, ramp, lebar pintu, tepi trotoar, permukaan, dan lift bila perlu.",
  alat_bantu_jalan: "Untuk kruk, walker, atau tongkat: anak tangga, ramp, tepi trotoar, permukaan, dan lift bila perlu.",
  netra: "Jalur pemandu, tepi trotoar, dan permukaan menuju pintu masuk.",
};

// ── Penilaian ───────────────────────────────────────────────────────────────

export const VERDICT_LABEL: Record<Verdict, string> = {
  tidak_dapat_diakses: "Tidak dapat diakses",
  dengan_catatan: "Dapat diakses dengan catatan",
  dapat_diakses: "Dapat diakses",
  belum_dapat_dipastikan: "Belum dapat dipastikan",
};

/** "Tidak dapat diakses untuk kursi roda manual". Tanpa nama profil, badge
 *  penilaian terbaca sebagai penilaian mutlak. */
export function verdictWithProfile(v: Verdict, p: ProfileCode): string {
  return `${VERDICT_LABEL[v]} untuk ${PROFILE_LABEL[p]}`;
}

// ── Status bukti ────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<AttributeStatus, string> = {
  terverifikasi: "Terverifikasi",
  belum_terverifikasi: "Belum terverifikasi",
  perlu_ditinjau_ulang: "Perlu ditinjau ulang",
};

// ── Titik pandang ───────────────────────────────────────────────────────────

export const VANTAGE_LABEL: Record<Vantage, string> = {
  entrance: "Pintu masuk",
  interior: "Di dalam gedung",
  toilet: "Toilet",
};

export const VANTAGE_HINT: Record<Vantage, string> = {
  entrance:
    "Berdiri di depan pintu masuk utama, sekitar tiga sampai lima langkah, sampai pintu, anak tangga, dan trotoar di depannya terlihat.",
  interior: "Foto lift dari depan pintunya, termasuk panel tombol atau tanda bila ada.",
  toilet: "Foto toilet dari pintunya, sampai ruang di dalam dan pegangan terlihat.",
};

// ── Atribut ─────────────────────────────────────────────────────────────────

interface AttributeCopy {
  vantage: Vantage;
  /** Nama pendek, dipakai kalau server tidak mengirim label. */
  label: string;
  /** Pertanyaan di layar konfirmasi. */
  question: string;
  values: string[];
  /** Label pilihan jawaban. */
  option: Record<string, string>;
  /** Kalimat utuh untuk nilai yang SUDAH DIPERIKSA. */
  known: (value: string) => string;
  /** Kalimat untuk nilai yang BELUM DIKETAHUI — strukturnya sengaja berbeda. */
  unknown: string;
}

const ANGKA = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh"];
export function angka(n: number): string {
  return ANGKA[n] ?? String(n);
}

export const ATTRIBUTE: Record<string, AttributeCopy> = {
  step_count: {
    vantage: "entrance",
    label: "Anak tangga di pintu masuk",
    question: "Berapa anak tangga di pintu masuk?",
    values: ["0", "1", "2", "3"],
    option: { "0": "Tidak ada anak tangga", "1": "1 anak tangga", "2": "2 anak tangga", "3": "3 anak tangga" },
    known: (v) =>
      v === "0"
        ? "Pintu masuk ini tidak punya anak tangga."
        : `Pintu masuk ini punya ${angka(Number(v))} anak tangga.`,
    unknown: "Jumlah anak tangga di pintu masuk ini belum diketahui.",
  },
  ramp_wheelchair: {
    vantage: "entrance",
    label: "Ramp di pintu masuk",
    question: "Ada ramp untuk kursi roda di pintu masuk?",
    values: ["yes", "no"],
    option: { yes: "Ada ramp", no: "Tidak ada ramp" },
    known: (v) => (v === "yes" ? "Pintu masuk ini punya ramp." : "Pintu masuk ini tidak punya ramp."),
    unknown: "Belum diketahui apakah pintu masuk ini punya ramp.",
  },
  kerb: {
    vantage: "entrance",
    label: "Tepi trotoar di depan pintu masuk",
    question: "Bagaimana tepi trotoar di depan pintu masuk?",
    values: ["flush", "lowered", "raised"],
    option: { flush: "Rata dengan jalan", lowered: "Dilandaikan", raised: "Tinggi, tidak dilandaikan" },
    known: (v) =>
      ({
        flush: "Tepi trotoar di depan pintu masuk rata dengan jalan.",
        lowered: "Tepi trotoar di depan pintu masuk dilandaikan.",
        raised: "Tepi trotoar di depan pintu masuk tinggi dan tidak dilandaikan.",
      })[v] ?? `Tepi trotoar: ${v}.`,
    unknown: "Bentuk tepi trotoar di depan pintu masuk ini belum diketahui.",
  },
  door_width_band: {
    vantage: "entrance",
    label: "Lebar pintu masuk",
    question: "Kira-kira selebar apa bukaan pintu masuk?",
    values: ["lt80", "80_90", "gt90"],
    option: { lt80: "Kurang dari 80 cm", "80_90": "80 sampai 90 cm", gt90: "Lebih dari 90 cm" },
    known: (v) =>
      ({
        lt80: "Bukaan pintu masuk ini kurang dari 80 cm.",
        "80_90": "Bukaan pintu masuk ini antara 80 dan 90 cm.",
        gt90: "Bukaan pintu masuk ini lebih dari 90 cm.",
      })[v] ?? `Lebar pintu: ${v}.`,
    unknown: "Lebar bukaan pintu masuk ini belum diketahui.",
  },
  surface_condition: {
    vantage: "entrance",
    label: "Permukaan menuju pintu masuk",
    question: "Bagaimana permukaan jalan menuju pintu masuk?",
    values: ["good", "uneven", "damaged"],
    option: { good: "Baik dan rata", uneven: "Tidak rata", damaged: "Rusak" },
    known: (v) =>
      ({
        good: "Permukaan menuju pintu masuk ini baik dan rata.",
        uneven: "Permukaan menuju pintu masuk ini tidak rata.",
        damaged: "Permukaan menuju pintu masuk ini rusak.",
      })[v] ?? `Permukaan: ${v}.`,
    unknown: "Kondisi permukaan menuju pintu masuk ini belum diketahui.",
  },
  tactile_paving: {
    vantage: "entrance",
    label: "Jalur pemandu",
    question: "Ada jalur pemandu (ubin bertekstur kuning) di trotoar atau depan pintu?",
    values: ["yes", "no"],
    option: { yes: "Ada jalur pemandu", no: "Tidak ada jalur pemandu" },
    known: (v) =>
      v === "yes"
        ? "Ada jalur pemandu di trotoar atau depan pintu masuk ini."
        : "Tidak ada jalur pemandu di trotoar maupun depan pintu masuk ini.",
    unknown: "Belum diketahui apakah ada jalur pemandu menuju pintu masuk ini.",
  },
  elevator_status: {
    vantage: "interior",
    label: "Lift",
    question: "Bagaimana keadaan lift di gedung ini?",
    values: ["none", "working", "not_working"],
    option: { none: "Gedung ini tidak punya lift", working: "Ada lift, berfungsi", not_working: "Ada lift, tidak berfungsi" },
    known: (v) =>
      ({
        none: "Gedung ini tidak punya lift.",
        working: "Lift gedung ini berfungsi.",
        not_working: "Lift gedung ini tidak berfungsi.",
      })[v] ?? `Lift: ${v}.`,
    unknown: "Belum diketahui apakah gedung ini punya lift yang berfungsi.",
  },
  toilets_wheelchair: {
    vantage: "toilet",
    label: "Toilet kursi roda",
    question: "Ada toilet yang bisa dimasuki kursi roda?",
    values: ["yes", "no"],
    option: { yes: "Ada", no: "Tidak ada" },
    known: (v) =>
      v === "yes" ? "Gedung ini punya toilet untuk kursi roda." : "Gedung ini tidak punya toilet untuk kursi roda.",
    unknown: "Belum diketahui apakah gedung ini punya toilet untuk kursi roda.",
  },
};

export const ATTRIBUTE_ORDER = Object.keys(ATTRIBUTE);

export function attributeLabel(code: string, serverLabel?: string | null): string {
  return serverLabel || ATTRIBUTE[code]?.label || code;
}

export function attributeVantage(code: string): Vantage {
  return ATTRIBUTE[code]?.vantage ?? "entrance";
}

/** Kalimat untuk nilai berlaku. `null` → kalimat belum-diketahui. */
export function valueSentence(code: string, value: string | null): string {
  const a = ATTRIBUTE[code];
  if (value === null || value === "") return a?.unknown ?? `${attributeLabel(code)} belum diketahui.`;
  if (value === NOT_VISIBLE) return "Dinyatakan tidak terlihat dari foto ini.";
  if (!a) return `${attributeLabel(code)}: ${value}.`;
  // step_count di atas 3 tetap angka, bukan pilihan cepat.
  return a.known(value);
}

/** Label pendek sebuah nilai, untuk pilihan jawaban dan ringkasan. */
export function valueOption(code: string, value: string | null): string {
  if (value === null) return "belum diketahui";
  if (value === NOT_VISIBLE) return "Tidak terlihat dari sini";
  if (code === "step_count" && Number(value) > 3) return `${value} anak tangga`;
  return ATTRIBUTE[code]?.option[value] ?? value;
}

// ── Pemeriksaan keaslian ────────────────────────────────────────────────────

export const REASON_MESSAGE: Record<ReasonCode, string> = {
  CAPTURE_SESSION_INVALID: "Sesi pengambilan foto sudah kedaluwarsa. Buka ulang layar kamera",
  RATE_LIMITED: "Terlalu banyak kontribusi dalam waktu singkat",
  FILE_METADATA_PRESENT: "Berkas ini tampak berasal dari galeri, bukan dari kamera aplikasi",
  TIMESTAMP_SKEW: "Waktu pengambilan tidak wajar",
  GEO_MISSING: "Izin lokasi diperlukan untuk memverifikasi kontribusi",
  GEO_ACCURACY_LOW: "Ketelitian lokasi terlalu rendah untuk diverifikasi",
  GEO_FIX_STALE: "Posisi terakhir terlalu lama. Tunggu sebentar lalu ulangi",
  GEO_TOO_FAR: "Lokasi pengambilan terlalu jauh dari tempat yang dipilih",
  DUPLICATE_IMAGE: "Foto ini sudah pernah dikirim sebelumnya",
};

/** Kode pemeriksaan (C0…C8) ↔ kode alasan. Server boleh mengirim salah satunya. */
export const CHECK_TO_REASON: Record<string, ReasonCode> = {
  C0: "CAPTURE_SESSION_INVALID",
  C1: "RATE_LIMITED",
  C3: "FILE_METADATA_PRESENT",
  C4: "TIMESTAMP_SKEW",
  C5: "GEO_MISSING",
  C6: "GEO_ACCURACY_LOW",
  C6b: "GEO_FIX_STALE",
  C7: "GEO_TOO_FAR",
  C8: "DUPLICATE_IMAGE",
};

export const CHECK_LABEL: Record<ReasonCode, string> = {
  CAPTURE_SESSION_INVALID: "Sesi pengambilan foto",
  RATE_LIMITED: "Batas kontribusi per jam",
  FILE_METADATA_PRESENT: "Metadata berkas",
  TIMESTAMP_SKEW: "Selisih waktu pengambilan",
  GEO_MISSING: "Lokasi tersedia",
  GEO_ACCURACY_LOW: "Ketelitian lokasi",
  GEO_FIX_STALE: "Umur posisi GPS",
  GEO_TOO_FAR: "Jarak ke tempat",
  DUPLICATE_IMAGE: "Foto berulang",
};

export function reasonOf(code: string): ReasonCode | null {
  if (code in REASON_MESSAGE) return code as ReasonCode;
  return CHECK_TO_REASON[code] ?? null;
}

export function checkLabel(code: string): string {
  const r = reasonOf(code);
  return r ? CHECK_LABEL[r] : code;
}

/**
 * Angka dari `measured`/`threshold`. Server mengirimnya sebagai teks dan boleh
 * menyertakan satuan — suite tests/rejection memakai "120 m" dan "hamming 4".
 * Yang diambil angka pertamanya; satuannya ditulis ulang oleh kalimat di bawah.
 * Teks tanpa angka sama sekali (misalnya "EXIF, tag GPS") dikembalikan apa adanya.
 */
export function measuredNumber(s: string | null): string | null {
  if (s === null || s.trim() === "") return null;
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return s.trim();
  const n = Number(m[0].replace(",", "."));
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n);
}
const num = measuredNumber;

/**
 * Kalimat nilai terukur dan ambangnya. "Jarak terukur 214 meter, batas 120
 * meter" adalah inti pesan produk; tanpa angka, penolakan cuma pesan error biasa.
 */
export function measuredSentence(code: string, measured: string | null, threshold: string | null): string | null {
  const m = num(measured);
  const t = num(threshold);
  const r = reasonOf(code);
  // Penjelasan metadata tetap tampil walau server tidak mengirim angka —
  // contoh L9 di spek 30 menampilkannya.
  if (r === "FILE_METADATA_PRESENT")
    return `Ditemukan metadata berkas${measured ? ` (${measured.trim()})` : ""}; foto dari kamera aplikasi tidak pernah membawanya.`;
  if (m === null && t === null) return null;
  switch (r) {
    case "GEO_TOO_FAR":
      return `Jarak terukur ${m ?? "?"} meter. Batas untuk tempat ini ${t ?? "?"} meter.`;
    case "GEO_ACCURACY_LOW":
      return `Ketelitian lokasi yang dilaporkan perangkat ${m ?? "?"} meter. Batas yang diterima ${t ?? "?"} meter.`;
    case "GEO_FIX_STALE":
      return `Posisi GPS berumur ${m ?? "?"} detik saat diterima. Batas ${t ?? "?"} detik.`;
    case "TIMESTAMP_SKEW":
      return `Selisih jam perangkat dan jam server ${m ?? "?"} detik. Batas ${t ?? "?"} detik.`;
    case "DUPLICATE_IMAGE":
      return `Jarak kemiripan dengan foto yang sudah ada ${m ?? "?"} (Hamming, 64 bit). Dianggap berkas yang sama bila ${t ?? "?"} atau kurang.`;
    case "RATE_LIMITED":
      return `${m ?? "?"} kiriman dalam satu jam terakhir dari sesi ini. Batas ${t ?? "?"} per jam.`;
    default:
      return `Nilai terukur ${m ?? "—"}. Ambang ${t ?? "—"}.`;
  }
}

/** Apa yang bisa dilakukan sekarang, per alasan. */
export const REASON_NEXT: Record<ReasonCode, string> = {
  CAPTURE_SESSION_INVALID: "Ambil ulang: sesi baru dibuat otomatis dan berlaku 10 menit untuk satu foto.",
  RATE_LIMITED: "Tunggu sampai satu jam sejak kiriman pertama, lalu kirim lagi.",
  FILE_METADATA_PRESENT: "Ambil foto langsung dengan kamera di halaman ini. Foto dari galeri tidak diterima.",
  TIMESTAMP_SKEW: "Pastikan jam perangkat diatur otomatis, lalu ambil ulang.",
  GEO_MISSING: "Izinkan akses lokasi untuk situs ini di pengaturan peramban, lalu ambil ulang.",
  GEO_ACCURACY_LOW: "Pindah ke tempat yang lebih terbuka atau dekat jendela, tunggu angka ketelitian turun, lalu ambil ulang.",
  GEO_FIX_STALE: "Tunggu beberapa detik sampai posisi diperbarui, lalu ambil ulang.",
  GEO_TOO_FAR: "Ambil foto dari depan tempat yang dipilih, atau pilih tempat yang benar.",
  DUPLICATE_IMAGE: "Ambil foto baru dari posisi Anda sekarang.",
};

/** Galat 400 dari E4 yang bukan penolakan kontribusi, melainkan bentuk
 *  permintaan yang cacat. Tidak ada di 00-KONTRAK §6; dipakai suite Trust. */
export const REQUEST_ERROR_HINT: Record<string, string> = {
  FILE_TYPE_INVALID:
    "Berkas bukan JPEG. Pemeriksaan keaslian hanya berjalan untuk JPEG, jadi kiriman ini tidak dihitung sebagai kontribusi.",
};

export const CHECK_RESULT_LABEL = { pass: "Lolos", flag: "Ditandai", fail: "Tidak lolos" } as const;

// ── Jejak audit ─────────────────────────────────────────────────────────────

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  evidence_submitted: "Bukti foto dikirim dan diperiksa",
  provenance_failed: "Pemeriksaan keaslian tidak lolos — bukti ditolak",
  observation_confirmed: "Nilai dikonfirmasi kontributor",
  state_updated: "Nilai berlaku diperbarui",
  rate_limit_reset: "Batas kontribusi direset secara tercatat",
};

export function actorLabel(actor: string): string {
  return actor === "system" ? "Sistem" : actor;
}
