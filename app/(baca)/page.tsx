import Link from "next/link";
import { PROFILES, isProfile } from "@/lib/ui/api/types";
import { PRODUCT_NAME } from "@/lib/ui/brand";
import { ButtonLink } from "@/lib/ui/button";
import { PROFILE_HINT, PROFILE_LABEL, PROFILE_TITLE } from "@/lib/ui/copy";
import { cx } from "@/lib/ui/cx";
import { IconCheck } from "@/lib/ui/icons";

// L1 — beranda + pemilih profil. Keadaan: belum pilih profil; profil aktif.
// Profil hidup di URL, bukan di localStorage (spek 30 §8: jangan pakai
// localStorage untuk apa pun).
export default async function Page({ searchParams }: PageProps<"/">) {
  const raw = (await searchParams).profil;
  const active = isProfile(raw) ? raw : null;

  return (
    <div className="space-y-12">
      <section className="max-w-3xl space-y-4">
        <h1 className="text-screen">Periksa kondisi fisik sebuah tempat sebelum berangkat</h1>
        <p>
          {PRODUCT_NAME} mencatat kondisi fisik pintu masuk, lift, dan toilet fasilitas publik: jumlah anak tangga, ada
          tidaknya ramp, lebar pintu, jalur pemandu. Setiap catatan membawa foto, hasil pemeriksaan keasliannya, dan
          tanggal diperiksa.
        </p>
        <p>
          Kami tidak menyimpan kata &ldquo;aksesibel&rdquo;. Penilaian dihitung saat Anda bertanya, menurut kebutuhan
          Anda — dan kalau buktinya belum ada, kami bilang belum tahu.
        </p>
      </section>

      <section aria-labelledby="pilih-profil" className="space-y-4">
        <h2 id="pilih-profil" className="text-section">
          {active ? "Profil yang dipakai" : "Pilih profil kebutuhan"}
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {PROFILES.map((p) => (
            <li
              key={p}
              className={cx(
                "card-link space-y-2 rounded-md p-4",
                p === active ? "border-[3px] border-action" : "border border-line-control",
              )}
            >
              <h3 className="flex items-center gap-2 text-card">
                {p === active ? <IconCheck /> : null}
                <Link
                  href={`/tempat?profil=${p}`}
                  aria-current={p === active ? "true" : undefined}
                  className="stretch text-ink no-underline hover:underline"
                >
                  {PROFILE_TITLE[p]}
                </Link>
              </h3>
              <p className="text-meta text-ink-muted">{PROFILE_HINT[p]}</p>
              {p === active ? <p className="text-label text-action">dipilih</p> : null}
            </li>
          ))}
        </ul>
        {active ? (
          <ButtonLink href={`/tempat?profil=${active}`}>Lihat daftar tempat untuk {PROFILE_LABEL[active]}</ButtonLink>
        ) : null}
        <p className="text-meta">
          Aturan tiap profil terbuka untuk dibaca: <Link href="/profil">aturan penilaian</Link>.
        </p>
      </section>

      <section aria-labelledby="cara-kerja" className="max-w-3xl space-y-4">
        <h2 id="cara-kerja" className="text-section">
          Cara kerjanya
        </h2>
        <ol className="list-decimal space-y-2 ps-6">
          <li>Kontributor memotret pintu masuk, lift, atau toilet lewat kamera di aplikasi ini, dari depan tempatnya.</li>
          <li>
            Server memeriksa keaslian foto — lokasi, waktu, asal berkas, foto berulang — sebelum apa pun disimpan.
            Kiriman yang tidak lolos ditolak, dan alasannya beserta angkanya tercatat terbuka.
          </li>
          <li>Kontributor mengonfirmasi sendiri apa yang terlihat. Usulan sistem hanya usulan, tidak pernah terpilih otomatis.</li>
          <li>Anda memilih profil. Fakta yang sama dinilai menurut kebutuhan Anda.</li>
        </ol>
      </section>
    </div>
  );
}
