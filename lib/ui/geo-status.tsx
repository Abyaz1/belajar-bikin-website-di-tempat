"use client";

/**
 * Keadaan GPS yang terlihat. Angka ketelitian ditampilkan apa adanya: itu juga
 * angka yang dipakai tim untuk mengkalibrasi radius C7 di ruangan presentasi.
 */

import { useGeo } from "./geo";
import { formatMeters } from "./format";
import { useNow } from "./use-now";

export function GeoStatus({ compact = false }: { compact?: boolean }) {
  const geo = useGeo();
  const now = useNow();

  if (geo.state === "denied") {
    return (
      <div className="rounded-md border-2 border-tidak-line bg-tidak-fill p-3 text-tidak-ink">
        <p className="font-semibold">Izin lokasi belum diberikan.</p>
        <p>
          Kiriman tanpa lokasi akan ditolak server (<code className="font-mono">geo_missing</code>). Izinkan lokasi untuk
          situs ini di pengaturan peramban, lalu muat ulang halaman.
        </p>
      </div>
    );
  }
  if (geo.state === "unsupported" || geo.state === "unavailable") {
    return (
      <p className="rounded-md border-2 border-line-control p-3">
        Perangkat ini belum memberi lokasi. Kiriman tanpa lokasi akan ditolak server.
      </p>
    );
  }
  if (!geo.latest) {
    return (
      <p className="text-meta">
        Mencari lokasi Anda… {compact ? "" : "Pencarian dimulai sejak layar ini dibuka supaya siap saat memotret. Di dalam gedung bisa butuh belasan detik."}
      </p>
    );
  }
  const age = Math.max(0, Math.round((now - geo.latest.at) / 1000));
  return (
    <p className="text-meta">
      Lokasi didapat. Ketelitian menurut perangkat {formatMeters(geo.latest.accuracy)}, diperbarui {age} detik lalu
      {geo.lowAccuracy ? " (mode ketelitian rendah)" : ""}.
      {compact ? "" : " Angka ini ikut dikirim dan tampil di jejak audit."}
    </p>
  );
}
