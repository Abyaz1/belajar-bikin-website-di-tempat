import type { ReactNode } from "react";
import type { AttributeStatus, ProfileCode, Verdict } from "./api/types";
import { verdictWithProfile } from "./copy";
import { cx } from "./cx";
import { formatDate } from "./format";
import { IconArrowsOpposed, IconClock, IconShield, VERDICT_ICON } from "./icons";

// ── Badge penilaian ─────────────────────────────────────────────────────────
// Satu-satunya tempat warna semantik dipakai. Ikon berbentuk khas + teks +
// NAMA PROFIL: tanpa nama profil, badge terbaca sebagai penilaian mutlak.
// "Belum dapat dipastikan" bergaris putus-putus, sama dengan tepi kartu tempat
// dan penanda peta, supaya pembedanya tetap terbaca tanpa warna.

const VERDICT_CLASS: Record<Verdict, string> = {
  tidak_dapat_diakses: "text-tidak-ink bg-tidak-fill border-tidak-line",
  dengan_catatan: "text-catatan-ink bg-catatan-fill border-catatan-line",
  dapat_diakses: "text-dapat-ink bg-dapat-fill border-dapat-line",
  belum_dapat_dipastikan: "text-belum-ink bg-belum-fill border-belum-line border-dashed",
};

export function VerdictBadge({
  verdict,
  profile,
  size = "biasa",
}: {
  verdict: Verdict;
  profile: ProfileCode;
  size?: "biasa" | "besar";
}) {
  const Icon = VERDICT_ICON[verdict];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-pill border font-semibold",
        size === "besar" ? "px-4 py-2 text-card border-2" : "px-3 py-1 text-label",
        VERDICT_CLASS[verdict],
      )}
    >
      <Icon />
      {verdictWithProfile(verdict, profile)}
    </span>
  );
}

// ── Badge status bukti ──────────────────────────────────────────────────────
// SENGAJA TANPA WARNA SEMANTIK. Badge "terverifikasi" TIDAK hijau.
// Naluri semua orang akan membuatnya hijau. Tapi atribut terverifikasi bisa
// berarti "tidak ada ramp" — yang justru menghasilkan penilaian merah untuk
// kursi roda. Hijau di sini akan bertabrakan dengan badge penilaian di baris
// yang sama dan membuat pengguna membaca "aman" padahal isinya hambatan.
// Status bukti menjawab "seberapa kita tahu", bukan "baik atau buruk".
// Jangan "diperbaiki" jadi hijau.

export function EvidenceBadge({
  status,
  lastVerifiedAt,
  disputed = false,
}: {
  status: AttributeStatus;
  lastVerifiedAt: string | null;
  disputed?: boolean;
}) {
  if (disputed) {
    return (
      <Chip className="border-line-control bg-surface-alt text-ink">
        <IconArrowsOpposed />
        Bersengketa · Terakhir diperiksa {formatDate(lastVerifiedAt)}
      </Chip>
    );
  }
  if (status === "terverifikasi") {
    return (
      <Chip className="border-line-control bg-surface-alt text-ink">
        <IconShield />
        Terverifikasi · Diperiksa {formatDate(lastVerifiedAt)}
      </Chip>
    );
  }
  if (status === "perlu_ditinjau_ulang") {
    return (
      <Chip className="border-line-control bg-surface-alt text-ink">
        <IconClock />
        Perlu ditinjau ulang · Terakhir diperiksa {formatDate(lastVerifiedAt)}
      </Chip>
    );
  }
  return (
    <Chip className="border-dashed border-line-control bg-transparent text-ink-muted">
      Belum terverifikasi · Belum pernah diperiksa
    </Chip>
  );
}

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-pill border-2 px-3 py-1 text-label",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Label data demonstrasi ──────────────────────────────────────────────────
// Sistem yang menuntut bukti tidak boleh menampilkan klaim tanpa bukti,
// termasuk klaimnya sendiri. Menempel di kartu, baris atribut, dan laporan.

export function DemoLabel({ detail }: { detail?: string }) {
  return (
    <span className="demo-stripe inline-flex items-center rounded-sm bg-demo-bg px-2 py-1 text-label text-demo-ink">
      Data demonstrasi{detail ? `: ${detail}` : ""}
    </span>
  );
}
