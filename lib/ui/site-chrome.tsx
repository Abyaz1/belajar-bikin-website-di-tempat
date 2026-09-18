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
  { href: "/", label: "Beranda", pendek: "Beranda", aktif: (p) => p === "/" },
  { href: "/tempat", label: "Daftar tempat", pendek: "Daftar", aktif: (p) => p.startsWith("/tempat") },
  { href: "/profil", label: "Aturan penilaian", pendek: "Aturan", aktif: (p) => p.startsWith("/profil") },
  { href: "/cara-kerja", label: "Cara kerja", pendek: "Cara kerja", aktif: (p) => p.startsWith("/cara-kerja") },
];

/**
 * Kepala halaman: satu kartu putih membulat. Kiri merek, tengah tab teks
 * (yang aktif bergaris bawah tebal), kanan tombol Buka peta. Di halaman peta ia
 * melayang di atas peta layar penuh.
 */
export function SiteHeader() {
  const path = usePathname() ?? "/";
  const diPeta = path === "/peta";

  return (
    <header className={cx("z-[1100] px-3 pt-3 md:px-6 md:pt-4", diPeta ? "fixed inset-x-0 top-0" : "relative")}>
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2 md:grid-cols-[auto_1fr_auto] md:px-5">
        <Link href="/" className="merek inline-flex min-h-12 items-center gap-3 rounded-md px-1 text-card font-bold text-ink no-underline">
          <BrandMark />
          {PRODUCT_NAME}
        </Link>

        <div className="flex items-center justify-end gap-2 md:order-3">
          <Link
            href="/peta"
            aria-current={diPeta ? "page" : undefined}
            className="inline-flex min-h-12 items-center gap-2 rounded-pill bg-action px-5 font-semibold text-on-brand no-underline hover:opacity-90"
          >
            Buka peta
            <span aria-hidden="true" className="panah">›</span>
          </Link>
        </div>

        <nav aria-label="Navigasi utama" className="col-span-2 md:order-2 md:col-span-1">
          <ul className="grid grid-cols-4 md:flex md:justify-center md:gap-2">
            {TAB.map((t) => {
              const aktif = t.aktif(path);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={aktif ? "page" : undefined}
                    className={cx(
                      "flex min-h-12 items-center justify-center whitespace-nowrap border-b-2 px-1 transition-colors duration-150 text-label no-underline md:px-3 md:text-meta",
                      aktif ? "border-action font-bold text-ink" : "border-transparent font-normal text-ink-muted hover:border-line-control hover:text-ink",
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
  if (!UI_FIXTURES || path === "/peta") return null;
  return (
    // Lebar, jarak tepi, dan sudutnya sama dengan kepala halaman supaya sejajar.
    <div className="px-3 pt-2 md:px-6">
      <p className="mx-auto max-w-6xl rounded-lg border border-line bg-accent px-4 py-2 text-meta">
        <strong>Mode data contoh.</strong> Isi halaman ini fiktif; jangan dipakai untuk demo atau video.
      </p>
    </div>
  );
}

/**
 * Kaki halaman: latar warna 1 (Tinta Malam), teks putih. Tidak tampil di
 * halaman peta: di sana peta memenuhi layar dan atribusinya ada di peta.
 */
export function SiteFooter() {
  const path = usePathname() ?? "/";
  if (path === "/peta") return null;
  const TAUTAN = "text-on-brand underline underline-offset-2 hover:decoration-2";
  return (
    <footer className="on-brand mt-16 bg-brand text-on-brand">
      <div className="mx-auto grid max-w-6xl gap-8 px-3 py-10 text-meta md:grid-cols-[2fr_1fr] md:px-6">
        <div className="space-y-3">
          <p className="flex items-center gap-3 text-card font-bold">
            <span className="rounded-[0.6rem] ring-2 ring-on-brand/40">
              <BrandMark />
            </span>
            {PRODUCT_NAME}
          </p>
          <p className="max-w-md">
            Kondisi fisik fasilitas publik, berbukti foto, tanggal, dan hasil pemeriksaan keaslian. Dinilai menurut
            kebutuhan Anda.
          </p>
        </div>
        <nav aria-label="Tautan kaki halaman" className="space-y-3">
          <p className="font-bold">Jelajahi</p>
          <ul className="space-y-2">
            <li><Link className={TAUTAN} href="/peta">Peta</Link></li>
            <li><Link className={TAUTAN} href="/tempat">Daftar tempat</Link></li>
            <li><Link className={TAUTAN} href="/profil">Aturan penilaian</Link></li>
            <li><Link className={TAUTAN} href="/cara-kerja">Cara kerja</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-on-brand/20">
        <div className="mx-auto max-w-6xl px-3 py-4 md:px-6">
          <p className="max-w-[72ch] text-label font-normal">
            Daftar lokasi bersumber dari{" "}
            <a className={TAUTAN} href="https://www.openstreetmap.org/copyright">© kontributor OpenStreetMap</a>,
            dilisensikan ODbL. Kondisi fisik tiap lokasi berasal dari kontribusi berfoto yang lolos pemeriksaan.
          </p>
        </div>
      </div>
    </footer>
  );
}
