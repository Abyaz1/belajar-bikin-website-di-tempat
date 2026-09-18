/**
 * Baris atribut di laporan kesiapan (L4):
 * nama · nilai dalam kalimat utuh · badge status · jumlah penguat · pratayang
 * foto · tautan rincian dan jejak audit.
 */

import Link from "next/link";
import type { AttributeDetail } from "./api/types";
import { DemoLabel, EvidenceBadge } from "./badges";
import { VANTAGE_LABEL, attributeLabel, attributeVantage, valueOption, valueSentence } from "./copy";
import { formatDate } from "./format";

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

export function AttributeRow({
  attribute: a,
  placeName,
  detailHref,
  auditHref,
}: {
  attribute: AttributeDetail;
  placeName: string;
  detailHref: string;
  auditHref: string;
}) {
  const label = attributeLabel(a.code, a.label);
  const { checked, osmClaim, sentence } = attributeFacts(a);
  const corroboration = corroborationText(a.corroboration_count);

  return (
    <li className="flex flex-wrap gap-4 border-t border-line py-4 first:border-t-0">
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <h4 className="text-card">{label}</h4>
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
          <Link href={detailHref} className="inline-flex min-h-11 items-center">
            Rincian dan bukti<span className="sr-only">: {label}</span>
          </Link>
          <Link href={auditHref} className="inline-flex min-h-11 items-center">
            Jejak audit<span className="sr-only">: {label}</span>
          </Link>
        </p>
      </div>
      {a.photo_url ? (
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
