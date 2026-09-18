import type { Metadata } from "next";
import Link from "next/link";
import { LANGKAH_CARA_KERJA } from "@/lib/ui/cara-kerja";
import { LatarDoodle } from "@/lib/ui/latar-doodle";

export const metadata: Metadata = { title: "Cara kerja" };

// Tab Cara kerja: isi yang sama dengan panduan kunjungan pertama di beranda,
// selalu bisa dibaca ulang.
export default function Page() {
  return (
    <div className="max-w-3xl space-y-10">
      <LatarDoodle />
      <section className="space-y-4">
        <h1 className="text-[2.25rem] leading-tight font-bold">Cara kerja Astara</h1>
        <p className="text-card font-normal">
          Astara mencatat kondisi fisik pintu masuk, lift, dan toilet fasilitas publik. Setiap catatan membawa foto,
          tanggal foto diambil, dan hasil pemeriksaan keasliannya.
        </p>
        <p className="rounded-md bg-accent px-4 py-3">
          Kami tidak menyimpan kata &ldquo;aksesibel&rdquo;. Penilaian dihitung menurut kebutuhan Anda, dan kalau
          buktinya belum ada, kami tulis belum tahu.
        </p>
      </section>

      <ol className="space-y-4">
        {LANGKAH_CARA_KERJA.map((l, i) => (
          <li key={l.judul} className="flex gap-4 rounded-lg border border-line bg-surface p-6">
            <span
              aria-hidden="true"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-accent font-bold"
            >
              {i + 1}
            </span>
            <div className="space-y-1">
              <h2 className="text-card">{l.judul}</h2>
              <p className="text-ink-muted">{l.isi}</p>
            </div>
          </li>
        ))}
      </ol>

      <p>
        Aturan tiap profil terbuka untuk dibaca di <Link href="/profil">aturan penilaian</Link>.
      </p>
    </div>
  );
}
