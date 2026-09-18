/**
 * Layar "pilih profil dulu" yang visual: tiga kartu profil berilustrasi
 * (seluruh kartu satu sasaran tekan) dan panduan membaca empat penilaian.
 * Dipakai di Daftar tempat saat URL belum membawa profil.
 */

import Link from "next/link";
import { PROFILES, VERDICTS, type ProfileCode, type Verdict } from "./api/types";
import { PROFILE_HINT, PROFILE_TITLE, VERDICT_LABEL } from "./copy";
import { cx } from "./cx";
import { VERDICT_ICON } from "./icons";
import { ILUSTRASI_PROFIL } from "./ilustrasi";

const ARTI: Record<Verdict, string> = {
  tidak_dapat_diakses: "Ada hambatan tercatat untuk profil ini, misalnya anak tangga tanpa ramp.",
  dengan_catatan: "Bisa dimasuki, tetapi ada kondisi yang perlu diperhatikan.",
  dapat_diakses: "Kondisi penting untuk profil ini sudah diperiksa dan tidak ada hambatan.",
  belum_dapat_dipastikan: "Kondisi penting belum diperiksa. Kami tidak menebak.",
};

const WARNA: Record<Verdict, string> = {
  tidak_dapat_diakses: "bg-tidak-fill text-tidak-ink border-tidak-line",
  dengan_catatan: "bg-catatan-fill text-catatan-ink border-catatan-line",
  dapat_diakses: "bg-dapat-fill text-dapat-ink border-dapat-line",
  belum_dapat_dipastikan: "bg-belum-fill text-belum-ink border-belum-line",
};

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

      <section aria-labelledby="judul-arti" className="space-y-6 rounded-lg bg-surface p-6 md:p-8">
        <div className="space-y-2">
          <h2 id="judul-arti" className="text-section">
            Cara membaca penilaian
          </h2>
          <p className="text-ink-muted">
            Setiap tempat mendapat satu dari empat penilaian, selalu dengan bentuk ikon, teks, dan nama profilnya.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VERDICTS.map((v) => {
            const Icon = VERDICT_ICON[v];
            return (
              <li key={v} className={cx("flex flex-col gap-3 rounded-md border-s-[6px] bg-canvas p-4", WARNA[v].split(" ")[2])}>
                <span className={cx("inline-flex size-12 items-center justify-center rounded-pill border text-[1.5rem]", WARNA[v])}>
                  <Icon />
                </span>
                <p className="text-card">{VERDICT_LABEL[v]}</p>
                <p className="text-meta text-ink-muted">{ARTI[v]}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-meta">
          Aturan lengkap tiap profil ada di <Link href="/profil">aturan penilaian</Link>.
        </p>
      </section>
    </div>
  );
}
