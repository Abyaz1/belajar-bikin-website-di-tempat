import { cookies } from "next/headers";
import Link from "next/link";
import { getPlace, getPlaces } from "@/lib/ui/api/server";
import { PROFILES, isProfile, type PlaceDetail, type PlaceSummary } from "@/lib/ui/api/types";
import { VerdictBadge } from "@/lib/ui/badges";
import { COOKIE_PANDUAN } from "@/lib/ui/cara-kerja";
import { PROFILE_TITLE, valueSentence, verdictWithProfile } from "@/lib/ui/copy";
import { IconSearch, IconShield } from "@/lib/ui/icons";
import { ILUSTRASI_PROFIL, IlustrasiKursiRoda } from "@/lib/ui/ilustrasi";
import { MapView } from "@/lib/ui/map-view";
import { PanduanAwal } from "@/lib/ui/panduan-awal";

// L1 beranda. Hero berteks di atas peta pudar, kolom pencarian yang langsung
// membuka daftar tempat, satu tempat unggulan di tengah peta, lalu angka
// koridor dan alasan memakai Astara. Kunjungan pertama membuka panduan.

const JENIS = [
  { value: "", label: "Semua jenis" },
  { value: "kampus", label: "Kampus" },
  { value: "halte", label: "Halte" },
  { value: "fasilitas kesehatan", label: "Fasilitas kesehatan" },
];

/** Tempat unggulan: yang paling banyak kondisi fisiknya sudah diperiksa. */
function pilihUnggulan(places: PlaceSummary[]): PlaceSummary | null {
  const diperiksa = (p: PlaceSummary) => (p.status_counts?.terverifikasi ?? 0) + (p.status_counts?.perlu_ditinjau_ulang ?? 0);
  return [...places].sort((a, b) => diperiksa(b) - diperiksa(a))[0] ?? null;
}

const FIELD = "pilih block w-full min-h-12 appearance-none bg-transparent text-meta font-semibold text-ink sm:text-body";

