/**
 * Baris atribut di laporan kesiapan (L4):
 * nama · nilai dalam kalimat utuh · badge status · jumlah penguat · pratayang
 * foto · tautan rincian dan jejak audit.
 */

import Link from "next/link";
import type { AttributeDetail } from "./api/types";
import { DemoLabel, EvidenceBadge } from "./badges";
import { VANTAGE_LABEL, attributeLabel, attributeVantage, valueOption, valueSentence } from "./copy";
import { cx } from "./cx";
import { formatDate } from "./format";
import { IconCheck, IconDash, IconQuestion, IconX } from "./icons";

export function attributeFacts(a: AttributeDetail) {
  const checked = a.status !== "belum_terverifikasi";
  return {
    checked,
    /** Nilai seed OSM: klaim pihak ketiga, TIDAK menggerakkan penilaian. */
    osmClaim: !checked && a.source === "osm_seed" && a.current_value ? a.current_value : null,
    sentence: valueSentence(a.code, checked ? a.current_value : null),
  };
}

export function photoAlt(a: AttributeDetail, placeName: string): string {
  return (
    a.photo_alt ||
    `Foto ${VANTAGE_LABEL[attributeVantage(a.code)].toLowerCase()} ${placeName}, bukti untuk ${attributeLabel(a.code, a.label).toLowerCase()}`
  );
}

export function corroborationText(n: number): string | null {
  if (!n || n < 1) return null;
  return n === 1 ? "Dari 1 kontributor" : `Dikuatkan ${n} kontributor berbeda`;
}

// ── Tanda kondisi ───────────────────────────────────────────────────────────
// Tanda umum di depan tiap kondisi: apakah kondisi itu MENDUKUNG akses secara
// umum (centang), MENGHAMBAT (silang), TERGANTUNG kebutuhan (strip), atau
// BELUM DIPERIKSA (tanya, garis putus-putus). Ini bukan penilaian per profil;
// penilaian per profil tetap hanya di badge penilaian. Karena itu warnanya
// netral (warna semantik hanya untuk penilaian), dan tiap tanda selalu
// berdampingan dengan teks pendek, tidak hanya ikon.

type JenisTanda = "dukung" | "hambat" | "tergantung" | "belum";

const TANDA: Record<string, Record<string, [JenisTanda, string]>> = {
  step_count: {}, // diisi fungsi di bawah: 0 mendukung, lebih dari 0 menghambat
  ramp_wheelchair: { yes: ["dukung", "Ada ramp"], no: ["hambat", "Tidak ada ramp"] },
  kerb: {
    flush: ["dukung", "Rata dengan jalan"],
    lowered: ["dukung", "Dilandaikan"],
    raised: ["hambat", "Tinggi"],
  },
  door_width_band: {
    gt90: ["dukung", "Lebar"],
    "80_90": ["tergantung", "Sedang"],
    lt80: ["hambat", "Sempit"],
  },
  surface_condition: {
    good: ["dukung", "Baik"],
    uneven: ["tergantung", "Tidak rata"],
    damaged: ["hambat", "Rusak"],
  },
  tactile_paving: { yes: ["dukung", "Ada"], no: ["hambat", "Tidak ada"] },
  elevator_status: {
    working: ["dukung", "Berfungsi"],
    not_working: ["hambat", "Tidak berfungsi"],
    // Tanpa lift hanya menghambat kalau layanan ada di atas lantai dasar.
    none: ["tergantung", "Tidak ada lift"],
  },
  toilets_wheelchair: { yes: ["dukung", "Ada"], no: ["hambat", "Tidak ada"] },
};

export function tandaKondisi(a: AttributeDetail): { jenis: JenisTanda; teks: string } {
  const { checked } = attributeFacts(a);
  if (!checked || a.current_value === null) return { jenis: "belum", teks: "Belum diperiksa" };
  if (a.code === "step_count") {
    const n = Number(a.current_value);
    return n === 0 ? { jenis: "dukung", teks: "Tanpa anak tangga" } : { jenis: "hambat", teks: "Ada anak tangga" };
  }
  const t = TANDA[a.code]?.[a.current_value];
  return t ? { jenis: t[0], teks: t[1] } : { jenis: "tergantung", teks: "Tercatat" };
}

const GAYA_TANDA: Record<JenisTanda, { kotak: string; Ikon: () => ReturnType<typeof IconCheck> }> = {
  dukung: { kotak: "bg-brand text-on-brand border-brand", Ikon: IconCheck },
  hambat: { kotak: "bg-surface text-ink border-ink", Ikon: IconX },
  tergantung: { kotak: "bg-surface-alt text-ink border-line-control", Ikon: IconDash },
  belum: { kotak: "bg-surface text-ink-muted border-line-control border-dashed", Ikon: IconQuestion },
};

export function TandaKondisi({ attribute }: { attribute: AttributeDetail }) {
  const { jenis, teks } = tandaKondisi(attribute);
  const { kotak, Ikon } = GAYA_TANDA[jenis];
  return (
    <span className="inline-flex items-center gap-2 text-label">
      <span aria-hidden="true" className={cx("grid size-7 shrink-0 place-items-center rounded-pill border-2", kotak)}>
        <Ikon />
      </span>
      {teks}
    </span>
  );
}

