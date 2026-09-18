"use client";

import { useEffect, useState } from "react";
import { useAnnounce } from "@/lib/ui/announcer";
import { Button } from "@/lib/ui/button";
import { CAMERA_PROBLEM, useCamera } from "@/lib/ui/camera";
import { sniffMetadata, type MetadataReport } from "@/lib/ui/exif-sniff";
import { GeoWatch, useGeo } from "@/lib/ui/geo";
import { useIsClient } from "@/lib/ui/use-client";
import { useNow } from "@/lib/ui/use-now";

interface Env {
  secure: boolean;
  mediaDevices: boolean;
  geolocation: boolean;
  ua: string;
}

export function UjiKamera() {
  const isClient = useIsClient();
  const [a, setA] = useState<MetadataReport | null>(null);
  const [b, setB] = useState<MetadataReport | null>(null);
  const [geoLine, setGeoLine] = useState("belum dites");

  const env: Env | null = isClient
    ? {
        secure: window.isSecureContext,
        mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
        geolocation: "geolocation" in navigator,
        ua: navigator.userAgent,
      }
    : null;

  const summary = [
    `Peramban: ${env?.ua ?? "?"}`,
    `HTTPS/secure context: ${env ? (env.secure ? "ya" : "TIDAK") : "?"}`,
    `Cara A (getUserMedia→kanvas): ${a ? line(a) : "belum dites / gagal"}`,
    `Cara B (input capture): ${b ? line(b) : "belum dites"}`,
    `GPS: ${geoLine}`,
  ].join("\n");

  return (
    <div className="space-y-8">
      <section aria-labelledby="h-env" className="space-y-2">
        <h2 id="h-env" className="text-section">
          Lingkungan
        </h2>
        {env ? (
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
            <dt className="font-semibold">Secure context (HTTPS)</dt>
            <dd>{env.secure ? "Ya" : "Tidak — kamera pasti gagal di alamat ini"}</dd>
            <dt className="font-semibold">getUserMedia tersedia</dt>
            <dd>{env.mediaDevices ? "Ya" : "Tidak"}</dd>
            <dt className="font-semibold">Geolocation tersedia</dt>
            <dd>{env.geolocation ? "Ya" : "Tidak"}</dd>
            <dt className="font-semibold">Peramban</dt>
            <dd className="font-mono text-meta">{env.ua}</dd>
          </dl>
        ) : (
          <p>Membaca lingkungan…</p>
        )}
      </section>

      <CaraA onReport={setA} report={a} />
      <CaraB onReport={setB} report={b} />

      <section aria-labelledby="h-geo" className="space-y-3">
        <h2 id="h-geo" className="text-section">
          Lokasi
        </h2>
        <GeoTest onLine={setGeoLine} />
      </section>

      <section aria-labelledby="h-sum" className="space-y-3">
        <h2 id="h-sum" className="text-section">
          Ringkasan untuk dilaporkan
        </h2>
        <label htmlFor="ringkasan" className="block font-semibold">
          Salin teks ini ke kanal tim, satu per HP
        </label>
        <textarea
          id="ringkasan"
          readOnly
          value={summary}
          rows={6}
          className="w-full rounded-md border border-line-control p-3 font-mono text-meta"
        />
        <CopyButton text={summary} />
      </section>
    </div>
  );
}

function line(r: MetadataReport) {
  return `${r.kind}, ${Math.round(r.bytes / 1024)} KB, EXIF ${r.exif ? "ADA" : "tidak ada"}, GPS ${
    r.exifGps ? "ADA" : "tidak ada"
  }${r.xmp ? ", XMP ada" : ""}`;
}

