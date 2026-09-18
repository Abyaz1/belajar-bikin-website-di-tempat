"use client";

/**
 * Pemantauan GPS untuk alur kontribusi — docs/30-product.md §4.
 *
 * Dimulai SAAT LAYAR PILIH TITIK PANDANG (L7) DIBUKA, bukan saat tombol kirim
 * ditekan. Di dalam gedung fix pertama bisa belasan sampai puluhan detik; kalau
 * baru diminta saat kirim, anggaran 60 detik jebol dan demo panggung menggantung.
 *
 *   mulai pantau            saat L7 dibuka (provider ini dipasang di layout rute)
 *   umur fix maks dipakai   60 detik
 *   timeout fix pertama     20 detik, lalu turun ke akurasi rendah
 *   yang dipakai            fix dengan akurasi terbaik dalam jendela umur
 *
 * Semua angka di sini dinyatakan klien. Server memeriksanya (C5, C6, C6b, C7),
 * tapi penyerang tetap bisa memalsukannya lewat API langsung.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const FIX_MAX_AGE_MS = 60_000;
const FIRST_FIX_TIMEOUT_MS = 20_000;
/** Kalau fix terbaik sudah setua ini saat kirim, minta fix baru sebentar. */
const REFRESH_IF_OLDER_MS = 30_000;

export interface Fix {
  lat: number;
  lon: number;
  /** meter, radius 95% menurut peramban */
  accuracy: number;
  /** ms epoch, dari GeolocationPosition.timestamp */
  at: number;
}

export type GeoState = "idle" | "seeking" | "fixed" | "denied" | "unavailable" | "unsupported";

interface GeoValue {
  state: GeoState;
  latest: Fix | null;
  /** true setelah fix pertama tidak datang dalam 20 detik */
  lowAccuracy: boolean;
  firstFixMs: number | null;
  /** Kapan pemantauan dimulai — juga awal pengukuran beban kontribusi. */
  startedAt: number;
  best: () => Fix | null;
  bestFresh: () => Promise<Fix | null>;
}

const noopSubscribe = () => () => {};

const GeoContext = createContext<GeoValue | null>(null);

function toFix(p: GeolocationPosition): Fix {
  return {
    lat: p.coords.latitude,
    lon: p.coords.longitude,
    accuracy: p.coords.accuracy,
    at: p.timestamp || Date.now(),
  };
}

export function GeoWatch({ children }: { children: ReactNode }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "geolocation" in navigator,
    () => true,
  );
  const [watchState, setState] = useState<GeoState>("seeking");
  const state: GeoState = supported ? watchState : "unsupported";
  const [latest, setLatest] = useState<Fix | null>(null);
  const [lowAccuracy, setLowAccuracy] = useState(false);
  const [firstFixMs, setFirstFixMs] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const fixes = useRef<Fix[]>([]);
  const lowRef = useRef(false);

  const push = useCallback(
    (fix: Fix) => {
      const now = Date.now();
      fixes.current = [...fixes.current, fix].filter((f) => now - f.at <= FIX_MAX_AGE_MS * 2);
      setLatest(fix);
      setState("fixed");
      setFirstFixMs((prev) => prev ?? now - startedAt);
    },
    [startedAt],
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    let gotFix = false;
    let watchId = navigator.geolocation.watchPosition(
      (p) => {
        gotFix = true;
        push(toFix(p));
      },
      (err) => onError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: FIRST_FIX_TIMEOUT_MS },
    );

    function onError(err: GeolocationPositionError) {
      if (err.code === err.PERMISSION_DENIED) {
        setState("denied");
        return;
      }
      // Timeout setelah ada fix diabaikan: pantauan tetap berjalan.
      if (err.code === err.TIMEOUT && !gotFix && !lowRef.current) {
        lowRef.current = true;
        setLowAccuracy(true);
        navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            gotFix = true;
            push(toFix(p));
          },
          (e) => {
            if (e.code === e.PERMISSION_DENIED) setState("denied");
            else if (!gotFix) setState("unavailable");
          },
          { enableHighAccuracy: false, maximumAge: 0 },
        );
        return;
      }
      if (!gotFix && err.code === err.POSITION_UNAVAILABLE) setState("unavailable");
    }

    return () => navigator.geolocation.clearWatch(watchId);
  }, [push]);

  const best = useCallback((): Fix | null => {
    const now = Date.now();
    const inWindow = fixes.current.filter((f) => now - f.at <= FIX_MAX_AGE_MS);
    if (inWindow.length === 0) return fixes.current.at(-1) ?? null;
    return inWindow.reduce((a, b) => (b.accuracy < a.accuracy ? b : a));
  }, []);

  const bestFresh = useCallback(async (): Promise<Fix | null> => {
    const current = best();
    if (current && Date.now() - current.at <= REFRESH_IF_OLDER_MS) return current;
    if (!("geolocation" in navigator)) return current;
    // Beberapa peramban jarang mengirim pembaruan kalau perangkat diam.
    // Minta satu fix segar, maksimal 5 detik, lalu pilih yang terbaik.
    await new Promise<void>((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => {
          push(toFix(p));
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: !lowRef.current, maximumAge: 0, timeout: 5_000 },
      ),
    );
    return best();
  }, [best, push]);

  const value = useMemo(
    () => ({ state, latest, lowAccuracy, firstFixMs, startedAt, best, bestFresh }),
    [state, latest, lowAccuracy, firstFixMs, startedAt, best, bestFresh],
  );

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo(): GeoValue {
  const value = useContext(GeoContext);
  if (!value) throw new Error("useGeo() harus dipakai di dalam <GeoWatch>.");
  return value;
}

/** Jarak Haversine dalam meter. Hanya untuk tampilan; server menghitung sendiri. */
export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
