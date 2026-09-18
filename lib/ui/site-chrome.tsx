import Link from "next/link";
import { PRODUCT_NAME, UI_FIXTURES } from "./brand";

/** Tanda merek: pintu dengan centang. Dekoratif, nama produk selalu tertulis di sebelahnya. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width="2rem" height="2rem" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--color-on-brand)" />
      <path d="M11 25V9.5A1.5 1.5 0 0 1 12.5 8h7A1.5 1.5 0 0 1 21 9.5V25" fill="none" stroke="var(--color-brand)" strokeWidth="2.25" strokeLinejoin="round" />
      <path d="M8 25h16" stroke="var(--color-brand)" strokeWidth="2.25" strokeLinecap="round" />
      <path d="m13 16.5 2.25 2.25L19.5 14" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_LINK =
  "inline-flex min-h-12 items-center rounded-md px-3 font-semibold text-on-brand no-underline hover:bg-on-brand/10 hover:underline";

export function SiteHeader() {
  return (
    <header className="on-brand border-b-4 border-accent bg-brand text-on-brand">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="inline-flex min-h-12 items-center gap-3 rounded-md text-card font-bold text-on-brand no-underline">
          <BrandMark />
          <span>
            {PRODUCT_NAME}
            <span className="block text-label font-normal">Kondisi fisik fasilitas publik, berbukti foto</span>
          </span>
        </Link>
        <nav aria-label="Navigasi utama">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link href="/tempat" className={NAV_LINK}>
                Daftar tempat
              </Link>
            </li>
            <li>
              <Link href="/profil" className={NAV_LINK}>
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
    <footer className="mt-16 border-t-4 border-brand bg-surface">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-meta text-ink-muted md:grid-cols-2">
        <div className="space-y-2">
          <p className="font-semibold text-ink">{PRODUCT_NAME}</p>
          <p>
            Daftar lokasi bersumber dari{" "}
            <a href="https://www.openstreetmap.org/copyright">© kontributor OpenStreetMap</a>, dilisensikan ODbL.
            Kondisi fisik tiap lokasi berasal dari kontribusi berfoto yang lolos pemeriksaan.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">Untuk pengujian</p>
          <p>
            <Link href="/uji-penolakan">Perkakas uji penolakan</Link>: coba kirim foto yang tidak sah dan lihat
            alasan penolakannya.
          </p>
        </div>
      </div>
    </footer>
  );
}
