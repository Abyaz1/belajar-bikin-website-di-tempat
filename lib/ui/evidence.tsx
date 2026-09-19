/**
 * Panel bukti (L5) dan garis waktu audit (L6).
 *
 * A8: foto bukti punya alt text yang menyebut lokasi dan atribut.
 * A9: foto bukti punya keterangan tekstual SELAIN alt text — laporan tetap
 *     utuh tanpa melihat gambar.
 */

import type { AuditEntry } from "./api/types";
import { DemoLabel } from "./badges";
import { ChecksTable } from "./checks";
import { AUDIT_ACTION_LABEL, actorLabel, valueOption } from "./copy";
import { formatDateTime, formatMeters } from "./format";

export function EvidencePanel({
  photoUrl,
  alt,
  entry,
  attributeCode,
  sentence,
}: {
  photoUrl: string | null;
  alt: string;
  /** Kejadian `evidence_submitted` terbaru yang lolos, bila ada. */
  entry: AuditEntry | null;
  attributeCode: string;
  sentence: string;
}) {
  const ev = entry?.evidence ?? null;
  const caption = [
    ev?.captured_at ? `Foto diambil ${formatDateTime(ev.captured_at)}` : entry ? `Foto dikirim ${formatDateTime(entry.at)}` : null,
    ev?.distance_to_place_m !== null && ev?.distance_to_place_m !== undefined
      ? `${formatMeters(ev.distance_to_place_m)} dari titik tempat`
      : null,
    ev?.client_accuracy_m ? `ketelitian lokasi dilaporkan perangkat ${formatMeters(ev.client_accuracy_m)}` : null,
    entry ? `oleh ${actorLabel(entry.actor)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <figure className="space-y-3 rounded-md border border-line p-4">
      {photoUrl ? (
        // Tinggi tetap supaya ruang foto sudah dipesan sebelum berkasnya tiba:
        // keterangan di bawahnya tidak melompat. Foto tegak maupun mendatar
        // muat utuh di dalamnya (object-contain).
        // eslint-disable-next-line @next/next/no-img-element -- foto bukti dari endpoint sendiri
        <img
          src={photoUrl}
          alt={alt}
          decoding="async"
          className="h-72 w-full rounded-sm border border-line bg-surface-alt object-contain md:h-96"
        />
      ) : (
        <p className="text-ink-muted">Foto bukti tidak tersedia untuk ditayangkan.</p>
      )}
      <figcaption className="space-y-1">
        {caption ? <p>{caption}.</p> : null}
        <p>
          Kontributor menyatakan: <span className="font-semibold">{sentence}</span>
        </p>
        {ev?.capture_method ? (
          <p className="text-meta text-ink-muted">
            Cara ambil menurut perangkat: <code className="font-mono">{ev.capture_method}</code>. Dicatat, bukan diperiksa,
            karena nilainya dinyatakan sendiri oleh klien.
          </p>
        ) : null}
        <p className="text-meta text-ink-muted">
          <code className="font-mono">{attributeCode}</code>
        </p>
      </figcaption>
    </figure>
  );
}

export function AuditTimeline({ entries, attributeCode }: { entries: AuditEntry[]; attributeCode: string }) {
  return (
    <ol className="space-y-0 border-s-2 border-line-control">
      {entries.map((e) => (
        <li key={e.id} className="relative space-y-2 ps-6 pb-8">
          <span aria-hidden="true" className="absolute -start-[0.4375rem] top-1 size-3 rounded-pill border-2 border-line-control bg-surface" />
          <p className="text-meta text-ink-muted">
            <time dateTime={e.at}>{formatDateTime(e.at)}</time> · {actorLabel(e.actor)}
          </p>
          <h3 className="text-card">
            {AUDIT_ACTION_LABEL[e.action] ?? e.action}{" "}
            <code className="font-mono text-label font-normal text-ink-muted">{e.action}</code>
          </h3>

          {e.action === "observation_confirmed" ? (
            <p>
              {e.ai_suggested_value
                ? `Usulan sistem: ${valueOption(attributeCode, e.ai_suggested_value).toLowerCase()}. `
                : "Tanpa usulan sistem. "}
              Dikonfirmasi kontributor: <span className="font-semibold">{valueOption(attributeCode, e.confirmed_value ?? null).toLowerCase()}</span>.
              {e.ai_suggested_value && e.confirmed_value && e.ai_suggested_value !== e.confirmed_value
                ? " Kontributor mengoreksi usulan."
                : ""}
            </p>
          ) : null}

          {e.action === "state_updated" ? (
            <p>
              Sebelumnya: {valueOption(attributeCode, e.before).toLowerCase()}. Sesudahnya:{" "}
              <span className="font-semibold">{valueOption(attributeCode, e.after).toLowerCase()}</span>.
            </p>
          ) : null}

          {e.evidence ? (
            <p className="text-meta">
              Jarak ke titik tempat {formatMeters(e.evidence.distance_to_place_m)}, ketelitian lokasi dilaporkan{" "}
              {formatMeters(e.evidence.client_accuracy_m)}
              {e.evidence.capture_method ? (
                <>
                  , cara ambil menurut perangkat <code className="font-mono">{e.evidence.capture_method}</code> (dicatat, bukan
                  diperiksa)
                </>
              ) : null}
              .
            </p>
          ) : null}

          {e.checks?.length ? <ChecksTable checks={e.checks} caption="Hasil tiap pemeriksaan" /> : null}
          {e.is_demo_seed ? <DemoLabel /> : null}
        </li>
      ))}
    </ol>
  );
}
