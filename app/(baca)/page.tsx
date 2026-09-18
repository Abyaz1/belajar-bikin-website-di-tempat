import { cookies } from "next/headers";
import Link from "next/link";
import { getPlaces } from "@/lib/ui/api/server";
import { PROFILES, VERDICTS, isProfile, type PlaceSummary, type ProfileCode } from "@/lib/ui/api/types";
import { COOKIE_PANDUAN } from "@/lib/ui/cara-kerja";
import { PROFILE_LABEL, PROFILE_TITLE, VERDICT_LABEL, verdictWithProfile } from "@/lib/ui/copy";
import { cx } from "@/lib/ui/cx";
import { VERDICT_ICON } from "@/lib/ui/icons";
import { ILUSTRASI_PROFIL } from "@/lib/ui/ilustrasi";
import { MapView } from "@/lib/ui/map-view";
import { PanduanAwal } from "@/lib/ui/panduan-awal";

// L1 beranda: peta layar penuh dengan kepala halaman mengambang di atasnya.
// Kunjungan pertama membuka panduan tiga langkah (cara kerja dan pilih
// profil); sesudahnya layar hanya berisi peta dan kendalinya.
//
// Peta bukan satu-satunya jalan: tab "Daftar tempat" dan tombol "Daftar" di
// panel bawah membuka daftar yang setara untuk profil yang sama (A4).

/** Nama profil di layar sempit, supaya tiga tombol muat dalam satu baris. */
const PENDEK: Record<ProfileCode, string> = {
  kursi_roda_manual: "Kursi roda",
  alat_bantu_jalan: "Alat bantu",
  netra: "Netra",
};

export default async function Page({ searchParams }: PageProps<"/">) {
  const raw = (await searchParams).profil;
  const dipilih = isProfile(raw) ? raw : null;
  // Tanpa profil di URL, peta tetap dinilai untuk profil pertama, dan panel
  // bawah menyebutnya dengan jelas supaya tidak terbaca sebagai penilaian mutlak.
  const profile = dipilih ?? PROFILES[0];
  const sudahPanduan = (await cookies()).get(COOKIE_PANDUAN)?.value === "1";

  let places: PlaceSummary[] = [];
  let gagal = false;
  try {
    places = await getPlaces(profile);
  } catch {
    gagal = true;
  }

  return (
    <>
      <h1 className="sr-only">Peta tempat, dinilai untuk profil {PROFILE_LABEL[profile]}</h1>

      <div className="fixed inset-0 z-0 bg-p4">
        <MapView
          penuh
          label={`Peta ${places.length} tempat, dinilai untuk ${PROFILE_LABEL[profile]}. Tempat yang sama tersedia di tab Daftar tempat.`}
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
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[1100] px-3 pb-3 md:px-6 md:pb-6">
        <div className="mx-auto max-w-4xl space-y-2">
          {gagal ? (
            <p role="status" className="rounded-md border-2 border-tidak-line bg-surface px-4 py-2 text-meta">
              Data tempat tidak dapat dimuat. Peta tetap bisa digeser; coba muat ulang halaman.
            </p>
          ) : null}

          <details className="group w-fit rounded-lg border border-line bg-surface">
            <summary className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg px-4 font-semibold">
              Keterangan penanda
            </summary>
            <ul className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
              {VERDICTS.map((v) => {
                const Icon = VERDICT_ICON[v];
                return (
                  <li key={v} className="flex items-center gap-2 text-meta">
                    <Icon />
                    {VERDICT_LABEL[v]}
                  </li>
                );
              })}
            </ul>
          </details>

          <nav
            aria-label="Profil kebutuhan"
            className="flex items-stretch gap-2 rounded-lg border border-line bg-surface p-2"
          >
            <ul className="grid flex-1 grid-cols-3 gap-2">
              {PROFILES.map((p) => {
                const Ilustrasi = ILUSTRASI_PROFIL[p];
                const aktif = p === profile;
                return (
                  <li key={p}>
                    <Link
                      href={`/?profil=${p}`}
                      scroll={false}
                      aria-current={aktif ? "true" : undefined}
                      className={cx(
                        "flex h-full min-h-12 items-center gap-3 rounded-md p-2 pe-3 font-semibold no-underline",
                        aktif ? "bg-action text-on-brand" : "text-ink hover:bg-surface-alt",
                      )}
                    >
                      <Ilustrasi className="hidden h-12 w-16 shrink-0 rounded-sm sm:block" />
                      <span className="leading-tight">
                        <span className="sm:hidden">{PENDEK[p]}</span>
                        <span className="hidden sm:inline">{PROFILE_TITLE[p]}</span>
                      </span>
                      {aktif ? <span className="sr-only"> (dipilih)</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/tempat?profil=${profile}`}
              className="inline-flex min-h-12 shrink-0 items-center rounded-md border-2 border-action px-4 font-semibold text-ink no-underline hover:bg-surface-alt"
            >
              Daftar
            </Link>
          </nav>
        </div>
      </div>

      <PanduanAwal terbuka={!sudahPanduan} profilAktif={profile} />
    </>
  );
}
