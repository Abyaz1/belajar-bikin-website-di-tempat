/**
 * Kartu lokasi di daftar (L2). Seluruh kartu satu sasaran tekan, tanpa tautan
 * bersarang: tautan di judul diregangkan menutupi kartu (lihat .card-link).
 */

import Link from "next/link";
import type { PlaceSummary, ProfileCode, Verdict } from "./api/types";
import { DemoLabel, VerdictBadge } from "./badges";
import { attributeLabel } from "./copy";
import { cx } from "./cx";
import { formatDate } from "./format";

// Garis tepi kiri mengikuti penilaian: warna penilaian ditambah gaya garis,
// putus-putus untuk "belum dapat dipastikan", supaya pembedanya tidak hanya
// warna. Badge berteks di dalam kartu tetap penanda utamanya.
const TEPI: Record<Verdict, string> = {
  tidak_dapat_diakses: "border-s-tidak-line",
  dengan_catatan: "border-s-catatan-line",
  dapat_diakses: "border-s-dapat-line",
  belum_dapat_dipastikan: "border-s-belum-line [border-inline-start-style:dashed]",
};

export function PlaceCard({ place, profile, href }: { place: PlaceSummary; profile: ProfileCode; href: string }) {
  const c = place.status_counts ?? { terverifikasi: 0, belum_terverifikasi: 0, perlu_ditinjau_ulang: 0 };
  const total = c.terverifikasi + c.belum_terverifikasi + c.perlu_ditinjau_ulang;
  const checked = c.terverifikasi + c.perlu_ditinjau_ulang;

  return (
    <li className={cx("card-link space-y-3 rounded-md border border-s-[6px] border-line-control bg-surface p-6", TEPI[place.verdict])}>
      <div>
        <h3 className="text-card">
          <Link href={href} className="stretch text-ink no-underline hover:underline">
            {place.name}
          </Link>
        </h3>
        {place.category ? <p className="text-meta text-ink-muted">{place.category}</p> : null}
      </div>

      <VerdictBadge verdict={place.verdict} profile={profile} />

      <p className="text-meta">
        {checked === 0
          ? "Belum ada satu pun kondisi fisik yang diperiksa."
          : `${checked} dari ${total} kondisi fisik sudah diperiksa${
              c.perlu_ditinjau_ulang > 0 ? `, ${c.perlu_ditinjau_ulang} di antaranya perlu ditinjau ulang` : ""
            }.`}
      </p>

      {place.verdict === "belum_dapat_dipastikan" && place.unknown_attributes?.length > 0 ? (
        <p className="text-meta text-ink-muted">
          Belum diketahui untuk profil ini: {place.unknown_attributes.map((a) => attributeLabel(a).toLowerCase()).join(", ")}.
        </p>
      ) : null}

      {place.freshness_notes?.map((n) => (
        <p key={n.attribute_code} className="text-meta text-ink-muted">
          {attributeLabel(n.attribute_code)} terakhir diperiksa {formatDate(n.last_verified_at)}, perlu ditinjau ulang.
        </p>
      ))}

      {place.is_demo_seed ? <DemoLabel /> : null}
    </li>
  );
}
