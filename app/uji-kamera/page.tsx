import type { Metadata } from "next";
import { UjiKamera } from "./uji-kamera";

// Perkakas sementara untuk mengisi §10 kontrak (mekanisme kamera dan akurasi
// GPS). Bukan fitur produk; hapus setelah §10 dibekukan.
export const metadata: Metadata = {
  title: "Uji kamera dan lokasi",
  robots: { index: false },
};

export default function Page() {
  return <UjiKamera />;
}
