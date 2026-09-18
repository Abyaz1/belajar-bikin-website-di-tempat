/**
 * Naskah bacaan untuk tombol "Bacakan" (text-to-speech). MURNI: dari data E2
 * jadi daftar kalimat, tanpa peramban, supaya bisa dites.
 *
 * Kalimatnya disusun untuk DIDENGAR, bukan dibaca: tanpa simbol (—, ·, ›),
 * tanggal dengan nama bulan utuh, dan penilaian selalu menyebut profilnya.
 * Sumber kalimat atribut sama dengan layar (`valueSentence`), supaya
 * "terverifikasi tidak ada" dan "belum diketahui" tetap dibedakan strukturnya.
 *
 * Satu kalimat satu butir: Chrome memotong ucapan panjang di tengah (sekitar
 * 15 detik), jadi pemutar mengantrekan butir-butir pendek.
 */

import type { AttributeDetail, PlaceDetail, ProfileCode } from "@/lib/ui/api/types";
import {
  PROFILE_LABEL,
  VANTAGE_LABEL,
  VERDICT_LABEL,
  attributeLabel,
  attributeVantage,
  valueOption,
  valueSentence,
} from "@/lib/ui/copy";

const TANGGAL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** "12 September 2026". Nama bulan utuh karena "Sep" dieja aneh oleh mesin suara. */
export function tanggalLisan(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : TANGGAL.format(d);
}

function titik(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Kalimat bukti satu atribut: nilai, status, dan tanggalnya. */
export function naskahAtribut(a: AttributeDetail): string[] {
  const label = attributeLabel(a.code, a.label);
  const diperiksa = a.status !== "belum_terverifikasi";
  const hasil = [titik(valueSentence(a.code, diperiksa ? a.current_value : null))];

  if (diperiksa) {
    const tgl = tanggalLisan(a.last_verified_at);
    hasil.push(
      a.status === "perlu_ditinjau_ulang"
        ? `Terakhir diperiksa ${tgl ?? "pada tanggal yang tidak tercatat"}, dan sudah lewat tenggat tinjau ulang.`
        : `Terverifikasi dengan foto${tgl ? `, terakhir diperiksa ${tgl}` : ""}.`,
    );
    if (a.corroboration_count > 1) hasil.push(`Dikuatkan ${a.corroboration_count} kontributor berbeda.`);
  } else if (a.source === "osm_seed" && a.current_value) {
    hasil.push(
      `OpenStreetMap mencatat ${valueOption(a.code, a.current_value).toLowerCase()}, tapi itu klaim pihak ketiga yang belum diperiksa, jadi tidak dipakai untuk menilai.`,
    );
  }
  if (a.is_disputed) {
    const tgl = tanggalLisan(a.previous_observed_at);
    hasil.push(
      `Ada catatan berbeda sebelumnya${tgl ? `, ${tgl}` : ""}: ${valueOption(a.code, a.previous_value).toLowerCase()}. Yang dipakai untuk menilai adalah catatan terbaru.`,
    );
  }
  if (a.is_demo_seed) hasil.push("Riwayat atribut ini adalah data demo.");
  // Label disebut sekali di depan supaya pendengar tahu kondisi mana yang sedang dibacakan.
  return [`${label}.`, ...hasil];
}

/** Naskah laporan kesiapan (L4) untuk satu profil. */
export function naskahLaporan(tempat: PlaceDetail, profil: ProfileCode, urutanAtribut: string[]): string[] {
  const hasil: string[] = [];
  const keterangan = [tempat.category, tempat.address].filter(Boolean).join(", ");
  hasil.push(titik(keterangan ? `${tempat.name}, ${keterangan}` : tempat.name));
  if (tempat.is_demo_seed) hasil.push("Sebagian riwayat tempat ini adalah data demo.");

  hasil.push(`Penilaian untuk profil ${PROFILE_LABEL[profil]}: ${VERDICT_LABEL[tempat.verdict].toLowerCase()}.`);

  const diperiksa = tempat.attributes.filter((a) => a.status !== "belum_terverifikasi");
  if (diperiksa.length === 0) {
    hasil.push(
      "Belum ada satu pun bukti kondisi fisik untuk tempat ini. Sampai ada foto yang lolos pemeriksaan, penilaiannya tetap belum dapat dipastikan untuk semua profil.",
    );
  }

  const hambatan = tempat.notes.filter((n) => n.verdict === "blocker");
  const catatan = tempat.notes.filter((n) => n.verdict === "caution");
  if (hambatan.length > 0) {
    hasil.push(hambatan.length === 1 ? "Satu hambatan tercatat." : `${hambatan.length} hambatan tercatat.`);
    hasil.push(...hambatan.map((n) => titik(n.message)));
  }
  if (catatan.length > 0) {
    hasil.push("Catatan.");
    hasil.push(...catatan.map((n) => titik(n.message)));
  }
  if (tempat.verdict === "belum_dapat_dipastikan" && tempat.unknown_attributes.length > 0) {
    const butuh = tempat.unknown_attributes.map((c) => attributeLabel(c).toLowerCase()).join(", ");
    hasil.push(`Untuk profil ${PROFILE_LABEL[profil]}, penilaian masih butuh: ${butuh}.`);
  }
  for (const n of tempat.freshness_notes) {
    const tgl = tanggalLisan(n.last_verified_at);
    hasil.push(
      `${attributeLabel(n.attribute_code)} terakhir diperiksa ${tgl ?? "pada tanggal yang tidak tercatat"} dan sudah lewat tenggat tinjau ulang.`,
    );
  }

  hasil.push(`Kondisi fisik: ${diperiksa.length} dari ${tempat.attributes.length} sudah diperiksa.`);
  const urut = (c: string) => {
    const i = urutanAtribut.indexOf(c);
    return i === -1 ? 99 : i;
  };
  const atribut = [...tempat.attributes].sort((a, b) => urut(a.code) - urut(b.code));
  let titikPandang: string | null = null;
  for (const a of atribut) {
    const v = VANTAGE_LABEL[attributeVantage(a.code)];
    if (v !== titikPandang) {
      titikPandang = v;
      hasil.push(`${v}.`);
    }
    hasil.push(...naskahAtribut(a));
  }
  hasil.push("Selesai. Rincian bukti dan jejak audit tiap kondisi ada di halaman ini.");
  return hasil;
}
