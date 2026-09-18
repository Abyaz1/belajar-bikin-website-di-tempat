import type { Metadata } from "next";
import Link from "next/link";
import { captureLimits } from "@/lib/ui/capture-config";
import { UjiKamera } from "./uji-kamera";

// Rutenya /uji-kamera-produk, bukan /uji-kamera: /uji-kamera dipakai halaman
// uji pHash (app/uji-kamera). Dua halaman di rute yang sama membuat build gagal.
export const metadata: Metadata = { title: "Uji kamera produksi (perkakas tim)", robots: { index: false } };

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-screen">Uji kamera produksi</h1>
      <div className="space-y-2 rounded-md border-2 border-ink bg-surface-alt p-4">
        <p>
          <strong>Perkakas tim, bukan bagian produk.</strong> Tidak ada yang dikirim ke server. Buka lewat alamat HTTPS.
        </p>
        <p className="text-meta">
          Mekanisme kamera sudah diputuskan di 00-KONTRAK §10: <code className="font-mono">getUserMedia</code>, dan
          FILE_METADATA_PRESENT tetap &ldquo;ada EXIF apa pun&rdquo;. Halaman ini sekarang dipakai untuk dua hal yang
          masih terbuka: resolusi nyata kamera produksi di HP yang sama (cara A), dan uji iPhone Safari.
        </p>
        <p className="text-meta">
          Bedanya dengan <Link href="/uji-kamera">/uji-kamera</Link> (uji pHash): halaman ini memakai kode kamera yang sama
          persis dengan layar kontribusi, jadi resolusinya adalah resolusi yang nanti dikirim ke server.
        </p>
      </div>
      <UjiKamera limits={captureLimits()} />
    </div>
  );
}
