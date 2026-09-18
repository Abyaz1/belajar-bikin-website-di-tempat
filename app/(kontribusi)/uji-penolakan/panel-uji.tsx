"use client";

import { useEffect, useRef, useState } from "react";
import { openCaptureSession, RequestFailed, submitDraft, type DraftInput } from "@/lib/ui/api/client";
import type { ApiErrorBody, CheckOutcome } from "@/lib/ui/api/types";
import { useAnnounce } from "@/lib/ui/announcer";
import { Button } from "@/lib/ui/button";
import { CAMERA_PROBLEM, useCamera } from "@/lib/ui/camera";
import { ChecksTable, FlagNotice, ReasonBlock } from "@/lib/ui/checks";
import { formatMeters } from "@/lib/ui/format";
import { distanceMeters, useGeo } from "@/lib/ui/geo";
import { GeoStatus } from "@/lib/ui/geo-status";

interface Target {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

type Attack = "galeri" | "lokasi_lain" | "kirim_ulang";

const ATTACK_TITLE: Record<Attack, string> = {
  galeri: "Unggah dari galeri",
  lokasi_lain: "Kirim foto untuk lokasi lain",
  kirim_ulang: "Kirim ulang foto yang pernah masuk",
};

type Outcome =
  | { kind: "ditolak"; attack: Attack; errors: ApiErrorBody[] }
  | { kind: "diterima"; attack: Attack; checks: CheckOutcome[] }
  | { kind: "galat"; attack: Attack; message: string };

export function PanelUji({ places }: { places: Target[] }) {
  const geo = useGeo();
  const announce = useAnnounce();
  const { videoRef, state: cameraState, detail, start, stop, capture } = useCamera();
  const [targetId, setTargetId] = useState(places[0]?.id ?? "");
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [lastSent, setLastSent] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<Attack | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  // Hasil baru → fokus ke judul hasil, supaya pengguna papan ketik dan screen
  // reader langsung sampai ke alasannya.
  useEffect(() => {
    if (outcome) resultHeading.current?.focus();
  }, [outcome]);

  const target = places.find((p) => p.id === targetId) ?? null;
  const here = geo.latest;
  const distance = target && here ? distanceMeters(here, target) : null;
  const problem = CAMERA_PROBLEM[cameraState];

  async function attack(kind: Attack, image: Blob, captureMethod: DraftInput["captureMethod"]) {
    if (!target) return;
    setBusy(kind);
    setOutcome(null);
    announce(`${ATTACK_TITLE[kind]}: mengirim ke server.`);
    let result: Outcome;
    try {
      // Setiap percobaan memakai token sah yang baru, supaya yang diuji benar-
      // benar pemeriksaan berkas dan lokasi, bukan token.
      const session = await openCaptureSession(target.id, "entrance");
      const fix = await geo.bestFresh();
      const r = await submitDraft({
        image,
        captureToken: session.token,
        placeId: target.id,
        vantage: "entrance",
        fix,
        capturedAt: new Date(),
        captureMethod,
        fixtureScenario: kind,
      });
      setLastSent(image);
      result =
        r.kind === "rejected"
          ? { kind: "ditolak", attack: kind, errors: r.errors }
          : r.kind === "accepted"
            ? { kind: "diterima", attack: kind, checks: r.draft.checks }
            : { kind: "galat", attack: kind, message: r.error?.message ?? `Server menjawab galat ${r.status}.` };
    } catch (e) {
      result = { kind: "galat", attack: kind, message: e instanceof RequestFailed ? e.message : "Tidak dapat menghubungi server." };
    }
    setBusy(null);
    setOutcome(result);
    announce(
      result.kind === "ditolak"
        ? `Ditolak. ${result.errors.length} pemeriksaan tidak lolos: ${result.errors.map((e) => e.code).join(", ")}.`
        : result.kind === "diterima"
          ? "Diterima. Server tidak menemukan masalah pada kiriman ini."
          : result.message,
    );
  }

  async function shootAndSend() {
    const shot = await capture();
    stop();
    await attack("lokasi_lain", shot.blob, "getusermedia");
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="judul-sasaran" className="space-y-3">
        <h2 id="judul-sasaran" className="text-section">
          Tempat sasaran
        </h2>
        <label htmlFor="sasaran" className="block font-semibold">
          Kiriman ditujukan ke tempat ini
        </label>
        <select
          id="sasaran"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="block min-h-11 w-full rounded-md border-2 border-line-control bg-surface px-3"
        >
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <GeoStatus compact />
        {distance !== null ? (
          <p>
            Jarak Anda ke tempat ini sekitar <strong>{formatMeters(distance)}</strong> menurut GPS perangkat. Server
            menghitung ulang sendiri.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="judul-galeri" className="space-y-3 border-t border-line pt-6">
        <h2 id="judul-galeri" className="text-section">
          1. {ATTACK_TITLE.galeri}
        </h2>
        <p className="text-meta text-ink-muted">
          Berkas dari galeri biasanya membawa metadata (EXIF). Foto dari kamera aplikasi tidak pernah membawanya.
          Diharapkan: <code className="font-mono">file_metadata_present</code>.
        </p>
        <label htmlFor="berkas-galeri" className="block font-semibold">
          Pilih foto dari galeri
        </label>
        <input
          id="berkas-galeri"
          type="file"
          accept="image/jpeg,image/*"
          onChange={(e) => setGalleryFile(e.target.files?.[0] ?? null)}
          className="block min-h-11 w-full rounded-md border-2 border-line-control p-2"
        />
        <Button
          onClick={() => galleryFile && attack("galeri", galleryFile, "gallery")}
          disabled={!galleryFile || !target}
          loading={busy === "galeri"}
          loadingText="Mengirim berkas galeri…"
        >
          Kirim berkas galeri
        </Button>
      </section>

      <section aria-labelledby="judul-lokasi" className="space-y-3 border-t border-line pt-6">
        <h2 id="judul-lokasi" className="text-section">
          2. {ATTACK_TITLE.lokasi_lain}
        </h2>
        <p className="text-meta text-ink-muted">
          Foto diambil dengan kamera aplikasi, koordinatnya asli dari perangkat, tapi ditujukan ke tempat sasaran yang
          jauh dari posisi Anda. Diharapkan: <code className="font-mono">geo_too_far</code> dengan jarak terukur.
        </p>
        {problem ? (
          <div className="rounded-md border-2 border-tidak-line bg-tidak-fill p-3 text-tidak-ink">
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
          className={cameraState === "live" ? "block max-h-72 w-full rounded-md bg-ink object-contain" : "hidden"}
        />
        {cameraState === "live" ? (
          <Button onClick={shootAndSend} loading={busy === "lokasi_lain"} loadingText="Mengirim foto…" disabled={!target}>
            Ambil foto dan kirim
          </Button>
        ) : (
          <Button variant="sekunder" onClick={() => void start()} loading={cameraState === "starting"} loadingText="Membuka kamera…">
            Buka kamera
          </Button>
        )}
      </section>

      <section aria-labelledby="judul-ulang" className="space-y-3 border-t border-line pt-6">
        <h2 id="judul-ulang" className="text-section">
          3. {ATTACK_TITLE.kirim_ulang}
        </h2>
        <p className="text-meta text-ink-muted">
          Mengirim ulang berkas terakhir yang dikirim dari panel ini. Diharapkan:{" "}
          <code className="font-mono">duplicate_image</code> dengan jarak kemiripan terukur.
        </p>
        <Button
          onClick={() => lastSent && attack("kirim_ulang", lastSent, "getusermedia")}
          disabled={!lastSent || !target}
          loading={busy === "kirim_ulang"}
          loadingText="Mengirim ulang…"
        >
          Kirim ulang foto terakhir
        </Button>
        {!lastSent ? <p className="text-meta">Aktif setelah percobaan 1 atau 2 dikirim.</p> : null}
      </section>

      <section aria-labelledby="judul-hasil" className="space-y-4 border-t border-line pt-6">
        <h2 id="judul-hasil" ref={resultHeading} tabIndex={-1} className="text-section">
          {outcome
            ? outcome.kind === "ditolak"
              ? `Hasil: ${ATTACK_TITLE[outcome.attack].toLowerCase()} ditolak`
              : outcome.kind === "diterima"
                ? `Hasil: ${ATTACK_TITLE[outcome.attack].toLowerCase()} diterima`
                : "Hasil: galat"
            : "Hasil"}
        </h2>
        {!outcome ? <p className="text-ink-muted">Belum ada percobaan.</p> : null}
        {outcome?.kind === "ditolak" ? (
          <>
            <p>
              {outcome.errors.length} pemeriksaan tidak lolos. Tidak ada atribut yang tersimpan; catatan pemeriksaannya
              tersimpan di jejak audit.
            </p>
            <ul className="space-y-3">
              {outcome.errors.map((e, i) => (
                <ReasonBlock key={`${e.code}-${i}`} error={e} />
              ))}
            </ul>
          </>
        ) : null}
        {outcome?.kind === "diterima" ? (
          <>
            <p>
              Server menerima kiriman ini. Kalau percobaan ini seharusnya ditolak, catat sebagai temuan — itu batas
              sistem yang harus disebut jujur, bukan disembunyikan. Draft ini tidak dikonfirmasi, jadi tidak ada atribut
              yang berubah.
            </p>
            <FlagNotice checks={outcome.checks} />
            <ChecksTable checks={outcome.checks} caption="Hasil tiap pemeriksaan" />
          </>
        ) : null}
        {outcome?.kind === "galat" ? <p role="alert">{outcome.message}</p> : null}
      </section>
    </div>
  );
}
