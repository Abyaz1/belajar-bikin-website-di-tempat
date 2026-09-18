import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlace, getPlaceFacts } from "@/lib/ui/api/server";
import { PROFILES, VANTAGES, isProfile, type PlaceDetail, type ProfileCode } from "@/lib/ui/api/types";
import { AttributeRow } from "@/lib/ui/attribute-row";
import { DemoLabel, VerdictBadge } from "@/lib/ui/badges";
import { ButtonLink } from "@/lib/ui/button";
import {
  ATTRIBUTE_ORDER,
  PROFILE_LABEL,
  PROFILE_TITLE,
  VANTAGE_LABEL,
  attributeLabel,
  attributeVantage,
  verdictWithProfile,
} from "@/lib/ui/copy";
import { formatDate } from "@/lib/ui/format";
import { ProfileAnnouncer } from "@/lib/ui/profile-announcer";
import { ProfilePicker } from "@/lib/ui/profile-picker";
import { naskahLaporan } from "../../_bacakan/naskah";
import { TombolBacakan } from "../../_bacakan/tombol-bacakan";

// L4 — laporan kesiapan. Keadaan: lengkap, sebagian, semua belum terverifikasi.

export async function generateMetadata({ params, searchParams }: PageProps<"/tempat/[id]">): Promise<Metadata> {
  const { id } = await params;
  const raw = (await searchParams).profil;
  const facts = await getPlaceFacts(id).catch(() => null);
  if (!facts) return { title: "Tempat" };
  return { title: isProfile(raw) ? `${facts.name} — ${PROFILE_LABEL[raw]}` : facts.name };
}

function orderIndex(code: string) {
  const i = ATTRIBUTE_ORDER.indexOf(code);
  return i === -1 ? 99 : i;
}

export default async function Page({ params, searchParams }: PageProps<"/tempat/[id]">) {
  const { id } = await params;
  const raw = (await searchParams).profil;
  const profile = isProfile(raw) ? raw : null;
  const base = `/tempat/${encodeURIComponent(id)}`;
  const hrefs = Object.fromEntries(PROFILES.map((p) => [p, `${base}?profil=${p}`])) as Record<ProfileCode, string>;

  if (!profile) {
    const facts = await getPlaceFacts(id);
    if (!facts) notFound();
    return (
      <div className="space-y-6">
        <h1 className="text-screen">{facts.name}</h1>
        <p>Penilaian selalu untuk profil tertentu. Pilih profil untuk melihat laporan tempat ini.</p>
        <ProfilePicker current={null} hrefs={hrefs} />
      </div>
    );
  }

  // Tiga penilaian untuk fakta yang sama: satu permintaan per profil.
  const results = await Promise.all(PROFILES.map((p) => getPlace(id, p)));
  const place = results[PROFILES.indexOf(profile)];
  if (!place) notFound();
  const byProfile = Object.fromEntries(PROFILES.map((p, i) => [p, results[i]])) as Record<ProfileCode, PlaceDetail | null>;

  const attrs = [...place.attributes].sort((a, b) => orderIndex(a.code) - orderIndex(b.code));
  const checkedCount = attrs.filter((a) => a.status !== "belum_terverifikasi").length;
  const blockers = place.notes.filter((n) => n.verdict === "blocker");
  const cautions = place.notes.filter((n) => n.verdict === "caution");
  const contributeHref = `/kontribusi/${encodeURIComponent(id)}?profil=${profile}`;
  const announce = `Profil diganti. ${verdictWithProfile(place.verdict, profile)}.${blockers[0] ? ` ${blockers[0].message}` : ""}`;

  return (
    <div className="space-y-12">
      <nav aria-label="Jejak halaman" className="breadcrumb text-meta">
        <Link href={`/tempat?profil=${profile}`}>Daftar tempat</Link> <span aria-hidden="true">›</span>{" "}
        <span aria-current="page">{place.name}</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-screen">{place.name}</h1>
        <p className="text-meta text-ink-muted">
          {[place.category, place.address].filter(Boolean).join(" · ")}
          {place.category || place.address ? " · " : ""}Lokasi dari{" "}
          {place.source === "osm_seed" ? (
            <a href="https://www.openstreetmap.org/copyright">© kontributor OpenStreetMap (ODbL)</a>
          ) : (
            "entri manual"
          )}
        </p>
        {place.is_demo_seed ? <DemoLabel detail="sebagian riwayat tempat ini disemai untuk memperagakan penguatan, peluruhan, dan sengketa" /> : null}
        <ProfilePicker current={profile} hrefs={hrefs} />
        <ProfileAnnouncer profile={profile} message={announce} />
        <TombolBacakan naskah={naskahLaporan(place, profile, ATTRIBUTE_ORDER)} />
      </header>

      <section aria-labelledby="judul-penilaian" className="space-y-4">
        <h2 id="judul-penilaian" className="text-section">
          Penilaian
        </h2>
        <VerdictBadge verdict={place.verdict} profile={profile} size="besar" />

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
                  <td className="py-3">{r ? <VerdictBadge verdict={r.verdict} profile={p} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="judul-kondisi" className="space-y-6">
        <div className="space-y-1">
          <h2 id="judul-kondisi" className="text-section">
            Kondisi fisik
          </h2>
          <p className="text-meta text-ink-muted">
            {checkedCount} dari {attrs.length} kondisi sudah diperiksa. Setiap nilai membawa foto, hasil pemeriksaan, dan
            tanggalnya.
          </p>
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
                <Link href={`/kontribusi/${encodeURIComponent(id)}/${v}?profil=${profile}`} className="inline-flex min-h-11 items-center text-meta">
                  Kirim foto {VANTAGE_LABEL[v].toLowerCase()}
                </Link>
              </div>
              <ul className="rounded-md border border-line px-4">
                {rows.map((a) => (
                  <AttributeRow
                    key={a.code}
                    attribute={a}
                    placeName={place.name}
                    detailHref={`${base}/atribut/${encodeURIComponent(a.code)}?profil=${profile}`}
                    auditHref={`${base}/atribut/${encodeURIComponent(a.code)}/audit`}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </section>
    </div>
  );
}
