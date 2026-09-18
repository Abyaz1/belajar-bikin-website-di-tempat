"use client";

/**
 * Kamera dalam aplikasi: getUserMedia → kanvas → JPEG.
 *
 * Kenapa bukan <input capture>: berkas hasil penyandian ulang kanvas tidak
 * pernah membawa EXIF. Karena itu "ada EXIF" jadi sinyal tajam bahwa berkas
 * datang dari galeri (FILE_METADATA_PRESENT). Dengan input capture, foto yang
 * SAH pun umumnya membawa EXIF, dan seluruh aturan itu harus diubah.
 *
 * Diputuskan di 00-KONTRAK §10 (18 Sep 2026): getUserMedia jalan di 3/3 HP
 * Android tanpa EXIF, sedangkan input capture membawa EXIF di 3/3 dengan tag
 * GPS yang tidak konsisten. iPhone (Safari) belum diuji.
 *
 * Yang TIDAK dijamin: bahwa bitnya benar dari kamera. Kamera virtual tetap bisa.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaptureLimits } from "./capture-config";

export type CameraState =
  | "idle"
  | "starting"
  | "live"
  | "denied"
  | "notfound"
  | "insecure"
  | "unsupported"
  | "error";

/** Nilai kontrak (00-KONTRAK §7) bila halaman tidak meneruskan batas dari env. */
const BATAS_KONTRAK: CaptureLimits = { maxEdgePx: 1600, uploadMaxBytes: 5 * 1024 * 1024 };
const CAPTURE_QUALITY = 0.85;

export interface Capture {
  blob: Blob;
  /** Ukuran berkas yang dikirim, setelah sisi terpanjang dibatasi 1600 px. */
  width: number;
  height: number;
  /** Ukuran asli aliran kamera. Kalau di bawah 1600, berkasnya juga di bawah
   *  1600 — kanvas tidak pernah memperbesar. */
  sourceWidth: number;
  sourceHeight: number;
  /** Waktu tombol ditekan, jam perangkat. Dikirim sebagai client_captured_at. */
  capturedAt: Date;
}

export function useCamera(limits: CaptureLimits = BATAS_KONTRAK) {
  const { maxEdgePx, uploadMaxBytes } = limits;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    setDetail(null);
    // getUserMedia hanya ada di secure context: https:// atau localhost di
    // mesin itu sendiri. HP lain yang membuka http://192.168.x.x tidak akan
    // pernah dapat kamera.
    if (!window.isSecureContext) {
      setState("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      stop();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setState("live");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setState("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setState("notfound");
      else {
        setState("error");
        setDetail(name || String(err));
      }
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  const capture = useCallback(async (): Promise<Capture> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) throw new Error("Kamera belum siap.");
    const capturedAt = new Date();
    const scale = Math.min(1, maxEdgePx / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(video, 0, 0, width, height);

    let quality = CAPTURE_QUALITY;
    let blob = await toJpeg(canvas, quality);
    while (blob.size > uploadMaxBytes && quality > 0.5) {
      quality -= 0.1;
      blob = await toJpeg(canvas, quality);
    }
    return { blob, width, height, sourceWidth: video.videoWidth, sourceHeight: video.videoHeight, capturedAt };
  }, [maxEdgePx, uploadMaxBytes]);

  return { videoRef, state, detail, start, stop, capture };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal menyandikan foto."))),
      "image/jpeg",
      quality,
    ),
  );
}

/** Kalimat untuk tiap keadaan gagal. Hambatannya disebut pada perangkat atau
 *  izin, bukan pada orangnya. */
export const CAMERA_PROBLEM: Partial<Record<CameraState, { title: string; body: string }>> = {
  denied: {
    title: "Izin kamera belum diberikan",
    body: "Buka pengaturan situs di peramban, izinkan kamera untuk alamat ini, lalu muat ulang halaman.",
  },
  notfound: {
    title: "Tidak ada kamera yang terdeteksi",
    body: "Perangkat ini tidak melaporkan kamera yang bisa dipakai. Kontribusi butuh kamera dalam aplikasi; galeri sengaja tidak tersedia.",
  },
  insecure: {
    title: "Kamera hanya bisa dibuka lewat alamat HTTPS",
    body: "Peramban menolak memberi akses kamera di alamat yang tidak aman. Buka tautan yang diawali https://.",
  },
  unsupported: {
    title: "Peramban ini tidak menyediakan kamera untuk situs",
    body: "Di iOS, kamera bekerja di Safari tetapi tidak di peramban di dalam aplikasi lain seperti Instagram atau WhatsApp. Buka tautan langsung di Safari atau Chrome.",
  },
  error: {
    title: "Kamera tidak dapat dibuka",
    body: "Tutup aplikasi lain yang sedang memakai kamera, lalu coba lagi.",
  },
};
