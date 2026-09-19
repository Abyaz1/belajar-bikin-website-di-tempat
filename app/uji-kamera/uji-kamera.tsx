"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { jarakHamming, kategori, phash, POLA_HASH, SISI } from "./phash";

type StatusGps = "koordinat" | "kosong" | "tidak ada";

type HasilFoto = {
  jenis: string;
  ukuranKb: number;
  lebar: number;
  tinggi: number;
  exif: boolean;
  gps: StatusGps;
  phash: string;
  pratinjau: string;
};

type FotoSesi = { label: string; hash: string };

type Fix = { akurasi: number; lat: number; lon: number; waktu: number; rendah: boolean };

const tidakBerlangganan = () => () => {};

// Cari tag di satu IFD TIFF; kembalikan isi field nilainya, atau null.
function cariTag(data: DataView, ifd: number, tag: number, le: boolean) {
  if (ifd + 2 > data.byteLength) return null;
  const jumlah = data.getUint16(ifd, le);
  for (let i = 0; i < jumlah; i++) {
    const entri = ifd + 2 + i * 12;
    if (entri + 12 > data.byteLength) return null;
    if (data.getUint16(entri, le) === tag) return data.getUint32(entri + 8, le);
  }
  return null;
}

// Baca segmen APP1 Exif pada JPEG. GPS dianggap "koordinat" hanya kalau IFD GPS
// (tag 0x8825) berisi GPSLatitude (tag 0x0002).
async function periksaExif(blob: Blob): Promise<{ exif: boolean; gps: StatusGps }> {
  const data = new DataView(await blob.arrayBuffer());
  if (data.byteLength < 4 || data.getUint16(0) !== 0xffd8) {
    return { exif: false, gps: "tidak ada" };
  }
  let offset = 2;
  while (offset + 4 <= data.byteLength) {
    const marker = data.getUint16(offset);
    if (marker === 0xffff) {
      offset += 1;
      continue;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda || marker === 0xffd9) break;
    const panjang = data.getUint16(offset + 2);
    if (marker === 0xffe1 && data.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      const le = data.getUint16(tiff) === 0x4949;
      const ifdGps = cariTag(data, tiff + data.getUint32(tiff + 4, le), 0x8825, le);
      if (ifdGps === null) return { exif: true, gps: "tidak ada" };
      const lintang = cariTag(data, tiff + ifdGps, 0x0002, le);
      return { exif: true, gps: lintang === null ? "kosong" : "koordinat" };
    }
    offset += 2 + panjang;
  }
  return { exif: false, gps: "tidak ada" };
}

function ukurGambar(url: string): Promise<{ lebar: number; tinggi: number }> {
  return new Promise((selesai) => {
    const img = new Image();
    img.onload = () => selesai({ lebar: img.naturalWidth, tinggi: img.naturalHeight });
    img.onerror = () => selesai({ lebar: 0, tinggi: 0 });
    img.src = url;
  });
}

