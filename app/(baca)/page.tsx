import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getPlace, getPlaces } from "@/lib/ui/api/server";
import { PROFILES, isProfile, type PlaceDetail, type PlaceSummary } from "@/lib/ui/api/types";
import { VerdictBadge } from "@/lib/ui/badges";
import { COOKIE_PANDUAN } from "@/lib/ui/cara-kerja";
import { PROFILE_TITLE, valueSentence, verdictWithProfile } from "@/lib/ui/copy";
import { IconSearch } from "@/lib/ui/icons";
import { IlustrasiKursiRoda } from "@/lib/ui/ilustrasi";
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

/**
 * Tempat unggulan: kampus UNPAD Dipatiukur, tempat hackathon ini berlangsung.
 * Kalau tidak ada di data, tempat yang paling banyak kondisi fisiknya diperiksa.
 */
const POLA_UNPAD = [/^universitas pad[j]?ad?jaran/i, /unpad|pad[j]?ad?jaran/i];

function pilihUnggulan(places: PlaceSummary[]): PlaceSummary | null {
  for (const pola of POLA_UNPAD) {
    const kampus = places.find((p) => p.category === "kampus" && pola.test(p.name.replace(/^\[Contoh\]\s*/, "")));
    if (kampus) return kampus;
  }
  const diperiksa = (p: PlaceSummary) => (p.status_counts?.terverifikasi ?? 0) + (p.status_counts?.perlu_ditinjau_ulang ?? 0);
  return [...places].sort((a, b) => diperiksa(b) - diperiksa(a))[0] ?? null;
}

function adalahUnpad(nama: string): boolean {
  return POLA_UNPAD[1].test(nama);
}

/**
 * Foto ilustrasi kampus UNPAD Dipatiukur dari Wikimedia Commons. BUKAN foto
 * bukti: tidak melewati pemeriksaan keaslian, jadi selalu dilabeli ilustrasi
 * dan diberi atribusi sesuai lisensinya.
 */
const FOTO_UNPAD = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Unpad_Dipati_Ukur_Main_Campus.jpg/1280px-Unpad_Dipati_Ukur_Main_Campus.jpg",
  alt: "Gedung kampus Universitas Padjadjaran di Jalan Dipati Ukur, Bandung",
  diambil: "24 Februari 2017",
  penulis: "Medelam",
  sumber: "https://commons.wikimedia.org/wiki/File:Unpad_Dipati_Ukur_Main_Campus.jpg",
  lisensi: "CC BY-SA 4.0",
  lisensiUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

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

  const nilai = (code: string) => unggulan?.attributes.find((a) => a.code === code)?.current_value ?? null;
  const foto = unggulan?.attributes.find((a) => a.photo_url);
  const unpad = unggulan ? adalahUnpad(unggulan.name) : false;

  return (
    <>
    <div className="space-y-16 md:space-y-24">
      {/* ── Hero di atas peta pudar ── */}
      {/* Hero setinggi sisa layar; petanya membentang selebar layar (bukan
          selebar kolom isi) dan memudar di tepi atas dan bawah. */}
      <section className="relative isolate flex min-h-[calc(100dvh-8rem)] flex-col">
        <div className="relative z-10 mx-auto max-w-3xl space-y-4 px-2 pt-2 text-center md:space-y-6 md:px-4 md:pt-10">

          <h1 style={{ "--i": 0 } as CSSProperties} className="masuk text-hero text-ink">
            Periksa kondisi tempat sebelum berangkat
          </h1>

          <p style={{ "--i": 1 } as CSSProperties} className="masuk mx-auto max-w-xl text-body text-ink-muted md:text-card md:font-normal">
            Anak tangga, ramp, lebar pintu, dan jalur pemandu, masing-masing dengan foto, tanggal foto diambil, dan hasil
            pemeriksaan keasliannya. Dimulai dari koridor kampus UNPAD Dipatiukur, Bandung.
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
            style={{ "--i": 2 } as CSSProperties}
            className="masuk relative z-10 mx-auto grid w-full max-w-2xl grid-cols-2 items-center gap-1 rounded-lg border border-line bg-surface p-2 text-start sm:grid-cols-[1fr_1fr_1fr_auto] sm:gap-0"
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
                {unpad ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={FOTO_UNPAD.src} alt={FOTO_UNPAD.alt} decoding="async" className="h-full w-full object-cover" />
                ) : foto?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.photo_url} alt={foto.photo_alt ?? ""} decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-muted">
                    <IlustrasiKursiRoda className="h-2/3 w-auto" />
                    <span className="text-label font-normal">Foto tempat belum ada</span>
                  </div>
                )}
                {unggulan.is_demo_seed ? (
                  <span className="absolute end-2 top-2 rounded-sm bg-demo-bg px-2 py-1 text-label text-demo-ink">Demo</span>
                ) : null}
                {unpad ? (
                  <span className="absolute start-2 top-2 rounded-sm bg-surface px-2 py-1 text-label text-ink">
                    Foto ilustrasi
                  </span>
                ) : null}
              </div>
              {unpad ? (
                <p className="relative z-10 px-3 pt-2 text-start text-label font-normal text-ink-muted">
                  Diambil {FOTO_UNPAD.diambil}. Foto:{" "}
                  <a href={FOTO_UNPAD.sumber}>{FOTO_UNPAD.penulis}, Wikimedia Commons</a>,{" "}
                  <a href={FOTO_UNPAD.lisensiUrl}>{FOTO_UNPAD.lisensi}</a>. Bukan foto bukti pemeriksaan.
                </p>
              ) : null}
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
                  Lihat laporan <span aria-hidden="true" className="panah">›</span>
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

      {/* Bagian bawah dibuat ringkas: tiga poin dan satu tautan ke Cara kerja. */}
      <section aria-labelledby="kenapa" className="space-y-8 pb-8">
        <h2 id="kenapa" className="text-display text-ink">
          Fakta berbukti di balik setiap penilaian
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            { judul: "Dipilih manusia", isi: "Model hanya mengusulkan nilai dari foto. Kontributor yang memilih." },
            { judul: "Ditolak dengan angka", isi: "Sembilan pemeriksaan keaslian tiap foto. Yang gagal disertai nilai terukurnya." },
            { judul: "Dinilai sesuai kebutuhan", isi: "Fakta yang sama dinilai berbeda untuk tiap profil kebutuhan." },
          ].map((p) => (
            <li key={p.judul} className="space-y-2 rounded-lg bg-surface p-5">
              <h3 className="text-card">{p.judul}</h3>
              <p className="text-meta text-ink-muted">{p.isi}</p>
            </li>
          ))}
        </ul>
        <Link
          href="/cara-kerja"
          className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-action px-6 font-semibold text-on-brand no-underline hover:opacity-90"
        >
          Lihat cara kerja <span aria-hidden="true" className="panah">›</span>
        </Link>
      </section>
    </div>

    {/* Di luar wadah berjarak: dialog tertutup tetap dihitung sebagai saudara
        oleh space-y dan akan menambah celah di atas kaki halaman. */}
    <PanduanAwal terbuka={!sudahPanduan} profilAktif={profile} />
    </>
  );
}
