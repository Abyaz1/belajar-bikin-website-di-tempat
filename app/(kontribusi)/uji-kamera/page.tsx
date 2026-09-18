import type { Metadata } from "next";
import { UjiKamera } from "./uji-kamera";

export const metadata: Metadata = { title: "Uji kamera dan lokasi (perkakas tim)" };

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-screen">Uji kamera dan lokasi</h1>
      <div className="rounded-md border-2 border-ink bg-surface-alt p-4">
        <p>
          <strong>Perkakas tim untuk keputusan jam 0, bukan bagian produk.</strong> Tidak ada yang
          dikirim ke server. Jalankan di tiga HP berbeda OS, lewat alamat HTTPS.
        </p>
        <p className="mt-2 text-meta">
          Yang menentukan bukan cara mana yang lebih gampang, tapi apakah berkas hasilnya membawa EXIF.
          Kalau Cara A gagal di satu HP saja, <strong>laporkan ke tim, jangan diputuskan sendiri</strong>:
          aturan FILE_METADATA_PRESENT berubah dari &ldquo;ada EXIF apa pun&rdquo; menjadi &ldquo;ada tag
          GPS&rdquo; dan turun jadi penanda (00-KONTRAK §10), dan itu menyentuh kontrak API.
        </p>
      </div>
      <UjiKamera />
    </div>
  );
}