/** Legenda satu baris untuk tanda kondisi, dipasang sekali per halaman. */
export function LegendaTanda() {
  const item = (jenis: JenisTanda, teks: string) => {
    const { kotak, Ikon } = GAYA_TANDA[jenis];
    return (
      <li className="inline-flex items-center gap-2">
        <span aria-hidden="true" className={cx("grid size-6 place-items-center rounded-pill border-2", kotak)}>
          <Ikon />
        </span>
        {teks}
      </li>
    );
  };
  return (
    <ul aria-label="Arti tanda kondisi" className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-meta text-ink-muted">
      {item("dukung", "Mendukung akses")}
      {item("hambat", "Menghambat")}
      {item("tergantung", "Tergantung kebutuhan")}
      {item("belum", "Belum diperiksa")}
    </ul>
  );
}

// ── Foto satu titik pandang ─────────────────────────────────────────────────
// Satu kiriman foto menjadi bukti untuk semua kondisi di titik pandang yang
// sama, jadi fotonya ditampilkan sekali, besar, di atas daftar kondisinya.
// Dipilih foto dari kondisi yang paling baru diperiksa.

export function fotoTitikPandang(rows: AttributeDetail[]): AttributeDetail | null {
  return (
    rows
      .filter((a) => a.photo_url)
      .sort((x, y) => (y.last_verified_at ?? "").localeCompare(x.last_verified_at ?? ""))[0] ?? null
  );
}

export function FotoTitikPandang({
  sumber,
  judul,
  placeName,
}: {
  sumber: AttributeDetail | null;
  judul: string;
  placeName: string;
}) {
  if (!sumber?.photo_url) {
    return (
      <div className="grid h-40 place-items-center border-b-2 border-dashed border-line-control bg-surface-alt px-4 text-center text-ink-muted">
        Belum ada foto {judul.toLowerCase()} yang lolos pemeriksaan.
      </div>
    );
  }
  return (
    <figure className="border-b border-line">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto bukti dari endpoint sendiri, ukuran sudah dibatasi server */}
      <img
        src={sumber.photo_url}
        alt={`Foto ${judul.toLowerCase()} ${placeName}, bukti untuk kondisi di bawahnya`}
        loading="lazy"
        decoding="async"
        className="h-72 w-full bg-surface-alt object-contain md:h-[28rem]"
      />
      <figcaption className="px-4 pt-3 text-meta text-ink-muted">
        Foto {judul.toLowerCase()} terbaru, diperiksa {formatDate(sumber.last_verified_at)}. Satu foto menjadi bukti untuk
        semua kondisi di bawah ini; foto kiriman lain ada di jejak audit tiap kondisi.
      </figcaption>
    </figure>
  );
}

export function AttributeRow({
  attribute: a,
  placeName,
  detailHref,
  auditHref,
  fotoKelompok = null,
}: {
  attribute: AttributeDetail;
  placeName: string;
  detailHref: string;
  auditHref: string;
  /** Foto besar titik pandangnya. Foto baris hanya tampil kalau berbeda. */
  fotoKelompok?: string | null;
}) {
  const label = attributeLabel(a.code, a.label);
  const { checked, osmClaim, sentence } = attributeFacts(a);
  const corroboration = corroborationText(a.corroboration_count);

  return (
    <li className="flex flex-wrap gap-4 border-t border-line py-4 first:border-t-0">
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h4 className="text-card">{label}</h4>
          <TandaKondisi attribute={a} />
        </div>
        <p className={checked ? "" : "text-ink-muted"}>{sentence}</p>
        {osmClaim ? (
          <p className="text-meta text-ink-muted">
            OpenStreetMap mencatat &ldquo;{valueOption(a.code, osmClaim).toLowerCase()}&rdquo;. Itu klaim pihak ketiga yang
            belum diperiksa sistem ini, jadi tidak dipakai untuk menilai.
          </p>
        ) : null}
        {a.is_disputed ? (
          <p className="text-meta">
            Tercatat nilai berbeda sebelumnya: {valueOption(a.code, a.previous_value).toLowerCase()} (
            {formatDate(a.previous_observed_at)}). Keduanya ditampilkan.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge status={a.status} lastVerifiedAt={a.last_verified_at} disputed={a.is_disputed} />
          {corroboration ? <span className="text-meta">{corroboration}</span> : null}
          {a.is_demo_seed ? <DemoLabel /> : null}
        </div>
        <p className="flex flex-wrap gap-x-4 text-meta">
          <Link href={detailHref} className="inline-flex min-h-12 items-center">
            Rincian dan bukti<span className="sr-only">: {label}</span>
          </Link>
          <Link href={auditHref} className="inline-flex min-h-12 items-center">
            Jejak audit<span className="sr-only">: {label}</span>
          </Link>
        </p>
      </div>
      {a.photo_url && a.photo_url !== fotoKelompok ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto bukti dari endpoint sendiri, ukuran sudah dibatasi server
        <img
          src={a.photo_url}
          alt={photoAlt(a, placeName)}
          loading="lazy"
          className="h-24 w-32 shrink-0 rounded-sm border border-line object-cover"
        />
      ) : null}
    </li>
  );
}
