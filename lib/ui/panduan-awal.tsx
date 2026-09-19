"use client";

/**
 * Panduan kunjungan pertama di beranda: tiga langkah dalam satu dialog modal.
 * Tampil sekali. Setelah ditutup dengan cara apa pun (selesai, lewati, Esc),
 * cookie COOKIE_PANDUAN dipasang dan server tidak membukanya lagi. Isinya
 * tetap bisa dibaca kapan saja di tab Cara kerja.
 *
 * Memakai <dialog> asli: fokus terkunci di dalam, Esc menutup, dan fokus
 * kembali ke halaman saat ditutup, tanpa pustaka apa pun.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PROFILES, type ProfileCode } from "./api/types";
import { COOKIE_PANDUAN, LANGKAH_CARA_KERJA } from "./cara-kerja";
import { PROFILE_HINT, PROFILE_TITLE } from "./copy";
import { cx } from "./cx";
import { ILUSTRASI_PROFIL } from "./ilustrasi";

const JUMLAH_LANGKAH = 3;

function tandaiSudahDilihat() {
  document.cookie = `${COOKIE_PANDUAN}=1; path=/; max-age=31536000; samesite=lax`;
}

const TOMBOL =
  "inline-flex min-h-12 items-center justify-center rounded-pill px-6 font-semibold no-underline cursor-pointer";

export function PanduanAwal({ terbuka, profilAktif }: { terbuka: boolean; profilAktif: ProfileCode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const judulRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const [langkah, setLangkah] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (terbuka && d && !d.open) d.showModal();
  }, [terbuka]);

  // Pindah langkah = fokus ke judul langkah, supaya pembaca layar ikut.
  useEffect(() => {
    judulRef.current?.focus();
  }, [langkah]);

  function tutup() {
    ref.current?.close();
  }

  function pilih(p: ProfileCode) {
    tutup();
    router.push(`/peta?profil=${p}`);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="panduan-judul"
      onClose={tandaiSudahDilihat}
      className="panduan m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-ink"
    >
      <div className="space-y-6 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-label text-ink-muted">
            Langkah {langkah + 1} dari {JUMLAH_LANGKAH}
          </p>
          <button type="button" onClick={tutup} className={cx(TOMBOL, "px-4 text-ink underline hover:bg-surface-alt")}>
            Lewati panduan
          </button>
        </div>

        {langkah === 0 ? (
          <section className="space-y-4">
            <h2 id="panduan-judul" ref={judulRef} tabIndex={-1} className="text-screen">
              Periksa kondisi fisik sebuah tempat sebelum berangkat
            </h2>
            <p>
              Astara mencatat kondisi pintu masuk, lift, dan toilet fasilitas publik: jumlah anak tangga, ada tidaknya
              ramp, lebar pintu, jalur pemandu. Setiap catatan membawa foto, tanggal foto diambil, dan hasil pemeriksaan
              keasliannya.
            </p>
            <p className="rounded-md bg-accent px-4 py-3">
              Kami tidak menyimpan kata &ldquo;aksesibel&rdquo;. Penilaian dihitung menurut kebutuhan Anda, dan kalau
              buktinya belum ada, kami tulis belum tahu.
            </p>
          </section>
        ) : null}

        {langkah === 1 ? (
          <section className="space-y-4">
            <h2 id="panduan-judul" ref={judulRef} tabIndex={-1} className="text-screen">
              Cara kerjanya
            </h2>
            <ol className="space-y-4">
              {LANGKAH_CARA_KERJA.map((l, i) => (
                <li key={l.judul} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-12 shrink-0 items-center justify-center rounded-pill bg-accent font-bold"
                  >
                    {i + 1}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-card">{l.judul}</h3>
                    <p className="text-meta text-ink-muted">{l.isi}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {langkah === 2 ? (
          <section className="space-y-4">
            <h2 id="panduan-judul" ref={judulRef} tabIndex={-1} className="text-screen">
              Pilih profil kebutuhan
            </h2>
            <p className="text-ink-muted">Penilaian tiap tempat berbeda untuk tiap profil. Bisa diganti kapan saja.</p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {PROFILES.map((p) => {
                const Ilustrasi = ILUSTRASI_PROFIL[p];
                const aktif = p === profilAktif;
                return (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => pilih(p)}
                      aria-describedby={`petunjuk-${p}`}
                      className={cx(
                        "flex h-full w-full cursor-pointer items-center gap-3 rounded-lg border bg-surface p-3 text-start hover:bg-surface-alt sm:flex-col sm:items-stretch",
                        aktif ? "border-[3px] border-action" : "border-line-control",
                      )}
                    >
                      <Ilustrasi className="w-28 shrink-0 rounded-md sm:w-full" />
                      <span className="space-y-1">
                        <span className="block text-card">{PROFILE_TITLE[p]}</span>
                        <span id={`petunjuk-${p}`} className="block text-label font-normal text-ink-muted">
                          {PROFILE_HINT[p]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div aria-hidden="true" className="flex gap-2">
            {Array.from({ length: JUMLAH_LANGKAH }, (_, i) => (
              <span key={i} className={cx("h-2 rounded-pill", i === langkah ? "w-8 bg-action" : "w-2 bg-p2")} />
            ))}
          </div>
          <div className="flex gap-2">
            {langkah > 0 ? (
              <button
                type="button"
                onClick={() => setLangkah((l) => l - 1)}
                className={cx(TOMBOL, "border-2 border-action bg-surface text-ink hover:bg-surface-alt")}
              >
                Kembali
              </button>
            ) : null}
            {langkah < JUMLAH_LANGKAH - 1 ? (
              <button
                type="button"
                onClick={() => setLangkah((l) => l + 1)}
                className={cx(TOMBOL, "bg-action text-on-brand hover:opacity-90")}
              >
                Lanjut
              </button>
            ) : (
              <button
                type="button"
                onClick={() => pilih(profilAktif)}
                className={cx(TOMBOL, "bg-action text-on-brand hover:opacity-90")}
              >
                Buka peta
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
