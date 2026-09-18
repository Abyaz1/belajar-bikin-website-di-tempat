import type { Metadata } from "next";
import Link from "next/link";
import { getPlaces } from "@/lib/ui/api/server";
import { PROFILES, VERDICTS, isProfile, type PlaceSummary, type ProfileCode } from "@/lib/ui/api/types";
import { MAP_ENABLED } from "@/lib/ui/brand";
import { Button, ButtonLink } from "@/lib/ui/button";
import { PROFILE_LABEL, VERDICT_LABEL, verdictWithProfile } from "@/lib/ui/copy";
import { cx } from "@/lib/ui/cx";
import { MapView } from "@/lib/ui/map-view";
import { PilihProfilVisual } from "@/lib/ui/pilih-profil";
import { PlaceCard } from "@/lib/ui/place-card";
import { ProfileAnnouncer } from "@/lib/ui/profile-announcer";
import { ProfilePicker } from "@/lib/ui/profile-picker";
import { LatarDoodle } from "@/lib/ui/latar-doodle";

// L2 daftar (tampilan utama) dan L3 peta (sekunder), satu rute.
// Kenapa daftar yang utama: (1) peta bukan antarmuka yang bisa dibaca screen
// reader, dan (2) yang dicari orang adalah "bisakah saya masuk ke tempat X",
// bukan "apa yang ada di sekitar titik ini".

/** Pintasan kategori. Nilai `q` sama dengan kategori hasil penyemaian OSM. */
const JENIS: { label: string; q: string }[] = [
  { label: "Semua", q: "" },
  { label: "Kampus", q: "kampus" },
  { label: "Halte", q: "halte" },
  { label: "Fasilitas kesehatan", q: "fasilitas kesehatan" },
];

type Search = Awaited<PageProps<"/tempat">["searchParams"]>;

function parse(sp: Search) {
  const profile = isProfile(sp.profil) ? sp.profil : null;
  const view: "daftar" | "peta" = sp.tampilan === "peta" && MAP_ENABLED ? "peta" : "daftar";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  return { profile, view, q };
}

function href(profile: ProfileCode, view: "daftar" | "peta", q: string) {
  const p = new URLSearchParams({ profil: profile });
  if (view === "peta") p.set("tampilan", "peta");
  if (q) p.set("q", q);
  return `/tempat?${p}`;
}

export async function generateMetadata({ searchParams }: PageProps<"/tempat">): Promise<Metadata> {
  const { profile } = parse(await searchParams);
  return { title: profile ? `Daftar tempat · ${PROFILE_LABEL[profile]}` : "Daftar tempat" };
}

function summarize(places: PlaceSummary[], profile: ProfileCode): string {
  const parts = VERDICTS.map((v) => {
    const n = places.filter((p) => p.verdict === v).length;
    return n > 0 ? `${n} ${VERDICT_LABEL[v].toLowerCase()}` : null;
  }).filter(Boolean);
  return `Menilai ${places.length} tempat untuk profil ${PROFILE_LABEL[profile]}: ${parts.join(", ")}.`;
}

