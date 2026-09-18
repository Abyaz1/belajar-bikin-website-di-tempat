/**
 * Layar "pilih profil dulu" yang visual: tiga kartu profil berilustrasi
 * (seluruh kartu satu sasaran tekan) dan legenda empat penilaian dalam bentuk
 * badge yang sama dengan daftar tempat.
 * Dipakai di Daftar tempat saat URL belum membawa profil.
 */

import Link from "next/link";
import { PROFILES, type ProfileCode, type Verdict } from "./api/types";
import { VerdictBadge } from "./badges";
import { PROFILE_HINT, PROFILE_TITLE } from "./copy";
import { ILUSTRASI_PROFIL } from "./ilustrasi";

const ARTI: Record<Verdict, string> = {
  tidak_dapat_diakses: "Ada hambatan tercatat untuk profil ini, misalnya anak tangga tanpa ramp.",
  dengan_catatan: "Tidak ada hambatan tercatat, tetapi ada kondisi yang perlu diperhatikan, misalnya permukaan rusak.",
  dapat_diakses: "Semua kondisi yang dinilai untuk profil ini sudah diperiksa, dan tidak ada hambatan tercatat.",
  belum_dapat_dipastikan: "Sebagian kondisi yang dinilai untuk profil ini belum diperiksa, jadi hasilnya belum bisa disimpulkan.",
};

/** Urutan legenda: dari yang terbaik ke hambatan; "belum" dipisah di bawahnya. */
const TIGA_PENILAIAN: Verdict[] = ["dapat_diakses", "dengan_catatan", "tidak_dapat_diakses"];

/** Profil contoh untuk badge legenda (badge selalu menyebut profil). */
const CONTOH: ProfileCode = "kursi_roda_manual";

export function PilihProfilVisual({ hrefs }: { hrefs: Record<ProfileCode, string> }) {
  return (
    <div className="space-y-12">
      <section aria-labelledby="judul-pilih" className="space-y-6">
        <div className="space-y-2">
          <h2 id="judul-pilih" className="text-section">
            Anda bepergian dengan apa?
          </h2>
          <p className="text-ink-muted">Penilaian selalu untuk profil tertentu. Pilih satu untuk membuka daftar.</p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {PROFILES.map((p) => {
            const Ilustrasi = ILUSTRASI_PROFIL[p];
            return (
              <li key={p} className="card-link flex overflow-hidden rounded-lg border border-line bg-surface sm:flex-col">
                <Ilustrasi className="w-32 shrink-0 self-center sm:w-full" />
                <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
                  <h3 className="text-card">
                    <Link href={hrefs[p]} className="stretch text-ink no-underline hover:underline">
                      {PROFILE_TITLE[p]}
                    </Link>
                  </h3>
                  <p className="text-meta text-ink-muted">{PROFILE_HINT[p]}</p>
                  <p className="mt-auto pt-2 text-label text-ink">
                    Lihat daftar <span aria-hidden="true">›</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Legenda memakai badge yang SAMA dengan daftar tempat, supaya yang
          dipelajari di sini persis yang nanti ditemui. "Belum dapat
          dipastikan" dipisah: ia bukan tingkat keempat, tapi tanda belum ada
          bukti. */}
      <section aria-labelledby="judul-arti" className="space-y-6 rounded-lg bg-surface p-6 md:p-8">
        <div className="space-y-2">
          <h2 id="judul-arti" className="text-section">
            Cara membaca penilaian
          </h2>
          <p className="text-ink-muted">
            Label yang sama muncul di setiap tempat pada daftar. Contoh di bawah untuk profil kursi roda manual.
          </p>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          {TIGA_PENILAIAN.map((v) => (
            <div key={v} className="grid gap-2 py-4 lg:grid-cols-[27rem_1fr] lg:items-center lg:gap-8">
              <dt className="min-w-0">
                <VerdictBadge verdict={v} profile={CONTOH} />
              </dt>
              <dd className="text-ink-muted">{ARTI[v]}</dd>
            </div>
          ))}
        </dl>
        {/* Puncak legenda: kejujuran "belum tahu" adalah janji inti produk,
            jadi ditaruh di Kertas Arsip, bidang yang sama dengan pernyataan
            "Kami tidak menebak" di halaman Cara kerja. */}
        <dl className="grid gap-3 rounded-md bg-accent p-5 md:p-6 lg:grid-cols-[calc(27rem-1.5rem)_1fr] lg:items-center lg:gap-8">
          <dt className="min-w-0">
            <VerdictBadge verdict="belum_dapat_dipastikan" profile={CONTOH} />
          </dt>
          <dd className="space-y-1">
            <p className="text-card font-bold text-ink">Kami tidak menebak.</p>
            <p className="text-ink">{ARTI.belum_dapat_dipastikan}</p>
          </dd>
        </dl>
        <Link
          href="/profil"
          className="inline-flex min-h-12 items-center gap-2 rounded-pill border-2 border-line-control bg-surface px-5 font-semibold text-ink no-underline hover:border-brand hover:bg-surface-alt"
        >
          Lihat aturan tiap profil <span aria-hidden="true">›</span>
        </Link>
      </section>
    </div>
  );
}