function CaraA({
  report,
  onReport,
}: {
  report: MetadataReport | null;
  onReport: (r: MetadataReport) => void;
}) {
  const { videoRef, state, detail, start, capture } = useCamera();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const problem = CAMERA_PROBLEM[state];

  async function shoot() {
    setBusy(true);
    try {
      const shot = await capture();
      const r = await sniffMetadata(shot.blob);
      onReport(r);
      announce(`Cara A selesai. EXIF ${r.exif ? "ada" : "tidak ada"}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="h-a" className="space-y-3">
      <h2 id="h-a" className="text-section">
        Cara A — kamera dalam aplikasi (getUserMedia → kanvas)
      </h2>
      <p className="text-meta text-ink-muted">
        Cara yang dipakai alur kontribusi. Hasil yang diharapkan: berkas JPEG tanpa EXIF di semua HP.
      </p>
      {problem ? (
        <div className="rounded-md border border-tidak-line bg-tidak-fill p-4 text-tidak-ink">
          <p className="font-semibold">{problem.title}</p>
          <p>{problem.body}</p>
          {detail ? <p className="font-mono text-meta">{detail}</p> : null}
        </div>
      ) : null}
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Pratinjau kamera"
        className={state === "live" ? "block max-h-80 w-full rounded-md bg-ink" : "hidden"}
      />
      <div className="flex flex-wrap gap-3">
        {state !== "live" ? (
          <Button onClick={start} loading={state === "starting"} loadingText="Membuka kamera…">
            Buka kamera
          </Button>
        ) : (
          <Button onClick={shoot} loading={busy} loadingText="Memeriksa berkas…">
            Ambil foto dan periksa berkas
          </Button>
        )}
      </div>
      {report ? <ReportView report={report} /> : null}
    </section>
  );
}

function CaraB({
  report,
  onReport,
}: {
  report: MetadataReport | null;
  onReport: (r: MetadataReport) => void;
}) {
  const announce = useAnnounce();
  return (
    <section aria-labelledby="h-b" className="space-y-3">
      <h2 id="h-b" className="text-section">
        Cara B — input berkas dengan atribut capture
      </h2>
      <p className="text-meta text-ink-muted">
        Cara cadangan. Di banyak HP, berkas hasilnya membawa EXIF — termasuk foto yang sah.
      </p>
      <div>
        <label htmlFor="cara-b" className="block font-semibold">
          Ambil foto lewat kamera bawaan HP
        </label>
        <input
          id="cara-b"
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-2 block min-h-11 w-full rounded-md border border-line-control p-2"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const r = await sniffMetadata(file);
            onReport(r);
            announce(`Cara B selesai. EXIF ${r.exif ? "ada" : "tidak ada"}, GPS ${r.exifGps ? "ada" : "tidak ada"}.`);
          }}
        />
      </div>
      {report ? <ReportView report={report} /> : null}
    </section>
  );
}

function ReportView({ report }: { report: MetadataReport }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 rounded-md border border-line bg-surface-alt p-4 sm:grid-cols-[max-content_1fr]">
      <dt className="font-semibold">Jenis berkas</dt>
      <dd>{report.kind.toUpperCase()}</dd>
      <dt className="font-semibold">Ukuran</dt>
      <dd>{Math.round(report.bytes / 1024)} KB</dd>
      <dt className="font-semibold">EXIF</dt>
      <dd>
        <strong>{report.exif ? "Ada" : "Tidak ada"}</strong>
      </dd>
      <dt className="font-semibold">Tag GPS di EXIF</dt>
      <dd>
        <strong>{report.exifGps ? "Ada" : "Tidak ada"}</strong>
      </dd>
      <dt className="font-semibold">XMP</dt>
      <dd>{report.xmp ? "Ada" : "Tidak ada"}</dd>
      <dt className="font-semibold">Perangkat (EXIF)</dt>
      <dd>{[report.make, report.model].filter(Boolean).join(" ") || "—"}</dd>
      <dt className="font-semibold">Waktu asli (EXIF)</dt>
      <dd>{report.dateTimeOriginal ?? "—"}</dd>
      <dt className="font-semibold">Orientasi</dt>
      <dd>{report.orientation ?? "—"}</dd>
      <dt className="font-semibold">Segmen</dt>
      <dd className="font-mono text-meta">{report.segments.join(" · ") || "—"}</dd>
    </dl>
  );
}

function GeoTest({ onLine }: { onLine: (s: string) => void }) {
  const [on, setOn] = useState(false);
  if (!on) {
    return (
      <div className="space-y-2">
        <p className="text-meta text-ink-muted">
          Ukur di dalam gedung tempat demo. Angka akurasi ini yang dipakai menghitung radius lolos C7.
        </p>
        <Button onClick={() => setOn(true)}>Mulai pantau lokasi</Button>
      </div>
    );
  }
  return (
    <GeoWatch>
      <GeoReadout onLine={onLine} />
    </GeoWatch>
  );
}

function GeoReadout({ onLine }: { onLine: (s: string) => void }) {
  const geo = useGeo();
  const now = useNow();
  const best = geo.best();
  const text =
    geo.state === "denied"
      ? "izin lokasi ditolak"
      : geo.state === "unsupported"
        ? "geolocation tidak tersedia"
        : best
          ? `fix pertama ${((geo.firstFixMs ?? 0) / 1000).toFixed(1)} dtk, akurasi terbaik 60 dtk terakhir ${Math.round(best.accuracy)} m${geo.lowAccuracy ? " (mode akurasi rendah)" : ""}`
          : "menunggu fix pertama";

  useEffect(() => onLine(text), [text, onLine]);

  return (
    <dl className="grid gap-x-6 gap-y-1 rounded-md border border-line bg-surface-alt p-4 sm:grid-cols-[max-content_1fr]">
      <dt className="font-semibold">Keadaan</dt>
      <dd>{text}</dd>
      <dt className="font-semibold">Fix terakhir</dt>
      <dd>
        {geo.latest
          ? `akurasi ${Math.round(geo.latest.accuracy)} m, ${Math.max(0, Math.round((now - geo.latest.at) / 1000))} dtk lalu`
          : "—"}
      </dd>
      <dt className="font-semibold">Koordinat</dt>
      <dd className="font-mono text-meta">
        {geo.latest ? `${geo.latest.lat.toFixed(6)}, ${geo.latest.lon.toFixed(6)}` : "—"}
      </dd>
    </dl>
  );
}

function CopyButton({ text }: { text: string }) {
  const announce = useAnnounce();
  return (
    <Button
      variant="sekunder"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          announce("Ringkasan disalin.");
        } catch {
          announce("Tidak bisa menyalin otomatis. Pilih teks di kotak lalu salin manual.");
        }
      }}
    >
      Salin ringkasan
    </Button>
  );
}
