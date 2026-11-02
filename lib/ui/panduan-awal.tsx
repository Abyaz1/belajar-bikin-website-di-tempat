"use client";

/**
 * Sapaan kunjungan pertama di beranda: satu tampilan ringkas dan ramah.
 * Tampil sekali. Setelah ditutup dengan cara apa pun (pilih profil, mulai
 * jelajahi, tutup, atau Esc), cookie COOKIE_PANDUAN dipasang dan server tidak
 * membukanya lagi. Penjelasan lengkap tetap tersedia di tab Cara kerja.
 *
 * Memakai <dialog> asli: fokus terkunci di dalam, Esc menutup, dan fokus
 * kembali ke halaman saat ditutup, tanpa pustaka tambahan.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { PROFILES, type ProfileCode } from "./api/types";
import { COOKIE_PANDUAN } from "./cara-kerja";
import { PROFILE_HINT, PROFILE_TITLE } from "./copy";
import { cx } from "./cx";
import { ILUSTRASI_PROFIL } from "./ilustrasi";

function tandaiSudahDilihat() {
  document.cookie = `${COOKIE_PANDUAN}=1; path=/; max-age=31536000; samesite=lax`;
}

const TOMBOL =
  "inline-flex min-h-12 items-center justify-center rounded-pill px-6 font-semibold no-underline cursor-pointer";

const POIN_RINGKAS = [
  {
    judul: "Fakta berfoto",
    isi: "Tangga, ramp, lebar pintu, dan jalur pemandu beserta tanggal fotonya.",
  },
  {
    judul: "Diperiksa keasliannya",
    isi: "Tiap foto melewati 9 pemeriksaan sebelum tampil di laporan.",
  },
  {
    judul: "Sesuai kebutuhan Anda",
    isi: "Penilaian menyesuaikan profil kebutuhan yang Anda pilih.",
  },
];

export function PanduanAwal({ terbuka, profilAktif }: { terbuka: boolean; profilAktif: ProfileCode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = ref.current;
    if (terbuka && d && !d.open) d.showModal();
  }, [terbuka]);

  function tutup() {
    ref.current?.close();
  }

  function pilih(p: ProfileCode) {
    tutup();
    router.push(`/?profil=${p}`);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="panduan-judul"
      onClose={tandaiSudahDilihat}
      className="panduan m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-ink"
    >
      <div className="space-y-6 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-block rounded-pill bg-accent px-3 py-1 text-label font-semibold text-ink">
              Selamat datang di Astara
            </span>
            <h2 id="panduan-judul" className="pt-1 text-screen">
              Kenali kondisi fisik tempat sebelum berangkat
            </h2>
          </div>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup sapaan"
            className={cx(TOMBOL, "shrink-0 px-4 text-ink underline hover:bg-surface-alt")}
          >
            Tutup
          </button>
        </div>

        <p className="text-meta text-ink-muted">
          Astara mencatat kondisi pintu masuk, lift, dan toilet fasilitas publik. Kami tidak memberi label
          &ldquo;aksesibel&rdquo; secara sepihak—setiap tempat dinilai menurut kebutuhan Anda, dan jika buktinya belum
          lengkap, kami tulis apa adanya.
        </p>

        <ul className="grid gap-3 sm:grid-cols-3">
          {POIN_RINGKAS.map((poin, i) => (
            <li key={poin.judul} className="space-y-1 rounded-md bg-surface-alt p-3.5">
              <p className="flex items-center gap-2 text-meta font-bold text-ink">
                <span
                  aria-hidden="true"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-pill bg-accent text-label font-bold"
                >
                  {i + 1}
                </span>
                {poin.judul}
              </p>
              <p className="text-label font-normal text-ink-muted">{poin.isi}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="pilih-profil-sapaan" className="space-y-3">
          <div className="space-y-0.5">
            <h3 id="pilih-profil-sapaan" className="text-card">
              Pilih profil kebutuhan Anda
            </h3>
            <p className="text-label font-normal text-ink-muted">
              Ketuk salah satu untuk langsung menyesuaikan penilaian, atau ganti kapan saja nanti.
            </p>
          </div>
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
                      "flex h-full w-full cursor-pointer items-center gap-3 rounded-lg border bg-surface p-3 text-start transition-colors hover:bg-surface-alt sm:flex-col sm:items-stretch",
                      aktif ? "border-[3px] border-action" : "border-line-control",
                    )}
                  >
                    <Ilustrasi className="w-24 shrink-0 rounded-md sm:w-full" />
                    <span className="space-y-1">
                      <span className="block text-meta font-bold">{PROFILE_TITLE[p]}</span>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Link
            href="/cara-kerja"
            onClick={tutup}
            className="inline-flex min-h-12 items-center px-2 text-meta font-semibold text-ink underline hover:text-action"
          >
            Pelajari cara kerja lengkap
          </Link>
          <button
            type="button"
            onClick={tutup}
            className={cx(TOMBOL, "bg-action text-on-brand hover:opacity-90")}
          >
            Mulai jelajahi
          </button>
        </div>
      </div>
    </dialog>
  );
}
