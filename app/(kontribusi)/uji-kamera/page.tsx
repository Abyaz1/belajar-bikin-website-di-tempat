import type { Metadata } from "next";
import { UjiKamera } from "./uji-kamera";

export const metadata: Metadata = { title: "Uji kamera dan lokasi (perkakas tim)" };

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-screen">Uji kamera dan lokasi</h1>
      <div className="space-y-2 rounded-md border-2 border-ink bg-surface-alt p-4">
        <p>
          <strong>Perkakas tim, bukan bagian produk.</strong> Tidak ada yang dikirim ke server. Buka lewat alamat HTTPS.
        </p>
        <p className="text-meta">
          Mekanisme kamera sudah diputuskan di 00-KONTRAK §10: <code className="font-mono">getUserMedia</code>, dan
          FILE_METADATA_PRESENT tetap &ldquo;ada EXIF apa pun&rdquo;. Halaman ini sekarang dipakai untuk dua hal yang
          masih terbuka: resolusi nyata kamera produksi di HP yang sama (cara A), dan uji iPhone Safari.
        </p>
      </div>
      <UjiKamera />
    </div>
  );
}