// Kecilkan bertahap (separuh demi separuh) supaya tidak aliasing, lalu jadikan
// 32×32 abu-abu untuk pHash.
async function pikselAbu(blob: Blob): Promise<Float64Array> {
  const bitmap = await createImageBitmap(blob);
  let sumber: CanvasImageSource = bitmap;
  let lebar = bitmap.width;
  let tinggi = bitmap.height;
  while (lebar > SISI * 4 || tinggi > SISI * 4) {
    lebar = Math.max(SISI, Math.round(lebar / 2));
    tinggi = Math.max(SISI, Math.round(tinggi / 2));
    const antara = document.createElement("canvas");
    antara.width = lebar;
    antara.height = tinggi;
    antara.getContext("2d")?.drawImage(sumber, 0, 0, lebar, tinggi);
    sumber = antara;
  }
  const kanvas = document.createElement("canvas");
  kanvas.width = SISI;
  kanvas.height = SISI;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sumber, 0, 0, SISI, SISI);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, SISI, SISI);
  const abu = new Float64Array(SISI * SISI);
  for (let i = 0; i < abu.length; i++) {
    abu[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return abu;
}

async function analisis(blob: Blob): Promise<HasilFoto> {
  const pratinjau = URL.createObjectURL(blob);
  const [{ exif, gps }, { lebar, tinggi }, abu] = await Promise.all([
    periksaExif(blob),
    ukurGambar(pratinjau),
    pikselAbu(blob),
  ]);
  return {
    jenis: blob.type || "tidak dikenal",
    ukuranKb: Math.round(blob.size / 1024),
    lebar,
    tinggi,
    exif,
    gps,
    phash: phash(abu),
    pratinjau,
  };
}

function uraianFoto(h: HasilFoto) {
  return `${h.jenis}, ${h.lebar}×${h.tinggi} px, ${h.ukuranKb} KB, EXIF ${
    h.exif ? "ada" : "tidak ada"
  }, GPS ${h.gps}, pHash ${h.phash}`;
}

function pesanGalat(e: unknown) {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

const namaGalatGps: Record<number, string> = {
  1: "izin ditolak",
  2: "posisi tidak tersedia",
  3: "timeout",
};

const kelasTombol =
  "min-h-12 rounded-lg border-2 border-neutral-800 px-4 text-base font-semibold " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 " +
  "disabled:opacity-50";

export function UjiKamera() {
  const agen = useSyncExternalStore(tidakBerlangganan, () => navigator.userAgent, () => "");
  const aman = useSyncExternalStore(tidakBerlangganan, () => window.isSecureContext, () => false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [galatKamera, setGalatKamera] = useState<string | null>(null);
  const [hasilKamera, setHasilKamera] = useState<HasilFoto | null>(null);
  const [hasilInput, setHasilInput] = useState<HasilFoto | null>(null);
  const [fotoSesi, setFotoSesi] = useState<FotoSesi[]>([]);
  const [hashLain, setHashLain] = useState("");

  const [memantau, setMemantau] = useState(false);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [fixPertamaMs, setFixPertamaMs] = useState<number | null>(null);
  const [galatGps, setGalatGps] = useState<string | null>(null);
  const [turunKeRendah, setTurunKeRendah] = useState(false);
  const [detik, setDetik] = useState(0);

  const [pengumuman, setPengumuman] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    return () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!memantau) return;
    const mulai = performance.now();
    let adaFix = false;
    let sudahTurun = false;
    let id = 0;

    const terima = (rendah: boolean) => (pos: GeolocationPosition) => {
      adaFix = true;
      setFixPertamaMs((p) => p ?? Math.round(performance.now() - mulai));
      setFixes((f) => [
        ...f,
        {
          akurasi: pos.coords.accuracy,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          waktu: pos.timestamp,
          rendah,
        },
      ]);
    };

    // Cermin dari lib/ui/geo.tsx: kalau percobaan akurasi tinggi kehabisan waktu
    // tanpa satu pun fix, turun ke akurasi rendah TANPA batas waktu dan terus
    // memantau. Tanpa ini halaman diagnostik lebih ketat daripada alur
    // kontribusi yang seharusnya diwakilinya, dan melaporkan "0 fix" untuk
    // keadaan yang sebetulnya berhasil di alur sungguhan — persis yang terjadi
    // pada uji perangkat pertama 18 September.
    const galat = (e: GeolocationPositionError) => {
      if (e.code === e.TIMEOUT && !adaFix && !sudahTurun) {
        sudahTurun = true;
        setTurunKeRendah(true);
        setGalatGps(null);
        navigator.geolocation.clearWatch(id);
        id = navigator.geolocation.watchPosition(terima(true), galat, {
          enableHighAccuracy: false,
          maximumAge: 0,
        });
        return;
      }
      // Timeout sesudah ada fix diabaikan: pantauan tetap berjalan.
      if (e.code === e.TIMEOUT && adaFix) return;
      setGalatGps(`${namaGalatGps[e.code] ?? "galat"}: ${e.message}`);
    };

    id = navigator.geolocation.watchPosition(terima(false), galat, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    });
    const jam = setInterval(() => setDetik(Date.now()), 1000);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(jam);
    };
  }, [memantau]);

  function catatFoto(sumber: string, hash: string) {
    setFotoSesi((d) => [...d, { label: `${d.length + 1}. ${sumber}`, hash }]);
  }

  async function nyalakanKamera() {
    setGalatKamera(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setGalatKamera("getUserMedia tidak tersedia di browser ini (butuh HTTPS)");
      return;
    }
    try {
      setStream(
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        }),
      );
      setPengumuman("Kamera menyala");
    } catch (e) {
      setGalatKamera(pesanGalat(e));
      setPengumuman(`Kamera gagal: ${pesanGalat(e)}`);
    }
  }

  async function ambilFoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const kanvas = document.createElement("canvas");
    kanvas.width = video.videoWidth;
    kanvas.height = video.videoHeight;
    kanvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return;
    try {
      const hasil = await analisis(blob);
      setHasilKamera(hasil);
      catatFoto("getUserMedia", hasil.phash);
      setPengumuman(`Foto getUserMedia: ${uraianFoto(hasil)}`);
    } catch (e) {
      setPengumuman(`Foto gagal dianalisis: ${pesanGalat(e)}`);
    }
  }

  async function pilihFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const hasil = await analisis(file);
      setHasilInput(hasil);
      catatFoto("input capture", hasil.phash);
      setPengumuman(`Foto input capture: ${uraianFoto(hasil)}`);
    } catch (galat) {
      setPengumuman(`Foto gagal dianalisis: ${pesanGalat(galat)}`);
    }
  }

  function mulaiPantau() {
    if (!("geolocation" in navigator)) {
      setGalatGps("Geolocation tidak tersedia di browser ini");
      return;
    }
    setFixes([]);
    setFixPertamaMs(null);
    setGalatGps(null);
    setDetik(0);
    setTurunKeRendah(false);
    setMemantau(true);
    setPengumuman("Pemantauan lokasi dimulai");
  }

  const terakhir = fixes.at(-1);
  const terbaik = fixes.length ? Math.min(...fixes.map((f) => f.akurasi)) : null;
  const umurFix = terakhir && detik ? Math.max(0, Math.round((detik - terakhir.waktu) / 1000)) : null;

  const hashLainBersih = hashLain.trim().toLowerCase();
  const hashLainSah = POLA_HASH.test(hashLainBersih);
  const semuaJarak = [
    ...fotoSesi.flatMap((a, i) =>
      fotoSesi.slice(i + 1).map((b, k) => ({
        label: `Foto ${i + 1} ↔ foto ${i + k + 2}`,
        jarak: jarakHamming(a.hash, b.hash),
      })),
    ),
    ...(hashLainSah
      ? fotoSesi.map((f, i) => ({
          label: `HP lain ↔ foto ${i + 1}`,
          jarak: jarakHamming(hashLainBersih, f.hash),
        }))
      : []),
  ];

  const statusKamera = galatKamera
    ? `gagal (${galatKamera})`
    : hasilKamera
      ? "jalan"
      : stream
        ? "menyala, belum ambil foto"
        : "belum dicoba";

  const ringkasan = [
    `Perangkat: ${agen}`,
    `HTTPS: ${aman ? "ya" : "tidak"}`,
    `getUserMedia: ${statusKamera}${hasilKamera ? `; ${uraianFoto(hasilKamera)}` : ""}`,
    `Input capture: ${hasilInput ? uraianFoto(hasilInput) : "belum dicoba"}`,
    `GPS: ${fixes.length} fix, fix pertama ${fixPertamaMs ?? "-"} ms, akurasi terbaik ${
      terbaik === null ? "-" : Math.round(terbaik)
    } m, terakhir ${terakhir ? Math.round(terakhir.akurasi) : "-"} m${galatGps ? `, ${galatGps}` : ""}`,
    `pHash: ${fotoSesi.length ? fotoSesi.map((f) => `${f.label} ${f.hash}`).join("; ") : "belum ada foto"}`,
    `Jarak Hamming: ${
      semuaJarak.length ? semuaJarak.map((j) => `${j.label} = ${j.jarak} (${kategori(j.jarak)})`).join("; ") : "-"
    }`,
  ].join("\n");

  async function salinRingkasan() {
    try {
      await navigator.clipboard.writeText(ringkasan);
      setPengumuman("Ringkasan tersalin");
    } catch {
      setPengumuman("Gagal menyalin; salin manual dari kotak ringkasan");
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-8 p-4 text-base leading-normal">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase">Perkakas uji internal tim, bukan fitur produk</p>
        <h1 className="text-3xl font-bold">Uji kamera dan lokasi</h1>
        <p>
          HTTPS: <strong>{aman ? "ya" : "tidak"}</strong>
        </p>
        <p className="text-sm break-words">{agen}</p>
      </header>

      <section className="space-y-3" aria-labelledby="judul-gum">
        <h2 id="judul-gum" className="text-xl font-bold">1. Kamera dalam halaman (getUserMedia)</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={kelasTombol} onClick={nyalakanKamera}>
            Nyalakan kamera
          </button>
          <button type="button" className={kelasTombol} onClick={ambilFoto} disabled={!stream}>
            Ambil foto
          </button>
          <button type="button" className={kelasTombol} onClick={() => setStream(null)} disabled={!stream}>
            Matikan kamera
          </button>
        </div>
        <video
          ref={videoRef}
          className="w-full rounded-lg border bg-neutral-100"
          playsInline
          muted
          aria-label="Pratinjau kamera"
        />
        <p>Status: {statusKamera}</p>
        {hasilKamera && <Pratinjau hasil={hasilKamera} alt="Foto dari getUserMedia" />}
      </section>

      <section className="space-y-3" aria-labelledby="judul-input">
        <h2 id="judul-input" className="text-xl font-bold">2. Kamera bawaan (input capture)</h2>
        <label className="block space-y-2">
          <span className="block font-semibold">Ambil foto dengan kamera HP</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pilihFile}
            className="block w-full text-base"
          />
        </label>
        {hasilInput && <Pratinjau hasil={hasilInput} alt="Foto dari input capture" />}
      </section>

      <section className="space-y-3" aria-labelledby="judul-gps">
        <h2 id="judul-gps" className="text-xl font-bold">3. Akurasi lokasi</h2>
        <p>
          Dua tahap, sama persis dengan alur kontribusi: akurasi tinggi dulu selama 20 detik, dan
          kalau tidak ada satu pun fix, turun sendiri ke akurasi rendah tanpa batas waktu. Tahap
          kedua memakai WiFi dan menara seluler, jadi ia bekerja di dalam gedung ketika GPS satelit
          tidak dapat apa-apa — nyalakan WiFi walau tidak tersambung ke jaringan mana pun. Kontrak
          §7: akurasi di atas 150 m ditolak C6, dan radius efektif C7 adalah min(75 + akurasi, 120).
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={kelasTombol} onClick={mulaiPantau} disabled={memantau}>
            Mulai pantau
          </button>
          <button type="button" className={kelasTombol} onClick={() => setMemantau(false)} disabled={!memantau}>
            Berhenti
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt>Jumlah fix</dt>
          <dd>{fixes.length}</dd>
          <dt>Fix pertama</dt>
          <dd>{fixPertamaMs === null ? "-" : `${fixPertamaMs} ms`}</dd>
          <dt>Akurasi terakhir</dt>
          <dd>{terakhir ? `${Math.round(terakhir.akurasi)} m` : "-"}</dd>
          <dt>Akurasi terbaik</dt>
          <dd>{terbaik === null ? "-" : `${Math.round(terbaik)} m`}</dd>
          <dt>Umur fix terakhir</dt>
          <dd>{umurFix === null ? "-" : `${umurFix} detik`}</dd>
          <dt>Mode pemantauan</dt>
          <dd>
            {turunKeRendah
              ? "akurasi rendah — turun sendiri setelah 20 detik tanpa fix"
              : "akurasi tinggi"}
          </dd>
          <dt>Koordinat terakhir</dt>
          <dd>{terakhir ? `${terakhir.lat.toFixed(5)}, ${terakhir.lon.toFixed(5)}` : "-"}</dd>
        </dl>
        {galatGps && <p>Galat: {galatGps}</p>}
      </section>

      <section className="space-y-3" aria-labelledby="judul-phash">
        <h2 id="judul-phash" className="text-xl font-bold">4. pHash: dua orang, pintu sama</h2>
        <p>
          Setiap foto dari bagian 1 atau 2 otomatis diberi pHash. Orang kedua memotret pintu yang
          sama dari posisinya sendiri, lalu salah satu hash ditempel di kolom bawah. Kontrak §7:
          jarak 2 ke bawah dianggap identik, 3–6 dianggap mirip.
        </p>
        {fotoSesi.length === 0 ? (
          <p>Belum ada foto.</p>
        ) : (
          <ul className="space-y-1">
            {fotoSesi.map((f) => (
              <li key={f.label}>
                {f.label}: <code className="font-mono">{f.hash}</code>
              </li>
            ))}
          </ul>
        )}
        <label className="block space-y-2">
          <span className="block font-semibold">Hash dari HP lain (16 karakter heksa)</span>
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={hashLain}
            onChange={(e) => setHashLain(e.target.value)}
            className="block min-h-12 w-full rounded-lg border-2 border-neutral-800 px-3 font-mono text-base"
          />
        </label>
        {hashLainBersih && !hashLainSah && (
          <p>Format tidak dikenali: hash harus 16 karakter 0–9 dan a–f.</p>
        )}
        {semuaJarak.length > 0 && (
          <ul className="space-y-1">
            {semuaJarak.map((j) => (
              <li key={j.label}>
                {j.label}: jarak <strong>{j.jarak}</strong> ({kategori(j.jarak)})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="judul-ringkasan">
        <h2 id="judul-ringkasan" className="text-xl font-bold">5. Ringkasan untuk dicatat</h2>
        <pre className="whitespace-pre-wrap rounded-lg border bg-neutral-100 p-3 text-sm">{ringkasan}</pre>
        <button type="button" className={kelasTombol} onClick={salinRingkasan}>
          Salin ringkasan
        </button>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {pengumuman}
      </p>
    </main>
  );
}

function Pratinjau({ hasil, alt }: { hasil: HasilFoto; alt: string }) {
  return (
    <figure className="space-y-1">
      {/* URL blob lokal; next/image tidak dipakai untuk pratinjau sementara ini. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hasil.pratinjau} alt={alt} className="max-h-48 rounded-lg border" />
      <figcaption>{uraianFoto(hasil)}</figcaption>
    </figure>
  );
}
