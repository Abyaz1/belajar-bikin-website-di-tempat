/**
 * Tampilan hasil pemeriksaan keaslian. Dipakai di layar penolakan (L9),
 * konfirmasi (L10, keadaan "ditandai"), dan jejak audit (L6).
 */

import type { RefObject } from "react";
import type { ApiErrorBody, CheckOutcome } from "./api/types";
import { ButtonLink, Button } from "./button";
import {
  CHECK_RESULT_LABEL,
  REASON_MESSAGE,
  REASON_NEXT,
  angka,
  checkLabel,
  measuredNumber,
  measuredSentence,
  reasonOf,
} from "./copy";
import { IconFlag, IconOctagonBar } from "./icons";

function sentence(s: string) {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Satu blok per alasan: kalimat penjelas · nilai terukur dan ambang · kode. */
export function ReasonBlock({ error }: { error: ApiErrorBody }) {
  const reason = reasonOf(error.code);
  const message = error.message || (reason ? REASON_MESSAGE[reason] : error.code);
  const measured = measuredSentence(error.code, error.measured, error.threshold);
  return (
    <li className="space-y-1 rounded-md border-2 border-tidak-line bg-tidak-fill p-4 text-tidak-ink">
      <p className="flex items-start gap-2 font-semibold">
        <IconOctagonBar />
        <span>{sentence(message)}</span>
      </p>
      {measured ? <p>{measured}</p> : null}
      <p>
        <code className="font-mono text-label">{error.code.toLowerCase()}</code>
      </p>
    </li>
  );
}

/**
 * L9 — layar terpenting di produk. Ini yang dilihat juri saat mencoba
 * mengelabui sistem. Susunan: judul · satu blok per alasan · apa yang bisa
 * dilakukan · "Ambil ulang" / "Kembali".
 */
export function RejectionView({
  errors,
  headingRef,
  onRetry,
  retrying,
  backHref,
  backLabel = "Kembali",
}: {
  errors: ApiErrorBody[];
  headingRef?: RefObject<HTMLHeadingElement | null>;
  onRetry?: () => void;
  retrying?: boolean;
  backHref: string;
  backLabel?: string;
}) {
  const n = errors.length;
  const count = n === 1 ? "Satu pemeriksaan" : `${capitalize(angka(n))} pemeriksaan`;
  const next = [...new Set(errors.map((e) => reasonOf(e.code)).filter((r) => r !== null))].map((r) => REASON_NEXT[r]);

  return (
    <section aria-labelledby="judul-penolakan" className="space-y-6">
      <div className="space-y-2">
        <h2 id="judul-penolakan" ref={headingRef} tabIndex={-1} className="text-screen">
          Kontribusi belum dapat diterima
        </h2>
        <p>
          {n > 0 ? `${count} tidak lolos.` : "Server menolak kiriman ini."} Fotonya tidak disimpan sebagai data
          lokasi, tapi catatan pemeriksaannya tersimpan dan bisa dilihat siapa pun.
        </p>
      </div>

      <ul className="space-y-3">
        {errors.map((e, i) => (
          <ReasonBlock key={`${e.code}-${i}`} error={e} />
        ))}
      </ul>

      {next.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-card">Yang bisa dilakukan sekarang</h3>
          <ul className="list-disc space-y-1 ps-6">
            {next.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {onRetry ? (
          <Button large onClick={onRetry} loading={retrying} loadingText="Membuka sesi kamera baru…">
            Ambil ulang
          </Button>
        ) : null}
        <ButtonLink large variant="sekunder" href={backHref}>
          {backLabel}
        </ButtonLink>
      </div>
    </section>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Kalimat untuk pemeriksaan yang DITANDAI: diterima, tapi tandanya dicatat. */
function flagSentence(c: CheckOutcome): string {
  const reason = reasonOf(c.code);
  if (reason === "GEO_TOO_FAR")
    return `Jarak terukur ${measuredNumber(c.measured) ?? "?"} meter, lebih jauh dari radius lolos ${measuredNumber(c.threshold) ?? "?"} meter tapi masih di bawah batas tolak.`;
  if (reason === "DUPLICATE_IMAGE")
    return `Foto ini mirip foto kontributor lain dari titik pandang yang sama (Hamming ${measuredNumber(c.measured) ?? "?"}). Itu wajar untuk penguatan; tandanya tetap dicatat.`;
  return measuredSentence(c.code, c.measured, c.threshold) ?? checkLabel(c.code);
}

export function FlagNotice({ checks }: { checks: CheckOutcome[] }) {
  const flagged = checks.filter((c) => c.result === "flag");
  if (flagged.length === 0) return null;
  return (
    <div className="space-y-2 rounded-md border-2 border-line-control bg-surface-alt p-4">
      <p className="flex items-start gap-2 font-semibold">
        <IconFlag />
        <span>Bukti diterima dengan tanda</span>
      </p>
      <ul className="space-y-1">
        {flagged.map((c) => (
          <li key={c.code}>
            {checkLabel(c.code)}: {flagSentence(c)}{" "}
            <code className="font-mono text-label text-ink-muted">{c.code.toLowerCase()}</code>
          </li>
        ))}
      </ul>
      <p className="text-meta text-ink-muted">Tanda ini tercatat di jejak audit dan tidak menghalangi kontribusi.</p>
    </div>
  );
}

/** Tabel semua pemeriksaan beserta nilai terukur dan ambangnya. */
export function ChecksTable({ checks, caption }: { checks: CheckOutcome[]; caption: string }) {
  if (checks.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-meta">
        <caption className="pb-2 text-start font-semibold">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-line-control text-start">
            <th scope="col" className="py-2 pe-3 text-start">
              Pemeriksaan
            </th>
            <th scope="col" className="py-2 pe-3 text-start">
              Hasil
            </th>
            <th scope="col" className="py-2 pe-3 text-start">
              Terukur
            </th>
            <th scope="col" className="py-2 text-start">
              Ambang
            </th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.code} className="border-b border-line align-top">
              <th scope="row" className="py-2 pe-3 text-start font-normal">
                {checkLabel(c.code)} <code className="font-mono text-label text-ink-muted">{c.code}</code>
              </th>
              <td className={c.result === "fail" ? "py-2 pe-3 font-semibold text-tidak-ink" : "py-2 pe-3 font-semibold"}>
                {CHECK_RESULT_LABEL[c.result] ?? c.result}
              </td>
              <td className="py-2 pe-3">{c.measured ?? "tidak ada"}</td>
              <td className="py-2">{c.threshold ?? "tidak ada"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
