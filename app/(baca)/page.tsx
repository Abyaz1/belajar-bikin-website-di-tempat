import Link from "next/link";
import { PROFILES, isProfile } from "@/lib/ui/api/types";
import { PRODUCT_NAME } from "@/lib/ui/brand";
import { ButtonLink } from "@/lib/ui/button";
import { PROFILE_HINT, PROFILE_LABEL, PROFILE_TITLE } from "@/lib/ui/copy";
import { cx } from "@/lib/ui/cx";
import { IconCheck, PROFILE_ICON } from "@/lib/ui/icons";

// L1 — beranda + pemilih profil. Keadaan: belum pilih profil; profil aktif.
// Profil hidup di URL, bukan di localStorage (spek 30 §8: jangan pakai
// localStorage untuk apa pun).

const LANGKAH: { judul: string; isi: string }[] = [
  {
    judul: "Foto diambil di tempat",
    isi: "Kontributor memotret pintu masuk, lift, atau toilet lewat kamera di aplikasi ini, dari depan tempatnya.",
  },
  {
    judul: "Keaslian foto diperiksa",
    isi: "Server memeriksa lokasi, waktu, asal berkas, dan foto berulang sebelum apa pun disimpan. Kiriman yang tidak lolos ditolak, dan alasannya beserta angkanya tercatat terbuka.",
  },
  {
    judul: "Manusia yang mengonfirmasi",
    isi: "Kontributor memilih sendiri apa yang terlihat di foto. Usulan sistem hanya usulan dan tidak pernah terpilih otomatis.",
  },
  {
    judul: "Dinilai menurut kebutuhan Anda",
    isi: "Anda memilih profil. Fakta yang sama dinilai menurut aturan profil itu.",
  },
];

export default async function Page({ searchParams }: PageProps<"/">) {
  const raw = (await searchParams).profil;
  const active = isProfile(raw) ? raw : null;

  return (
    <div className="space-y-16">
      <section className="max-w-3xl space-y-6 pt-4">
        <p className="text-label uppercase tracking-wide text-action">Sebelum berangkat</p>
        <h1 className="text-[2.25rem] leading-tight font-bold text-brand md:text-[2.75rem]">
          Periksa kondisi fisik sebuah tempat sebelum berangkat
        </h1>
        <p className="text-card font-normal text-ink">
          {PRODUCT_NAME} mencatat kondisi fisik pintu masuk, lift, dan toilet fasilitas publik: jumlah anak tangga, ada
          tidaknya ramp, lebar pintu, jalur pemandu. Setiap catatan membawa foto, hasil pemeriksaan keasliannya, dan
          tanggal diperiksa.
        </p>
        <p className="border-s-4 border-accent ps-4 text-ink-muted">
          Kami tidak menyimpan kata &ldquo;aksesibel&rdquo;. Penilaian dihitung saat Anda bertanya, menurut kebutuhan
          Anda. Kalau buktinya belum ada, kami tulis belum tahu.
        </p>
      </section>

      <section aria-labelledby="pilih-profil" className="space-y-6">
        <div className="space-y-2">
          <h2 id="pilih-profil" className="text-section text-brand">
            {active ? "Profil yang dipakai" : "Langkah 1: pilih profil kebutuhan"}
          </h2>
          <p className="text-ink-muted">Penilaian tempat berbeda untuk tiap profil. Pilih yang paling sesuai.</p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {PROFILES.map((p) => {
            const Icon = PROFILE_ICON[p];
            const selected = p === active;
            return (
              <li
                key={p}
                className={cx(
                  "card-link flex flex-col gap-4 rounded-md bg-surface p-6",
                  selected ? "border-[3px] border-action" : "border border-line-control",
                )}
              >
                <span className="text-brand">
                  <Icon />
                </span>
                <h3 className="flex items-center gap-2 text-card">
                  {selected ? <IconCheck /> : null}
                  <Link
                    href={`/tempat?profil=${p}`}
                    aria-current={selected ? "true" : undefined}
                    className="stretch text-ink no-underline hover:underline"
                  >
                    {PROFILE_TITLE[p]}
                  </Link>
                </h3>
                <p className="text-meta text-ink-muted">{PROFILE_HINT[p]}</p>
                <p className="mt-auto text-label text-action">{selected ? "dipilih" : <>Lihat daftar tempat <span aria-hidden="true">→</span></>}</p>
              </li>
            );
          })}
        </ul>
        {active ? (
          <ButtonLink href={`/tempat?profil=${active}`}>Lihat daftar tempat untuk {PROFILE_LABEL[active]}</ButtonLink>
        ) : null}
        <p className="text-meta">
          Aturan tiap profil terbuka untuk dibaca: <Link href="/profil">aturan penilaian</Link>.
        </p>
      </section>

      <section aria-labelledby="cara-kerja" className="space-y-6 rounded-md border border-line bg-surface p-6 md:p-8">
        <h2 id="cara-kerja" className="text-section text-brand">
          Cara kerjanya
        </h2>
        <ol className="grid gap-6 md:grid-cols-2">
          {LANGKAH.map((l, i) => (
            <li key={l.judul} className="flex gap-4">
              <span
                aria-hidden="true"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-brand font-bold text-on-brand"
              >
                {i + 1}
              </span>
              <div className="space-y-1">
                <h3 className="text-card">{l.judul}</h3>
                <p className="text-meta text-ink-muted">{l.isi}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
