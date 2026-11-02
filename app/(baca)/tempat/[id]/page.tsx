import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceByProfiles, getPlaceFacts } from "@/lib/ui/api/server";
import { PROFILES, isProfile, type ProfileCode } from "@/lib/ui/api/types";
import { DemoLabel } from "@/lib/ui/badges";
import { ATTRIBUTE_ORDER, PROFILE_LABEL, verdictWithProfile } from "@/lib/ui/copy";
import { LatarDoodle } from "@/lib/ui/latar-doodle";
import { ProfileAnnouncer } from "@/lib/ui/profile-announcer";
import { ProfilePicker } from "@/lib/ui/profile-picker";
import { naskahLaporan } from "../../_bacakan/naskah";
import { TombolBacakan } from "../../_bacakan/tombol-bacakan";
import { BagianKondisiFisik, BagianPenilaian, TabelTigaProfil } from "./bagian-laporan";

// L4 — laporan kesiapan. Keadaan: lengkap, sebagian, semua belum terverifikasi.

export async function generateMetadata({ params, searchParams }: PageProps<"/tempat/[id]">): Promise<Metadata> {
  const { id } = await params;
  const raw = (await searchParams).profil;
  const facts = await getPlaceFacts(id).catch(() => null);
  if (!facts) return { title: "Tempat" };
  return { title: isProfile(raw) ? `${facts.name} · ${PROFILE_LABEL[raw]}` : facts.name };
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
        <LatarDoodle />
        <h1 className="text-screen">{facts.name}</h1>
        <p>Penilaian selalu untuk profil tertentu. Pilih profil untuk melihat laporan tempat ini.</p>
        <ProfilePicker current={null} hrefs={hrefs} />
      </div>
    );
  }

  // Tiga penilaian untuk fakta yang sama: dimuat dalam satu gelombang kueri.
  const byProfile = await getPlaceByProfiles(id);
  const place = byProfile?.[profile] ?? null;
  if (!byProfile || !place) notFound();

  const attrs = [...place.attributes].sort((a, b) => orderIndex(a.code) - orderIndex(b.code));
  const checkedCount = attrs.filter((a) => a.status !== "belum_terverifikasi").length;
  const blockers = place.notes.filter((n) => n.verdict === "blocker");
  const contributeHref = `/kontribusi/${encodeURIComponent(id)}?profil=${profile}`;
  const announce = `Profil diganti. ${verdictWithProfile(place.verdict, profile)}.${blockers[0] ? ` ${blockers[0].message}` : ""}`;

  return (
    <div className="space-y-12">
      <LatarDoodle />

      <nav aria-label="Jejak halaman" className="breadcrumb text-meta">
        <Link href={`/tempat?profil=${profile}`}>Daftar tempat</Link> <span aria-hidden="true" className="panah">›</span>{" "}
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
        {place.is_demo_seed ? (
          <DemoLabel detail="sebagian riwayat tempat ini disemai untuk memperagakan penguatan, peluruhan, dan sengketa" />
        ) : null}
        <ProfilePicker current={profile} hrefs={hrefs} />
        <ProfileAnnouncer profile={profile} message={announce} />
        <TombolBacakan naskah={naskahLaporan(place, profile, ATTRIBUTE_ORDER)} />
      </header>

      <BagianPenilaian place={place} profile={profile} checkedCount={checkedCount} contributeHref={contributeHref} />

      <TabelTigaProfil byProfile={byProfile} />

      <BagianKondisiFisik
        id={id}
        placeName={place.name}
        profile={profile}
        baseHref={base}
        attrs={attrs}
        checkedCount={checkedCount}
      />
    </div>
  );
}
