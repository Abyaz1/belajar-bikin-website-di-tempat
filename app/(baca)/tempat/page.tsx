import type { Metadata } from "next";
import Link from "next/link";
import { getPlaces } from "@/lib/ui/api/server";
import { PROFILES, VERDICTS, isProfile, type PlaceSummary, type ProfileCode } from "@/lib/ui/api/types";
import { Button, ButtonLink } from "@/lib/ui/button";
import { PROFILE_LABEL, VERDICT_LABEL } from "@/lib/ui/copy";
import { cx } from "@/lib/ui/cx";
import { PilihProfilVisual } from "@/lib/ui/pilih-profil";
import { PlaceCard } from "@/lib/ui/place-card";
import { ProfileAnnouncer } from "@/lib/ui/profile-announcer";
import { ProfilePicker } from "@/lib/ui/profile-picker";
import { LatarDoodle } from "@/lib/ui/latar-doodle";

// L2 — daftar tempat (tampilan utama). Tampilan peta tersedia di rute /peta.

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
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  return { profile, q };
}

function href(profile: ProfileCode, q: string) {
  const p = new URLSearchParams({ profil: profile });
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
  const { profile, q } = parse(await searchParams);

  if (!profile) {
    return (
      <div className="space-y-8">
        <LatarDoodle />
        <h1 className="text-screen">Daftar tempat</h1>
        <PilihProfilVisual
          hrefs={Object.fromEntries(PROFILES.map((p) => [p, href(p, q)])) as Record<ProfileCode, string>}
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
  const hrefs = Object.fromEntries(PROFILES.map((p) => [p, href(p, q)])) as Record<ProfileCode, string>;

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
      <nav aria-label="Pintasan jenis tempat">
        <ul className="flex flex-wrap gap-2">
          {JENIS.map((j) => {
            const aktif = q.toLowerCase() === j.q;
            return (
              <li key={j.label}>
                <Link
                  href={href(profile, j.q)}
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

      <div className="flex justify-end">
        <ButtonLink href={`/peta?profil=${profile}`} variant="sekunder">
          Lihat sebagai peta
        </ButtonLink>
      </div>

      <section aria-labelledby="judul-daftar" className="space-y-4">
        <h2 id="judul-daftar" className="text-section">
          {q ? `${places.length} tempat cocok dengan “${q}”` : `${places.length} tempat`}
        </h2>
        {places.length === 0 ? (
          <div className="space-y-2 rounded-md border border-line p-4">
            <p>{q ? `Tidak ada tempat yang cocok dengan “${q}”.` : "Belum ada tempat di koridor ini."}</p>
            {q ? (
              <Link href={href(profile, "")} className="inline-flex min-h-12 items-center">
                Tampilkan semua tempat
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {places.map((p, i) => (
              <PlaceCard
                key={p.id}
                place={p}
                profile={profile}
                href={`/tempat/${encodeURIComponent(p.id)}?profil=${profile}`}
                urutan={i}
              />
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
