import Link from "next/link";
import { PRODUCT_NAME, UI_FIXTURES } from "./brand";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-card font-bold text-ink no-underline hover:underline">
          {PRODUCT_NAME}
        </Link>
        <nav aria-label="Navigasi utama">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Link href="/tempat" className="inline-flex min-h-11 items-center">
                Daftar tempat
              </Link>
            </li>
            <li>
              <Link href="/profil" className="inline-flex min-h-11 items-center">
                Aturan penilaian
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function FixtureBanner() {
  if (!UI_FIXTURES) return null;
  return (
    <div className="border-y-4 border-ink bg-surface-alt">
      <p className="mx-auto max-w-5xl px-4 py-2 text-meta">
        <strong>Mode data contoh (NEXT_PUBLIC_UI_FIXTURES=1).</strong> Semua isi halaman ini fiktif,
        dibuat untuk mengembangkan antarmuka sebelum server siap. Jangan dipakai untuk demo atau video.
      </p>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-meta text-ink-muted">
        <p>
          Daftar lokasi bersumber dari{" "}
          <a href="https://www.openstreetmap.org/copyright">© kontributor OpenStreetMap</a>, dilisensikan
          ODbL. Kondisi fisik tiap lokasi berasal dari kontribusi berfoto yang lolos pemeriksaan.
        </p>
        <p>
          <Link href="/uji-penolakan">Perkakas uji penolakan</Link> — untuk mencoba mengelabui sistem
          dan melihat alasannya ditolak.
        </p>
      </div>
    </footer>
  );
}
