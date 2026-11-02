import Link from "next/link";
import {
  PROFILES,
  VANTAGES,
  type AttributeDetail,
  type PlaceDetail,
  type ProfileCode,
} from "@/lib/ui/api/types";
import { AttributeRow, FotoTitikPandang, LegendaTanda, fotoTitikPandang } from "@/lib/ui/attribute-row";
import { VerdictBadge } from "@/lib/ui/badges";
import { ButtonLink } from "@/lib/ui/button";
import {
  PROFILE_LABEL,
  PROFILE_TITLE,
  VANTAGE_LABEL,
  attributeLabel,
  attributeVantage,
} from "@/lib/ui/copy";
import { formatDate } from "@/lib/ui/format";

export function BagianPenilaian({
  place,
  profile,
  checkedCount,
  contributeHref,
}: {
  place: PlaceDetail;
  profile: ProfileCode;
  checkedCount: number;
  contributeHref: string;
}) {
  const blockers = place.notes.filter((n) => n.verdict === "blocker");
  const cautions = place.notes.filter((n) => n.verdict === "caution");

  return (
    <section aria-labelledby="judul-penilaian" className="space-y-4">
      <h2 id="judul-penilaian" className="text-section">
        Penilaian
      </h2>
      <VerdictBadge key={profile} verdict={place.verdict} profile={profile} size="besar" stempel={0} />

      {checkedCount === 0 ? (
        <div className="space-y-2 rounded-md border-2 border-dashed border-line-control p-4">
          <p className="font-semibold">Belum ada satu pun bukti kondisi fisik untuk tempat ini.</p>
          <p>
            Yang kami punya hanya lokasinya. Kami tidak menebak: sampai ada foto yang lolos pemeriksaan, penilaiannya
            tetap &ldquo;belum dapat dipastikan&rdquo; untuk semua profil.
          </p>
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-card">Hambatan yang tercatat</h3>
          <ul className="list-disc space-y-1 ps-6">
            {blockers.map((n) => (
              <li key={n.rule_id}>{n.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {cautions.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-card">Catatan</h3>
          <ul className="list-disc space-y-1 ps-6">
            {cautions.map((n) => (
              <li key={n.rule_id}>{n.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {place.verdict === "belum_dapat_dipastikan" && place.unknown_attributes.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-card">Yang menentukan tapi belum diperiksa</h3>
          <p>
            Untuk profil {PROFILE_LABEL[profile]}, penilaian butuh:{" "}
            {place.unknown_attributes.map((a) => attributeLabel(a).toLowerCase()).join(", ")}.
          </p>
        </div>
      ) : null}

      {place.verdict === "dapat_diakses" ? (
        <p>Semua kondisi yang menentukan untuk profil ini sudah diperiksa, dan tidak ada hambatan yang tercatat.</p>
      ) : null}

      {place.freshness_notes.map((n) => (
        <p key={n.attribute_code}>
          {attributeLabel(n.attribute_code)} terakhir diperiksa {formatDate(n.last_verified_at)} dan sudah lewat tenggat
          tinjau ulang. Penilaian tetap memakai nilai itu, dengan catatan ini.
        </p>
      ))}

      <ButtonLink href={contributeHref}>Perbarui data ini</ButtonLink>
    </section>
  );
}

export function TabelTigaProfil({
  byProfile,
}: {
  byProfile: Record<ProfileCode, PlaceDetail | null>;
}) {
  return (
    <section aria-labelledby="judul-tiga" className="space-y-3">
      <h2 id="judul-tiga" className="text-section">
        Fakta yang sama, tiga penilaian
      </h2>
      <p className="text-meta text-ink-muted">
        Basis data tidak menyimpan kata &ldquo;dapat diakses&rdquo;. Yang tersimpan hanya kondisi fisik di bawah. Tabel
        ini satu kumpulan fakta yang dinilai tiga kali, saat halaman ini dibuka.
      </p>
      <table className="w-full max-w-2xl border-collapse">
        <thead>
          <tr className="border-b-2 border-line-control">
            <th scope="col" className="py-2 pe-3 text-start">
              Profil
            </th>
            <th scope="col" className="py-2 text-start">
              Penilaian
            </th>
          </tr>
        </thead>
        <tbody>
          {PROFILES.map((p) => {
            const r = byProfile[p];
            return (
              <tr key={p} className="border-b border-line">
                <th scope="row" className="py-3 pe-3 text-start font-semibold">
                  {PROFILE_TITLE[p]}
                </th>
                <td className="py-3">{r ? <VerdictBadge verdict={r.verdict} profile={p} /> : "Tidak tersedia"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function BagianKondisiFisik({
  id,
  placeName,
  profile,
  baseHref,
  attrs,
  checkedCount,
}: {
  id: string;
  placeName: string;
  profile: ProfileCode;
  baseHref: string;
  attrs: AttributeDetail[];
  checkedCount: number;
}) {
  return (
    <section aria-labelledby="judul-kondisi" className="space-y-6">
      <div className="space-y-1">
        <h2 id="judul-kondisi" className="text-section">
          Kondisi fisik
        </h2>
        <p className="text-meta text-ink-muted">
          {checkedCount} dari {attrs.length} kondisi sudah diperiksa. Setiap nilai membawa foto, hasil pemeriksaan, dan
          tanggalnya.
        </p>
        <LegendaTanda />
      </div>
      {VANTAGES.map((v) => {
        const rows = attrs.filter((a) => attributeVantage(a.code) === v);
        if (rows.length === 0) return null;
        return (
          <section key={v} aria-labelledby={`judul-${v}`} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`judul-${v}`} className="text-card">
                {VANTAGE_LABEL[v]}
              </h3>
              <Link
                href={`/kontribusi/${encodeURIComponent(id)}/${v}?profil=${profile}`}
                className="inline-flex min-h-12 items-center text-meta"
              >
                Kirim foto {VANTAGE_LABEL[v].toLowerCase()}
              </Link>
            </div>
            {/* Satu foto besar untuk seluruh titik pandang, lalu kondisinya.
                Satu kiriman foto menjadi bukti semua kondisi di sini, jadi
                mengulang foto yang sama di tiap baris hanya membingungkan. */}
            <div className="overflow-hidden rounded-md border border-line bg-surface">
              <FotoTitikPandang sumber={fotoTitikPandang(rows)} judul={VANTAGE_LABEL[v]} placeName={placeName} />
              <ul className="px-4">
                {rows.map((a) => (
                  <AttributeRow
                    key={a.code}
                    attribute={a}
                    placeName={placeName}
                    fotoKelompok={fotoTitikPandang(rows)?.photo_url ?? null}
                    detailHref={`${baseHref}/atribut/${encodeURIComponent(a.code)}?profil=${profile}`}
                    auditHref={`${baseHref}/atribut/${encodeURIComponent(a.code)}/audit`}
                  />
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </section>
  );
}
