import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AnnouncerProvider } from "@/lib/ui/announcer";
import { PRODUCT_NAME } from "@/lib/ui/brand";
import { FixtureBanner, SiteFooter, SiteHeader } from "@/lib/ui/site-chrome";

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description:
    "Sistem verifikasi kondisi fisik fasilitas publik. Setiap atribut membawa foto, hasil pemeriksaan keaslian, dan tanggal.",
};

// Zoom TIDAK dikunci: maximum-scale dan user-scalable sengaja tidak diset.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="flex min-h-dvh flex-col">
        <a href="#isi" className="skip-link">
          Langsung ke isi utama
        </a>
        <AnnouncerProvider>
          <SiteHeader />
          <FixtureBanner />
          <main id="isi" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            {children}
          </main>
          <SiteFooter />
        </AnnouncerProvider>
      </body>
    </html>
  );
}
