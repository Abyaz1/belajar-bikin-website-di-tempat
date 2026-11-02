"use client";

import { useState, type FormEvent, type RefObject } from "react";
import { confirmDraft } from "@/lib/ui/api/client";
import type {
  Claimable,
  ConfirmItem,
  DraftAccepted,
  StateChange,
  Vantage,
} from "@/lib/ui/api/types";
import { useAnnounce } from "@/lib/ui/announcer";
import { Button, ButtonLink } from "@/lib/ui/button";
import { ChecksTable, FlagNotice } from "@/lib/ui/checks";
import { AttributeChoice, EMPTY_CHOICE, optionsFor, resolveChoice, type ChoiceValue } from "@/lib/ui/choice";
import {
  ATTRIBUTE,
  ATTRIBUTE_ORDER,
  VANTAGE_LABEL,
  attributeLabel,
} from "@/lib/ui/copy";

const REQUIRED_MISSING = "Pilih salah satu. Kalau tidak terlihat di foto, pilih “Tidak terlihat dari sini”.";

/** L10 — konfirmasi usulan sistem atas atribut titik pandang. */
export function Konfirmasi({
  heading,
  draft,
  claimable,
  photoUrl,
  placeName,
  vantage,
  placeHref,
  onSaved,
}: {
  heading: RefObject<HTMLHeadingElement | null>;
  draft: DraftAccepted;
  claimable: Claimable[];
  photoUrl: string;
  placeName: string;
  vantage: Vantage;
  placeHref: string;
  onSaved: (changes: StateChange[], sent: ConfirmItem[], corrected: number) => void;
}) {
  const announce = useAnnounce();
  const [values, setValues] = useState<Record<string, ChoiceValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ordered = [...claimable].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      ATTRIBUTE_ORDER.indexOf(a.attribute_code) - ATTRIBUTE_ORDER.indexOf(b.attribute_code),
  );
  const suggestionFor = (code: string) => draft.suggestions.find((s) => s.attribute_code === code) ?? null;
  const anyActive = draft.suggestions.some((s) => s.active);
  const modelDown =
    draft.model_status === "failed" || draft.model_status === "timeout" || (!draft.model_status && !anyActive);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const items: ConfirmItem[] = [];
    const errs: Record<string, string> = {};
    for (const c of ordered) {
      const code = c.attribute_code;
      const r = resolveChoice(code, values[code] ?? EMPTY_CHOICE);
      if (r === null) {
        if (c.required) errs[code] = REQUIRED_MISSING;
        continue;
      }
      if ("error" in r) {
        errs[code] = r.error;
        continue;
      }
      items.push({ attribute_code: code, confirmed_value: r.value });
    }
    setErrors(errs);
    const bad = Object.keys(errs);
    if (bad.length > 0) {
      document.getElementById(`atribut-${bad[0]}`)?.focus();
      announce(`${bad.length} isian perlu dilengkapi sebelum dikirim.`, "assertive");
      return;
    }

    setSaving(true);
    setSubmitError(null);
    const res = await confirmDraft(draft.draft_id, items);
    setSaving(false);
    if (res.kind === "saved") {
      const corrected = items.filter((i) => {
        const s = suggestionFor(i.attribute_code);
        return s?.active && s.value !== null && s.value !== i.confirmed_value;
      }).length;
      onSaved(res.changes, items, corrected);
      return;
    }
    const message =
      res.status === 0
        ? "Tidak dapat menghubungi server. Pilihan Anda masih di sini; coba simpan lagi."
        : res.status === 409
          ? "Kiriman ini sudah dikonfirmasi sebelumnya atau tidak ditemukan. Tidak ada yang disimpan dua kali."
          : res.status === 422
            ? "Kiriman ini sudah ditolak pemeriksaan dan tidak bisa dikonfirmasi."
            : (res.error?.message ?? `Server menolak konfirmasi (${res.status}).`);
    setSubmitError(message);
    announce(message, "assertive");
  }

  return (
    <section aria-labelledby="judul-langkah" className="space-y-6">
      <div className="space-y-2">
        <h2 id="judul-langkah" ref={heading} tabIndex={-1} className="text-section">
          Konfirmasi apa yang terlihat
        </h2>
        <p>
          Foto lolos pemeriksaan. Jawab sesuai foto ini saja. Usulan sistem ditandai, tapi tidak pernah dipilih untuk
          Anda. Nilai baru tersimpan setelah Anda memilihnya sendiri.
        </p>
      </div>

      <FlagNotice checks={draft.checks} />

      {modelDown ? (
        <p className="rounded-md border border-line-control bg-surface-alt p-3">
          Usulan sistem tidak tersedia untuk foto ini
          {draft.model_status === "timeout" ? " (melewati batas 8 detik)" : ""}. Isi sesuai yang Anda lihat; alur ini
          sengaja tidak bergantung pada model.
        </p>
      ) : draft.model_status === "off" ? (
        <p className="rounded-md border border-line-control bg-surface-alt p-3">
          Usulan sistem sedang dimatikan. Isi sesuai yang Anda lihat.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal (blob:) */}
        <img
          src={photoUrl}
          alt={`Foto ${VANTAGE_LABEL[vantage].toLowerCase()} ${placeName} yang baru dikirim`}
          className="h-40 w-full max-w-xs rounded-md border border-line object-cover"
        />
        <details className="min-w-0 flex-1 basis-64">
          <summary className="inline-flex min-h-12 cursor-pointer items-center font-semibold text-action underline">
            Lihat hasil tiap pemeriksaan
          </summary>
          <ChecksTable checks={draft.checks} caption="Hasil pemeriksaan keaslian foto ini" />
        </details>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        {ordered.map((c) => {
          const code = c.attribute_code;
          const s = suggestionFor(code);
          return (
            <AttributeChoice
              key={code}
              code={code}
              question={ATTRIBUTE[code]?.question ?? attributeLabel(code)}
              required={c.required}
              options={optionsFor(code, c.allowed_values)}
              value={values[code] ?? EMPTY_CHOICE}
              onChange={(v) => {
                setValues((prev) => ({ ...prev, [code]: v }));
                if (errors[code])
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next[code];
                    return next;
                  });
              }}
              suggestion={s}
              modelNote={
                s && !s.active
                  ? "Usulan sistem dimatikan untuk kondisi ini karena ketepatannya belum lolos ambang."
                  : null
              }
              error={errors[code] ?? null}
            />
          );
        })}

        {submitError ? (
          <p role="alert" className="rounded-md border-2 border-tidak-line bg-tidak-fill p-3 font-semibold text-tidak-ink">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" large loading={saving} loadingText="Menyimpan…">
            Simpan jawaban saya
          </Button>
          <ButtonLink large variant="teks" href={placeHref}>
            Batal, kembali ke laporan tempat
          </ButtonLink>
        </div>
      </form>
    </section>
  );
}
