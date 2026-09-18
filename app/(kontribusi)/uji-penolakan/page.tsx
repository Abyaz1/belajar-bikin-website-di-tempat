import type { Metadata } from "next";
import { getPlaces } from "@/lib/ui/api/server";
import { GeoWatch } from "@/lib/ui/geo";
import { PanelUji } from "./panel-uji";

export const metadata: Metadata = { title: "Perkakas uji penolakan" };

// L12 — panel uji penolakan. Tanpa ini puncak demo tidak bisa dijalankan:
// alur kontributor sengaja tidak punya pemilih berkas, dan kamera aplikasi
// tidak bisa mengirim ulang berkas lama.
//
// Klaimnya bukan "antarmuka kami tidak punya tombol galeri", tapi "server kami
// menolak berkas galeri". Panel ini membuktikan yang kedua, lewat E4 yang sama.

export default async function Page() {
  // Profil hanya dibutuhkan E1 untuk menilai; di sini yang dipakai cuma daftar
  // nama dan koordinat tempat.
  const places = await getPlaces("kursi_roda_manual");

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-screen">Perkakas uji penolakan</h1>
        <div className="space-y-2 rounded-md border-4 border-ink p-4">
          <p className="font-semibold">Ini perkakas uji, bukan bagian alur kontributor.</p>
          <p>
            Tiga percobaan di bawah dikirim ke endpoint yang sama dengan kontribusi biasa. Server tidak tahu kiriman ini
            datang dari panel uji, jadi setiap kiriman tercatat di jejak audit seperti kiriman lain.
          </p>
          <p className="text-meta">
            Yang dibuktikan: penolakan terjadi di server, bukan karena antarmuka menyembunyikan tombol. Yang tidak
            dibuktikan: bahwa pemalsuan mustahil — lapisan ini menaikkan biaya pemalsuan, bukan menutup celahnya.
          </p>
        </div>
      </header>
      <GeoWatch>
        <PanelUji places={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon }))} />
      </GeoWatch>
    </div>
  );
}