export default async function Page({ searchParams }: PageProps<"/">) {
  const raw = (await searchParams).profil;
  const profile = isProfile(raw) ? raw : PROFILES[0];
  const sudahPanduan = (await cookies()).get(COOKIE_PANDUAN)?.value === "1";

  let places: PlaceSummary[] = [];
  try {
    places = await getPlaces(profile);
  } catch {
    places = [];
  }
  const ringkas = pilihUnggulan(places);
  let unggulan: PlaceDetail | null = null;
  if (ringkas) {
    try {
      unggulan = await getPlace(ringkas.id, profile);
    } catch {
      unggulan = null;
    }
  }

  const terverifikasi = places.reduce((n, p) => n + (p.status_counts?.terverifikasi ?? 0), 0);
  const nilai = (code: string) => unggulan?.attributes.find((a) => a.code === code)?.current_value ?? null;
  const foto = unggulan?.attributes.find((a) => a.photo_url);

  return (
    <div className="space-y-16 md:space-y-24">
      {/* ── Hero di atas peta pudar ── */}
      {/* Hero setinggi sisa layar; petanya membentang selebar layar (bukan
          selebar kolom isi) dan memudar di tepi atas dan bawah. */}
      <section className="relative isolate flex min-h-[calc(100dvh-8rem)] flex-col">
        <div className="relative z-10 mx-auto max-w-3xl space-y-4 px-2 pt-2 text-center md:space-y-6 md:px-4 md:pt-10">
          <Link
            href="/cara-kerja"
            className="inline-flex min-h-12 items-center gap-2 rounded-pill border border-line bg-surface px-3 text-meta font-semibold text-ink no-underline hover:bg-surface-alt"
          >
            <span aria-hidden="true" className="size-3 rounded-pill bg-tidak-line" />
            Apa itu Astara?
          </Link>

          <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight text-ink sm:text-[2.5rem] md:text-[3.5rem]">
            Periksa kondisi tempat{" "}
            <span className="inline-block h-[0.95em] w-[1.6em] translate-y-[0.12em] overflow-hidden rounded-pill align-baseline">
              <IlustrasiKursiRoda className="h-full w-full" />
            </span>{" "}
            sebelum berangkat
          </h1>

          <p className="mx-auto max-w-xl text-body text-ink-muted md:text-card md:font-normal">
            Anak tangga, ramp, lebar pintu, dan jalur pemandu, masing-masing dengan foto, tanggal foto diambil, dan hasil
            pemeriksaan keasliannya.
          </p>
        </div>

        {/* Peta berlabuh di formulir: mulai di belakang judul (memudar ke atas
            supaya teks tetap terbaca) dan memanjang sampai akhir hero, di
            ukuran layar apa pun. */}
        <div className="relative mt-6 flex flex-1 flex-col md:mt-8">
          <div className="absolute bottom-0 left-1/2 -top-52 -z-10 w-screen -translate-x-1/2 md:-top-64 [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_88%,transparent)]">
            <MapView
              latar
              label=""
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

          <form
            method="get"
            action="/tempat"
            role="search"
            aria-label="Cari tempat"
            className="relative z-10 mx-auto grid w-full max-w-2xl grid-cols-2 items-center gap-1 rounded-lg border border-line bg-surface p-2 text-start sm:grid-cols-[1fr_1fr_1fr_auto] sm:gap-0"
          >
            <label className="block rounded-md px-2 py-1 hover:bg-surface-alt sm:px-3 sm:border-e sm:border-line">
              <span className="block text-label font-normal text-ink-muted">Profil kebutuhan</span>
              <select name="profil" defaultValue={profile} className={FIELD}>
                {PROFILES.map((p) => (
                  <option key={p} value={p}>
                    {PROFILE_TITLE[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block rounded-md px-2 py-1 hover:bg-surface-alt sm:px-3 sm:border-e sm:border-line">
              <span className="block text-label font-normal text-ink-muted">Jenis tempat</span>
              <select name="q" defaultValue="" className={FIELD}>
                {JENIS.map((j) => (
                  <option key={j.label} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block rounded-md px-2 py-1 hover:bg-surface-alt sm:px-3">
              <span className="block text-label font-normal text-ink-muted">Tampilan</span>
              <select name="tampilan" defaultValue="daftar" className={FIELD}>
                <option value="daftar">Daftar</option>
                <option value="peta">Peta</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 self-center rounded-pill bg-action px-4 font-semibold text-on-brand hover:opacity-90 sm:ms-2 sm:size-12 sm:px-0"
            >
              <IconSearch />
              <span className="sm:sr-only">Cari</span>
            </button>
          </form>

        {/* Tempat unggulan melayang di atas peta */}
        <div className="relative z-10 mx-auto mt-10 w-[min(19rem,calc(100%-2rem))] pb-16 md:mt-16">
          {unggulan ? (
            <article className="card-link overflow-hidden rounded-lg border border-line bg-surface p-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-p4">
                {foto?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.photo_url} alt={foto.photo_alt ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-muted">
                    <IlustrasiKursiRoda className="h-2/3 w-auto" />
                    <span className="text-label font-normal">Foto tempat belum ada</span>
                  </div>
                )}
                {unggulan.is_demo_seed ? (
                  <span className="absolute end-2 top-2 rounded-sm bg-demo-bg px-2 py-1 text-label text-demo-ink">Demo</span>
                ) : null}
              </div>
              <div className="space-y-3 p-3 text-start">
                <div>
                  <h2 className="text-card">
                    <Link
                      href={`/tempat/${encodeURIComponent(unggulan.id)}?profil=${profile}`}
                      className="stretch text-ink no-underline hover:underline"
                    >
                      {unggulan.name}
                    </Link>
                  </h2>
                  <p className="text-label font-normal text-ink-muted">
                    {[unggulan.category, unggulan.address].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ul className="space-y-1 border-y border-line py-2 text-label font-normal text-ink-muted">
                  {["step_count", "ramp_wheelchair", "door_width_band"].map((c) => (
                    <li key={c}>{valueSentence(c, nilai(c))}</li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2">
                  <VerdictBadge verdict={unggulan.verdict} profile={profile} />
                </div>
                <p className="text-label text-ink">
                  Lihat laporan <span aria-hidden="true">›</span>
                </p>
              </div>
            </article>
          ) : (
            <div className="rounded-lg border border-line bg-surface p-6 text-center text-meta text-ink-muted">
              Data tempat belum dapat dimuat.
            </div>
          )}
          <p className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-pill bg-action py-1 ps-1 pe-4 text-label text-on-brand">
            <span className="inline-flex size-10 items-center justify-center rounded-pill bg-surface text-card font-bold text-ink">
              {places.length}
            </span>
            tempat di koridor ini
          </p>
          <p className="mt-4 text-center text-label font-normal text-ink-muted">
            Peta: <a href="https://www.openstreetmap.org/copyright">© kontributor OpenStreetMap</a>, ODbL
          </p>
        </div>
        </div>
      </section>

      {/* ── Angka koridor ── */}
      <section aria-label="Angka koridor" className="grid grid-cols-2 gap-y-8 border-y border-line py-10 md:grid-cols-4">
        {[
          { angka: String(places.length), label: "Tempat di koridor Dipatiukur" },
          { angka: String(terverifikasi), label: "Kondisi fisik terverifikasi" },
          { angka: "9", label: "Pemeriksaan keaslian tiap foto" },
          { angka: "3", label: "Profil kebutuhan" },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-center gap-3">
            <span className="text-[2.5rem] leading-none font-bold text-ink">{s.angka}</span>
            <span className="max-w-[8rem] text-label font-normal text-ink-muted uppercase">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── Kenapa Astara ── */}
      <section aria-labelledby="kenapa" className="grid gap-10 md:grid-cols-[2fr_3fr] md:gap-12">
        <div className="flex flex-col gap-6">
          <p className="flex items-center gap-2 text-label text-ink">
            <span aria-hidden="true" className="size-2 rounded-pill bg-tidak-line" />
            Kenapa Astara
          </p>
          <h2 id="kenapa" className="text-[2rem] leading-tight font-bold text-ink md:text-[2.5rem]">
            Fakta berbukti di balik setiap penilaian
          </h2>
          <div className="mt-auto space-y-6">
            <p className="text-ink-muted">
              Kami tidak menyimpan kata &ldquo;aksesibel&rdquo;. Yang disimpan adalah kondisi fisik yang terlihat di foto,
              diperiksa keasliannya, dan dikonfirmasi manusia. Penilaiannya dihitung menurut kebutuhan Anda.
            </p>
            <Link
              href="/cara-kerja"
              className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-action px-6 font-semibold text-on-brand no-underline hover:opacity-90"
            >
              Lihat cara kerja <span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-lg bg-surface p-5">
            <div className="space-y-2 rounded-md bg-p5 p-3" aria-hidden="true">
              <p className="rounded-pill border border-line bg-surface px-3 py-2 text-label font-normal text-ink-muted">
                Anak tangga di pintu masuk
              </p>
              <p className="w-fit rounded-pill bg-accent px-3 py-1 text-label text-ink">Usulan sistem: 2 anak tangga</p>
            </div>
            <h3 className="text-card">Usulan dibantu AI, dipilih manusia</h3>
            <p className="text-meta text-ink-muted">
              Model mengusulkan nilai dari foto. Kontributor tetap memilih sendiri, dan usulan tidak pernah terpilih otomatis.
            </p>
          </article>

          <article className="flex flex-col gap-4 rounded-lg bg-surface p-5">
            <span className="inline-flex size-12 items-center justify-center rounded-md bg-action text-on-brand">
              <IconShield />
            </span>
            <h3 className="text-card">Penolakan disertai angka</h3>
            <p className="text-meta text-ink-muted">
              Sembilan pemeriksaan keaslian tiap foto. Yang tidak lolos ditolak beserta nilai terukurnya, misalnya jarak 214
              meter dengan batas 120 meter.
            </p>
          </article>

          <article className="grid gap-4 overflow-hidden rounded-lg bg-surface p-5 sm:col-span-2 sm:grid-cols-2">
            <div className="flex flex-col justify-end gap-2">
              <h3 className="text-card">Dinilai sesuai kebutuhan Anda</h3>
              <p className="text-meta text-ink-muted">
                Fakta yang sama dinilai berbeda untuk kursi roda manual, alat bantu jalan, dan netra.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="relative min-h-52 rounded-md [background-image:radial-gradient(var(--color-p2)_1.2px,transparent_1.2px)] [background-size:12px_12px]"
            >
              {PROFILES.map((p, i) => {
                const Ilustrasi = ILUSTRASI_PROFIL[p];
                return (
                  <div
                    key={p}
                    className="absolute w-28 rounded-md border border-line bg-surface p-1"
                    style={{ right: `${8 + i * 20}%`, top: `${6 + i * 10}%` }}
                  >
                    <Ilustrasi className="w-full rounded-sm" />
                    <p className="px-1 pt-1 text-label">{PROFILE_TITLE[p]}</p>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      <PanduanAwal terbuka={!sudahPanduan} profilAktif={profile} />
    </div>
  );
}
