"use client";

/**
 * Peta — TAMPILAN SEKUNDER. Daftar adalah tampilan utama, dan peta tidak pernah
 * jadi satu-satunya cara mencapai sebuah lokasi: halaman yang memuat peta
 * selalu memuat daftar yang setara (A4).
 *
 * Penanda sengaja tidak masuk urutan fokus. Memaksa pengguna papan ketik atau
 * screen reader menelusuri ratusan penanda satu per satu bukan aksesibilitas;
 * fungsi yang sama tersedia di daftar. Bentuk penanda mengikuti ikon penilaian
 * (segi delapan, segitiga, lingkaran), jadi tidak bergantung warna (A7).
 *
 * Ubin: tile.openstreetmap.org, dengan atribusi wajib. Kebijakan pemakaiannya
 * hanya untuk lalu lintas ringan — cukup untuk purwarupa, tidak untuk produksi.
 */

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Verdict } from "./api/types";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  verdict: Verdict;
  verdictText: string;
  href: string;
}

// Warna sama dengan token penilaian di globals.css (Leaflet butuh nilai
// literal di dalam SVG). Ubah keduanya bersamaan.
const SHAPE: Record<Verdict, { fill: string; line: string; path: string }> = {
  tidak_dapat_diakses: {
    fill: "#fdefea",
    line: "#b5452b",
    path: '<path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z"/><path d="M7.5 12h9" stroke-width="3"/>',
  },
  dengan_catatan: {
    fill: "#fdf3e2",
    line: "#b07400",
    path: '<path d="M12 2.5 22 20.5H2z"/><path d="M12 9.5v5"/><path d="M12 17.6v.1" stroke-width="3"/>',
  },
  dapat_diakses: {
    fill: "#e9f4ec",
    line: "#2e7d4f",
    path: '<circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/>',
  },
  belum_dapat_dipastikan: {
    fill: "#f0f2f5",
    line: "#767d86",
    path: '<circle cx="12" cy="12" r="9.5"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.5"/><path d="M12 17v.1" stroke-width="3"/>',
  },
};

function iconHtml(v: Verdict) {
  const s = SHAPE[v];
  return `<svg viewBox="0 0 24 24" width="36" height="36" fill="${s.fill}" stroke="${s.line}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.path}</svg>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * `penuh`: peta memenuhi layar di beranda. Roda tetikus boleh memperbesar
 * (tidak ada isi halaman lain yang perlu digulir), dan batas tampilan diberi
 * ruang untuk kepala halaman di atas serta panel profil di bawah.
 */
export function MapView({ places, label, penuh = false }: { places: MapPlace[]; label: string; penuh?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      map = L.map(ref.current, { scrollWheelZoom: penuh, zoomControl: false });
      // Kanan bawah: paling mudah dijangkau ibu jari. Ukurannya 48px (globals.css).
      L.control
        .zoom({ position: "bottomright", zoomInTitle: "Perbesar peta", zoomOutTitle: "Perkecil peta" })
        .addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">kontributor OpenStreetMap</a>',
      }).addTo(map);

      const markers = places.map((p) =>
        L.marker([p.lat, p.lon], {
          keyboard: false,
          title: p.name,
          icon: L.divIcon({ html: iconHtml(p.verdict), className: "", iconSize: [36, 36], iconAnchor: [18, 18] }),
        }).bindPopup(
          `<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.verdictText)}<br><a href="${escapeHtml(p.href)}">Buka laporan tempat</a>`,
        ),
      );
      markers.forEach((m) => m.addTo(map!));
      const ruang = penuh ? { paddingTopLeft: [24, 120] as [number, number], paddingBottomRight: [24, 200] as [number, number] } : {};
      if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15), ruang);
      else if (markers.length === 1) map.setView(markers[0].getLatLng(), 17);
      else map.setView([-6.8915, 107.616], 15);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [places, penuh]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className={penuh ? "peta-penuh h-full w-full" : "h-[28rem] w-full overflow-hidden rounded-md border border-line-control"}
    />
  );
}
