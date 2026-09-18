"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_NAME, UI_FIXTURES } from "./brand";
import { cx } from "./cx";

/** Tanda merek: pintu dengan centang. Dekoratif, nama produk selalu tertulis di sebelahnya. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width="2.25rem" height="2.25rem" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--color-p1)" />
      <path d="M11 25V9.5A1.5 1.5 0 0 1 12.5 8h7A1.5 1.5 0 0 1 21 9.5V25" fill="none" stroke="#ffffff" strokeWidth="2.25" strokeLinejoin="round" />
      <path d="M8 25h16" stroke="#ffffff" strokeWidth="2.25" strokeLinecap="round" />
      <path d="m13 16.5 2.25 2.25L19.5 14" fill="none" stroke="var(--color-p6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// `pendek` tampil di layar sempit supaya keempat tab muat tanpa digulir.
const TAB: { href: string; label: string; pendek: string; aktif: (p: string) => boolean }[] = [
  { href: "/", label: "Peta", pendek: "Peta", aktif: (p) => p === "/" },
  { href: "/tempat", label: "Daftar tempat", pendek: "Daftar", aktif: (p) => p.startsWith("/tempat") },
  { href: "/profil", label: "Aturan penilaian", pendek: "Aturan", aktif: (p) => p.startsWith("/profil") },
  { href: "/cara-kerja", label: "Cara kerja", pendek: "Cara kerja", aktif: (p) => p.startsWith("/cara-kerja") },
];

/**
 * Kepala halaman: satu kartu putih membulat yang mengambang. Di beranda ia
 * melayang di atas peta layar penuh; di halaman lain ia duduk di atas isi.
 */
export function SiteHeader() {
  const path = usePathname() ?? "/";
  const diPeta = path === "/";

  return (
    <header className={cx("z-[1100] px-3 pt-3 md:px-6 md:pt-4", diPeta ? "fixed inset-x-0 top-0" : "relative")}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2 md:flex-nowrap md:px-4">
        <Link href="/" className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-md px-1 text-card font-bold text-ink no-underline">
          <BrandMark />
          {PRODUCT_NAME}
        </Link>
        <nav aria-label="Navigasi utama" className="w-full md:w-auto md:flex-1">
          <ul className="grid grid-cols-4 gap-1 md:flex md:justify-center">
            {TAB.map((t) => {
              const aktif = t.aktif(path);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={aktif ? "page" : undefined}
                    className={cx(
                      "flex min-h-12 items-center justify-center rounded-pill px-2 text-center text-meta font-semibold no-underline md:px-4 md:text-body",
                      aktif ? "bg-action text-on-brand" : "text-ink hover:bg-surface-alt",
                    )}
                  >
                    <span className="md:hidden">{t.pendek}</span>
                    <span className="hidden md:inline">{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function FixtureBanner() {
  const path = usePathname() ?? "/";
  if (!UI_FIXTURES || path === "/") return null;
  return (
    <div className="mx-3 mt-3 rounded-md border-2 border-ink bg-surface md:mx-6">
      <p className="mx-auto max-w-6xl px-4 py-2 text-meta">
        <strong>Mode data contoh (NEXT_PUBLIC_UI_FIXTURES=1).</strong> Semua isi halaman ini fiktif,
        dibuat untuk mengembangkan antarmuka sebelum server siap. Jangan dipakai untuk demo atau video.
      </p>
    </div>
  );
}

/** Kaki halaman. Tidak tampil di beranda: di sana peta memenuhi layar dan atribusinya ada di peta. */
export function SiteFooter() {
  const path = usePathname() ?? "/";
  if (path === "/") return null;
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-meta text-ink-muted md:grid-cols-2 md:px-6">
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
