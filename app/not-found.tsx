import type { Metadata } from "next";
import Link from "next/link";
import { LatarDoodle } from "@/lib/ui/latar-doodle";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

// Halaman 404 untuk seluruh situs, termasuk tempat atau atribut yang tidak ada
// (notFound() di rute mana pun jatuh ke sini). Tetap di dalam kepala dan kaki
// halaman, dengan dua jalan kembali.
export default function NotFound() {
  return (
    <div className="max-w-2xl space-y-6">
      <LatarDoodle />
      <h1 className="text-screen">Halaman tidak ditemukan</h1>
      <p>
        Alamat ini tidak cocok dengan halaman atau tempat mana pun di Astara. Tautannya mungkin salah ketik, atau tempat
        itu belum ada di data kami.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/tempat"
          className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-action px-5 font-semibold text-on-brand no-underline"
        >
          Buka daftar tempat <span aria-hidden="true" className="panah">›</span>
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center rounded-pill border-2 border-line-control bg-surface px-5 font-semibold text-ink no-underline hover:border-brand hover:bg-surface-alt"
        >
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
