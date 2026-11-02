"use client";

import type { RefObject } from "react";
import {
  NOT_VISIBLE,
  type ConfirmItem,
  type StateChange,
} from "@/lib/ui/api/types";
import { ButtonLink } from "@/lib/ui/button";
import { attributeLabel, valueOption, valueSentence } from "@/lib/ui/copy";

export interface LangkahTersimpan {
  changes: StateChange[];
  sent: ConfirmItem[];
  corrected: number;
  seconds: number;
}

/** L11 — ringkasan perubahan setelah konfirmasi berhasil. */
export function Ringkasan({
  heading,
  step,
  placeHref,
  vantageHref,
}: {
  heading: RefObject<HTMLHeadingElement | null>;
  step: LangkahTersimpan;
  placeHref: string;
  vantageHref: string;
}) {
  const notVisible = step.sent.filter((s) => s.confirmed_value === NOT_VISIBLE);

  return (
    <section aria-labelledby="judul-langkah" className="space-y-6">
      <div className="space-y-2">
        <h2 id="judul-langkah" ref={heading} tabIndex={-1} className="text-section">
          Tersimpan
        </h2>
        <p>
          {step.sent.length} jawaban tercatat dari foto ini
          {step.corrected > 0 ? `, ${step.corrected} di antaranya mengoreksi usulan sistem` : ""}.
        </p>
        <p className="text-meta text-ink-muted">
          Waktu dari memilih titik pandang sampai tersimpan: {step.seconds} detik.
        </p>
      </div>

      {step.changes.length > 0 ? (
        <ul className="space-y-3">
          {step.changes.map((c) => {
            const before = c.before?.current_value ?? null;
            const after = c.after.current_value;
            const kind = before === null ? "baru" : before === after ? "sama" : "berbeda";
            return (
              <li key={c.attribute_code} className="space-y-1 rounded-md border border-line p-4">
                <h3 className="text-card">{attributeLabel(c.attribute_code, c.label)}</h3>
                <p>{valueSentence(c.attribute_code, after)}</p>
                <p className="text-meta">
                  {kind === "baru"
                    ? "Baru tercatat. Sebelumnya belum ada bukti."
                    : kind === "sama"
                      ? c.after.corroboration_count > 1
                        ? `Menguatkan nilai yang sama. Sekarang dikuatkan ${c.after.corroboration_count} kontributor berbeda.`
                        : "Sama dengan nilai yang sudah tercatat."
                      : `Berbeda dari catatan sebelumnya (${valueOption(c.attribute_code, before).toLowerCase()}). ${
                          c.after.is_disputed ? "Kondisi ini ditandai bersengketa, dan keduanya tetap ditampilkan." : ""
                        }`}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {notVisible.length > 0 ? (
        <p className="text-meta">
          Dicatat sebagai tidak terlihat dari foto ini, tanpa mengubah nilai berlaku:{" "}
          {notVisible.map((s) => attributeLabel(s.attribute_code).toLowerCase()).join(", ")}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <ButtonLink large href={placeHref}>
          Lihat laporan tempat
        </ButtonLink>
        <ButtonLink large variant="sekunder" href={vantageHref}>
          Kirim foto dari titik pandang lain
        </ButtonLink>
      </div>
      <p className="text-meta text-ink-muted">Setiap perubahan tercatat di jejak audit tiap kondisi.</p>
    </section>
  );
}
