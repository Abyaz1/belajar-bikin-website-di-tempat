"use client";

/**
 * Alur kontribusi L8 → E4 → (L9 | L10 → E5 → L11).
 *
 *   L7 dibuka ─ GPS mulai dipantau (layout) ─┐
 *   layar ini dibuka ─ E8: token sekali pakai │
 *   L8 kamera ─ ambil ─ pratinjau ─ kirim E4 ─┤
 *        ├─ 422 → L9 penolakan (alasan + nilai terukur + ambang)
 *        └─ 200 → L10 konfirmasi ─ E5 → L11 ringkasan
 *
 * Klien tidak memutuskan apa pun tentang keaslian. Semua keputusan di server;
 * layar ini menampilkan jawabannya apa adanya.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { openCaptureSession, RequestFailed, submitDraft } from "@/lib/ui/api/client";
import type {
  ApiErrorBody,
  CaptureSession,
  Claimable,
  ConfirmItem,
  DraftAccepted,
  StateChange,
  Vantage,
} from "@/lib/ui/api/types";
import { useAnnounce } from "@/lib/ui/announcer";
import { Button, ButtonLink } from "@/lib/ui/button";
import { CAMERA_PROBLEM, useCamera, type Capture } from "@/lib/ui/camera";
import { RejectionView } from "@/lib/ui/checks";
import { VANTAGE_HINT, VANTAGE_LABEL } from "@/lib/ui/copy";
import { useGeo } from "@/lib/ui/geo";
import { GeoStatus } from "@/lib/ui/geo-status";
import { Konfirmasi } from "./konfirmasi";
import { Ringkasan, type LangkahTersimpan } from "./ringkasan";

interface Shot {
  capture: Capture;
  url: string;
}

type Step =
  | { name: "membuka" }
  | { name: "gagal_sesi"; message: string }
  | { name: "kamera"; session: CaptureSession }
  | { name: "pratinjau"; session: CaptureSession; shot: Shot; error?: string }
  | { name: "mengirim"; session: CaptureSession; shot: Shot }
  | { name: "ditolak"; errors: ApiErrorBody[] }
  | { name: "konfirmasi"; draft: DraftAccepted; shot: Shot; claimable: Claimable[] }
  | ({ name: "tersimpan" } & LangkahTersimpan);

export function Alur({
  place,
  vantage,
  placeHref,
  vantageHref,
}: {
  place: { id: string; name: string; lat: number; lon: number };
  vantage: Vantage;
  placeHref: string;
  vantageHref: string;
}) {
  const geo = useGeo();
  const announce = useAnnounce();
  const { videoRef, state: cameraState, detail: cameraDetail, start, stop, capture } = useCamera();
  const [step, setStep] = useState<Step>({ name: "membuka" });
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const requestSession = useCallback(async () => {
    try {
      const session = await openCaptureSession(place.id, vantage);
      setStep({ name: "kamera", session });
    } catch (e) {
      setStep({
        name: "gagal_sesi",
        message: e instanceof RequestFailed ? e.message : "Tidak dapat menghubungi server.",
      });
    }
  }, [place.id, vantage]);

  // E8 dipanggil begitu titik pandang diketahui, bersamaan dengan GPS yang
  // sudah berjalan sejak L7.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState terjadi setelah respons E8 datang, bukan sinkron
    void requestSession();
  }, [requestSession]);

  // Kamera hidup hanya selama langkah kamera.
  useEffect(() => {
    if (step.name === "kamera") void start();
    else stop();
  }, [step.name, start, stop]);

  // Pindah langkah memindahkan fokus ke judul langkah baru (A1). Tidak saat
  // halaman pertama dibuka — di situ h1 yang dibacakan.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step.name]);

  async function retry() {
    setStep({ name: "membuka" });
    await requestSession();
  }

  async function takePhoto() {
    if (step.name !== "kamera") return;
    const shot = await capture();
    const url = URL.createObjectURL(shot.blob);
    setStep({ name: "pratinjau", session: step.session, shot: { capture: shot, url } });
    announce("Foto diambil. Periksa hasilnya, lalu kirim untuk diperiksa, atau ambil ulang.");
  }

  function retake() {
    if (step.name !== "pratinjau") return;
    URL.revokeObjectURL(step.shot.url);
    // Token belum terpakai, jadi dipakai lagi.
    setStep({ name: "kamera", session: step.session });
  }

  async function send() {
    if (step.name !== "pratinjau") return;
    const { session, shot } = step;
    setStep({ name: "mengirim", session, shot });
    announce("Mengirim foto. Server memeriksa keasliannya sebelum menyimpan apa pun.");

    const fix = await geo.bestFresh();
    const result = await submitDraft({
      image: shot.capture.blob,
      captureToken: session.token,
      placeId: place.id,
      vantage,
      fix,
      capturedAt: shot.capture.capturedAt,
      captureMethod: "getusermedia",
    });

    if (result.kind === "rejected") {
      URL.revokeObjectURL(shot.url);
      setStep({ name: "ditolak", errors: result.errors });
      const n = result.errors.length;
      announce(
        `Pemeriksaan selesai. Kontribusi belum dapat diterima: ${n} pemeriksaan tidak lolos. ${result.errors
          .map((e) => e.message)
          .join(". ")}.`,
      );
      return;
    }
    if (result.kind === "accepted") {
      const claimable = result.draft.claimable.length > 0 ? result.draft.claimable : session.claimable;
      setStep({ name: "konfirmasi", draft: result.draft, shot, claimable });
      announce("Pemeriksaan selesai. Foto lolos. Konfirmasi apa yang terlihat; usulan sistem belum dipilih.");
      return;
    }
    const message =
      result.status === 0
        ? "Tidak dapat menghubungi server. Foto masih di sini; coba kirim lagi."
        : (result.error?.message ?? `Server menjawab galat ${result.status}.`);
    setStep({ name: "pratinjau", session, shot, error: message });
    announce(message, "assertive");
  }

  function onSaved(changes: StateChange[], sent: ConfirmItem[], corrected: number) {
    if (step.name === "konfirmasi") URL.revokeObjectURL(step.shot.url);
    const seconds = Math.round((Date.now() - geo.startedAt) / 1000);
    setStep({ name: "tersimpan", changes, sent, corrected, seconds });
    announce(`Tersimpan. ${sent.length} jawaban tercatat dari foto ini.`);
  }

  // ── Render per langkah ────────────────────────────────────────────────────

  if (step.name === "membuka") {
    return (
      <p role="status" className="text-card">
        Membuka sesi kamera…
      </p>
    );
  }

  if (step.name === "gagal_sesi") {
    return (
      <section aria-labelledby="judul-langkah" className="space-y-4">
        <h2 id="judul-langkah" ref={heading} tabIndex={-1} className="text-section">
          Sesi kamera tidak dapat dibuka
        </h2>
        <p>{step.message}</p>
        <div className="flex flex-wrap gap-3">
          <Button large onClick={retry}>
            Coba lagi
          </Button>
          <ButtonLink large variant="sekunder" href={vantageHref}>
            Kembali
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (step.name === "ditolak") {
    return (
      <RejectionView
        errors={step.errors}
        headingRef={heading}
        onRetry={retry}
        backHref={vantageHref}
      />
    );
  }

  if (step.name === "konfirmasi") {
    return (
      <Konfirmasi
        heading={heading}
        draft={step.draft}
        claimable={step.claimable}
        photoUrl={step.shot.url}
        placeName={place.name}
        vantage={vantage}
        placeHref={placeHref}
        onSaved={onSaved}
      />
    );
  }

  if (step.name === "tersimpan") {
    return <Ringkasan heading={heading} step={step} placeHref={placeHref} vantageHref={vantageHref} />;
  }

  // L8 — kamera, pratinjau, mengirim.
  const problem = step.name === "kamera" ? CAMERA_PROBLEM[cameraState] : undefined;
  const shot = step.name === "pratinjau" || step.name === "mengirim" ? step.shot : null;

  return (
    <section aria-labelledby="judul-langkah" className="space-y-4">
      <h2 id="judul-langkah" ref={heading} tabIndex={-1} className="text-section">
        {shot ? "Periksa foto sebelum dikirim" : `Ambil foto ${VANTAGE_LABEL[vantage].toLowerCase()}`}
      </h2>
      <p className="rounded-md border border-line-control bg-surface-alt p-3 text-meta">
        Arahkan kamera ke pintu, tangga, dan trotoar, bukan ke orang. Foto bukti tampil publik di jejak audit.
      </p>
      <GeoStatus compact />

      {problem ? (
        <div role="alert" className="space-y-1 rounded-md border-2 border-tidak-line bg-tidak-fill p-4 text-tidak-ink">
          <p className="font-semibold">{problem.title}</p>
          <p>{problem.body}</p>
          {cameraDetail ? <p className="font-mono text-meta">{cameraDetail}</p> : null}
        </div>
      ) : null}

      <video
        ref={videoRef}
        playsInline
        muted
        aria-label={`Pratinjau kamera. Arahkan ke ${VANTAGE_LABEL[vantage].toLowerCase()}, lalu tekan Ambil foto.`}
        className={
          step.name === "kamera" && cameraState === "live"
            ? "block max-h-[45vh] w-full rounded-md bg-ink object-contain"
            : "hidden"
        }
      />
      {shot ? (
        // eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal (blob:)
        <img
          src={shot.url}
          alt={`Foto ${VANTAGE_LABEL[vantage].toLowerCase()} ${place.name} yang baru diambil`}
          className="max-h-[45vh] w-full rounded-md border border-line object-contain"
        />
      ) : null}

      {step.name === "pratinjau" && step.error ? (
        <p role="alert" className="rounded-md border-2 border-tidak-line bg-tidak-fill p-3 font-semibold text-tidak-ink">
          {step.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step.name === "kamera" ? (
          <>
            {cameraState === "live" || cameraState === "starting" || cameraState === "idle" ? (
              <Button large onClick={takePhoto} loading={cameraState !== "live"} loadingText="Membuka kamera…">
                Ambil foto
              </Button>
            ) : (
              <Button large onClick={() => void start()}>
                Buka kamera lagi
              </Button>
            )}
            <ButtonLink large variant="sekunder" href={vantageHref}>
              Kembali
            </ButtonLink>
          </>
        ) : (
          <>
            <Button large onClick={send} loading={step.name === "mengirim"} loadingText="Memeriksa foto…">
              Kirim untuk diperiksa
            </Button>
            <Button large variant="sekunder" onClick={retake} disabled={step.name === "mengirim"}>
              Ambil ulang
            </Button>
          </>
        )}
      </div>

      {step.name === "kamera" ? <p className="text-meta">{VANTAGE_HINT[vantage]}</p> : null}

      {step.name === "mengirim" ? (
        <p className="text-meta">
          Server memeriksa sesi, waktu, lokasi, asal berkas, dan foto berulang. Kalau ada yang tidak lolos, semua
          alasannya ditampilkan sekaligus.
        </p>
      ) : null}
    </section>
  );
}