export default async function Page({ searchParams }: PageProps<"/tempat">) {
  const { profile, view, q } = parse(await searchParams);

  if (!profile) {
    return (
      <div className="space-y-8">
        <LatarDoodle />
        <h1 className="text-screen">Daftar tempat</h1>
        <PilihProfilVisual
          hrefs={Object.fromEntries(PROFILES.map((p) => [p, href(p, "daftar", q)])) as Record<ProfileCode, string>}
        />
      </div>
    );
  }

  const all = await getPlaces(profile);
  const needle = q.toLowerCase();
  const places = needle
    ? all.filter((p) => `${p.name} ${p.category ?? ""}`.toLowerCase().includes(needle))
    : all;
  const summary = summarize(all, profile);
  const hrefs = Object.fromEntries(PROFILES.map((p) => [p, href(p, view, q)])) as Record<ProfileCode, string>;

  return (
    <div className="space-y-8">
      <LatarDoodle />
      <div className="space-y-4">
        <h1 className="text-screen">Daftar tempat</h1>
        <ProfilePicker current={profile} hrefs={hrefs} />
        <ProfileAnnouncer profile={profile} message={`Penilaian diperbarui. ${summary}`} />
        <p>{summary}</p>
        {all.length > 0 && all.every((p) => p.verdict === "belum_dapat_dipastikan") ? (
          <p className="text-meta text-ink-muted">
            Sebagian besar tempat baru punya lokasi dari OpenStreetMap, tanpa satu pun bukti kondisi fisik. Itu masalah
            yang sedang kami kerjakan, dan kami tidak menutupinya dengan tebakan.
          </p>
        ) : null}
      </div>

      <form method="get" action="/tempat" role="search" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="profil" value={profile} />
        {view === "peta" ? <input type="hidden" name="tampilan" value="peta" /> : null}
        <div className="min-w-0 flex-1 basis-64">
          <label htmlFor="cari" className="block font-semibold">
            Cari nama atau jenis tempat
          </label>
          <input
            id="cari"
            name="q"
            type="search"
            defaultValue={q}
            className="mt-1 block min-h-12 w-full rounded-md border-2 border-line-control px-3"
          />
        </div>
        <Button type="submit" variant="sekunder">
          Cari
        </Button>
      </form>

      {/* Pintasan pencarian per jenis tempat: satu ketukan, tanpa mengetik.
          Hanya tautan ke ?q=, tidak ada yang disimpan di peramban. */}
      <nav aria-label="Pintasan jenis tempat" className="space-y-2">
        <p className="text-meta font-semibold">Tampilkan jenis tempat:</p>
        <ul className="flex flex-wrap gap-2">
          {JENIS.map((j) => {
            const aktif = q.toLowerCase() === j.q;
            return (
              <li key={j.label}>
                <Link
                  href={href(profile, view, j.q)}
                  aria-current={aktif ? "true" : undefined}
                  scroll={false}
                  className={cx(
                    "inline-flex min-h-12 items-center rounded-pill border-2 px-5 font-semibold no-underline",
                    aktif
                      ? "border-brand bg-brand text-on-brand"
                      : "border-line-control bg-surface text-ink hover:border-brand hover:bg-surface-alt",
                  )}
                >
                  {j.label}
                  {aktif ? <span className="sr-only"> (dipilih)</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {MAP_ENABLED ? (
        <nav aria-label="Tampilan" className="flex flex-wrap gap-2">
          {(["daftar", "peta"] as const).map((v) => (
            <Link
              key={v}
              href={href(profile, v, q)}
              aria-current={view === v ? "page" : undefined}
              className={cx(
                "inline-flex min-h-12 items-center rounded-md border-2 px-4 font-semibold no-underline",
                view === v ? "border-brand bg-brand text-on-brand" : "border-line-control bg-surface text-ink hover:bg-surface-alt",
              )}
            >
              {v === "daftar" ? "Daftar" : "Peta"}
            </Link>
          ))}
        </nav>
      ) : null}

      {view === "peta" ? (
        <section aria-labelledby="judul-peta" className="space-y-3">
          <h2 id="judul-peta" className="text-section">
            Peta
          </h2>
          {/* Elemen pertama yang bisa difokus di peta. */}
          <ButtonLink href={href(profile, "daftar", q)} variant="sekunder">
            Lihat sebagai daftar
          </ButtonLink>
          <MapView
            label={`Peta ${places.length} tempat. Tempat yang sama tersedia sebagai daftar di bawah peta.`}
            places={places.map((p) => ({
              id: p.id,
              name: p.name,
              lat: p.lat,
              lon: p.lon,
              verdict: p.verdict,
              verdictText: verdictWithProfile(p.verdict, profile),
              href: `/tempat/${encodeURIComponent(p.id)}?profil=${profile}`,
            }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="judul-daftar" className="space-y-4">
        <h2 id="judul-daftar" className="text-section">
          {q ? `${places.length} tempat cocok dengan “${q}”` : `${places.length} tempat`}
        </h2>
        {places.length === 0 ? (
          <div className="space-y-2 rounded-md border border-line p-4">
            <p>{q ? `Tidak ada tempat yang cocok dengan “${q}”.` : "Belum ada tempat di koridor ini."}</p>
            {q ? <Link href={href(profile, view, "")}>Tampilkan semua tempat</Link> : null}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} profile={profile} href={`/tempat/${encodeURIComponent(p.id)}?profil=${profile}`} />
            ))}
          </ul>
        )}
        <p className="text-meta text-ink-muted">
          Lokasi dari <a href="https://www.openstreetmap.org/copyright">© kontributor OpenStreetMap</a>, lisensi ODbL.
        </p>
      </section>
    </div>
  );
}
