"use client";

/**
 * Alur kontribusi L8 → E4 → (L9 | L10 → E5 → L11).
 *
 *   L7 dibuka ─ GPS mulai dipantau (layout) ─┐
 *   layar ini dibuka ─ E8: token sekali pakai │
 *   L8 kamera ─ ambil ─ pratinjau ─ kirim E4 ─┤
 *        ├─ 422 → L9 penolakan (alasan + nilai terukur + ambang)
 *        └─ 200 → L10 konfirmasi ─ E5 → L11 ringkasan
 *
 * Klien tidak memutuskan apa pun tentang keaslian. Semua keputusan di server;
 * layar ini menampilkan jawabannya apa adanya.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { confirmDraft, openCaptureSession, RequestFailed, submitDraft } from "@/lib/ui/api/client";
import {
  NOT_VISIBLE,
  type ApiErrorBody,
  type CaptureSession,
  type Claimable,
  type ConfirmItem,
  type DraftAccepted,
  type StateChange,
  type Vantage,
} from "@/lib/ui/api/types";
import { useAnnounce } from "@/lib/ui/announcer";
import { Button, ButtonLink } from "@/lib/ui/button";
import { CAMERA_PROBLEM, useCamera, type Capture } from "@/lib/ui/camera";
import { ChecksTable, FlagNotice, RejectionView } from "@/lib/ui/checks";
import { AttributeChoice, EMPTY_CHOICE, optionsFor, resolveChoice, type ChoiceValue } from "@/lib/ui/choice";
import {
  ATTRIBUTE,
  ATTRIBUTE_ORDER,
  VANTAGE_HINT,
  VANTAGE_LABEL,
  attributeLabel,
  valueOption,
  valueSentence,
} from "@/lib/ui/copy";
import { useGeo } from "@/lib/ui/geo";
import { GeoStatus } from "@/lib/ui/geo-status";

interface Shot {
  capture: Capture;
  url: string;
}

type Step =
  | { name: "membuka" }
  | { name: "gagal_sesi"; message: string }
  | { name: "kamera"; session: CaptureSession }
  | { name: "pratinjau"; session: CaptureSession; shot: Shot; error?: string }
  | { name: "mengirim"; session: CaptureSession; shot: Shot }
  | { name: "ditolak"; errors: ApiErrorBody[] }
  | { name: "konfirmasi"; draft: DraftAccepted; shot: Shot; claimable: Claimable[] }
  | { name: "tersimpan"; changes: StateChange[]; sent: ConfirmItem[]; corrected: number; seconds: number };

export function Alur({
  place,
  vantage,
  placeHref,
  vantageHref,
}: {
  place: { id: string; name: string; lat: number; lon: number };
  vantage: Vantage;
  placeHref: string;
  vantageHref: string;
}) {
  const geo = useGeo();
  const announce = useAnnounce();
  const { videoRef, state: cameraState, detail: cameraDetail, start, stop, capture } = useCamera();
  const [step, setStep] = useState<Step>({ name: "membuka" });
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const requestSession = useCallback(async () => {
    try {
      const session = await openCaptureSession(place.id, vantage);
      setStep({ name: "kamera", session });
    } catch (e) {
      setStep({
        name: "gagal_sesi",
        message: e instanceof RequestFailed ? e.message : "Tidak dapat menghubungi server.",
      });
    }
  }, [place.id, vantage]);

  // E8 dipanggil begitu titik pandang diketahui, bersamaan dengan GPS yang
  // sudah berjalan sejak L7.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState terjadi setelah respons E8 datang, bukan sinkron
    void requestSession();
  }, [requestSession]);

  // Kamera hidup hanya selama langkah kamera.
  useEffect(() => {
    if (step.name === "kamera") void start();
    else stop();
  }, [step.name, start, stop]);

  // Pindah langkah memindahkan fokus ke judul langkah baru (A1). Tidak saat
  // halaman pertama dibuka — di situ h1 yang dibacakan.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step.name]);

  async function retry() {
    setStep({ name: "membuka" });
    await requestSession();
  }

  async function takePhoto() {
    if (step.name !== "kamera") return;
    const shot = await capture();
    const url = URL.createObjectURL(shot.blob);
    setStep({ name: "pratinjau", session: step.session, shot: { capture: shot, url } });
    announce("Foto diambil. Periksa hasilnya, lalu kirim untuk diperiksa, atau ambil ulang.");
  }

  function retake() {
    if (step.name !== "pratinjau") return;
    URL.revokeObjectURL(step.shot.url);
    // Token belum terpakai, jadi dipakai lagi.
    setStep({ name: "kamera", session: step.session });
  }

  async function send() {
    if (step.name !== "pratinjau") return;
    const { session, shot } = step;
    setStep({ name: "mengirim", session, shot });
    announce("Mengirim foto. Server memeriksa keasliannya sebelum menyimpan apa pun.");

    const fix = await geo.bestFresh();
    const result = await submitDraft({
      image: shot.capture.blob,
      captureToken: session.token,
      placeId: place.id,
      vantage,
      fix,
      capturedAt: shot.capture.capturedAt,
      captureMethod: "getusermedia",
    });

    if (result.kind === "rejected") {
      URL.revokeObjectURL(shot.url);
      setStep({ name: "ditolak", errors: result.errors });
      const n = result.errors.length;
      announce(
        `Pemeriksaan selesai. Kontribusi belum dapat diterima: ${n} pemeriksaan tidak lolos. ${result.errors
          .map((e) => e.message)
          .join(". ")}.`,
      );
      return;
    }
    if (result.kind === "accepted") {
      const claimable = result.draft.claimable.length > 0 ? result.draft.claimable : session.claimable;
      setStep({ name: "konfirmasi", draft: result.draft, shot, claimable });
      announce("Pemeriksaan selesai. Foto lolos. Konfirmasi apa yang terlihat; usulan sistem belum dipilih.");
      return;
    }
    const message =
      result.status === 0
        ? "Tidak dapat menghubungi server. Foto masih di sini; coba kirim lagi."
        : (result.error?.message ?? `Server menjawab galat ${result.status}.`);
    setStep({ name: "pratinjau", session, shot, error: message });
    announce(message, "assertive");
  }

  function onSaved(changes: StateChange[], sent: ConfirmItem[], corrected: number) {
    if (step.name === "konfirmasi") URL.revokeObjectURL(step.shot.url);
    const seconds = Math.round((Date.now() - geo.startedAt) / 1000);
    setStep({ name: "tersimpan", changes, sent, corrected, seconds });
    announce(`Tersimpan. ${sent.length} jawaban tercatat dari foto ini.`);
  }

  // ── Render per langkah ────────────────────────────────────────────────────

  if (step.name === "membuka") {
    return (
      <p role="status" className="text-card">
        Membuka sesi kamera…
      </p>
    );
  }

  if (step.name === "gagal_sesi") {
    return (
      <section aria-labelledby="judul-langkah" className="space-y-4">
        <h2 id="judul-langkah" ref={heading} tabIndex={-1} className="text-section">
          Sesi kamera tidak dapat dibuka
        </h2>
        <p>{step.message}</p>
        <div className="flex flex-wrap gap-3">
          <Button large onClick={retry}>
            Coba lagi
          </Button>
          <ButtonLink large variant="sekunder" href={vantageHref}>
            Kembali
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (step.name === "ditolak") {
    return (
      <RejectionView
        errors={step.errors}
        headingRef={heading}
        onRetry={retry}
        backHref={vantageHref}
      />
    );
  }

  if (step.name === "konfirmasi") {
    return (
      <Konfirmasi
        heading={heading}
        draft={step.draft}
        claimable={step.claimable}
        photoUrl={step.shot.url}
        placeName={place.name}
        vantage={vantage}
        placeHref={placeHref}
        onSaved={onSaved}
      />
    );
  }

  if (step.name === "tersimpan") {
    return <Ringkasan heading={heading} step={step} placeHref={placeHref} vantageHref={vantageHref} />;
  }

  // L8 — kamera, pratinjau, mengirim.
  const problem = step.name === "kamera" ? CAMERA_PROBLEM[cameraState] : undefined;
  const shot = step.name === "pratinjau" || step.name === "mengirim" ? step.shot : null;

  return (
    <section aria-labelledby="judul-langkah" className="space-y-4">
      <h2 id="judul-langkah" ref={heading} tabIndex={-1} className="text-section">
        {shot ? "Periksa foto sebelum dikirim" : `Ambil foto ${VANTAGE_LABEL[vantage].toLowerCase()}`}
      </h2>
      <p className="rounded-md border border-line-control bg-surface-alt p-3 text-meta">
        Arahkan kamera ke pintu, tangga, dan trotoar — bukan ke orang. Foto bukti tampil publik di jejak audit.
      </p>
      <GeoStatus compact />

      {problem ? (
        <div role="alert" className="space-y-1 rounded-md border-2 border-tidak-line bg-tidak-fill p-4 text-tidak-ink">
          <p className="font-semibold">{problem.title}</p>
          <p>{problem.body}</p>
          {cameraDetail ? <p className="font-mono text-meta">{cameraDetail}</p> : null}
        </div>
      ) : null}

      <video
        ref={videoRef}
        playsInline
        muted
        aria-label={`Pratinjau kamera. Arahkan ke ${VANTAGE_LABEL[vantage].toLowerCase()}, lalu tekan Ambil foto.`}
        className={step.name === "kamera" && cameraState === "live" ? "block max-h-[45vh] w-full rounded-md bg-ink object-contain" : "hidden"}
      />
      {shot ? (
        // eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal (blob:)
        <img
          src={shot.url}
          alt={`Foto ${VANTAGE_LABEL[vantage].toLowerCase()} ${place.name} yang baru diambil`}
          className="max-h-[45vh] w-full rounded-md border border-line object-contain"
        />
      ) : null}

      {step.name === "pratinjau" && step.error ? (
        <p role="alert" className="rounded-md border-2 border-tidak-line bg-tidak-fill p-3 font-semibold text-tidak-ink">
          {step.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step.name === "kamera" ? (
          <>
            {cameraState === "live" || cameraState === "starting" || cameraState === "idle" ? (
              <Button large onClick={takePhoto} loading={cameraState !== "live"} loadingText="Membuka kamera…">
                Ambil foto
              </Button>
            ) : (
              <Button large onClick={() => void start()}>
                Buka kamera lagi
              </Button>
            )}
            <ButtonLink large variant="sekunder" href={vantageHref}>
              Kembali
            </ButtonLink>
          </>
        ) : (
          <>
            <Button large onClick={send} loading={step.name === "mengirim"} loadingText="Memeriksa foto…">
              Kirim untuk diperiksa
            </Button>
            <Button large variant="sekunder" onClick={retake} disabled={step.name === "mengirim"}>
              Ambil ulang
            </Button>
          </>
        )}
      </div>

      {step.name === "kamera" ? <p className="text-meta">{VANTAGE_HINT[vantage]}</p> : null}

      {step.name === "mengirim" ? (
        <p className="text-meta">
          Server memeriksa sesi, waktu, lokasi, asal berkas, dan foto berulang. Kalau ada yang tidak lolos, semua
          alasannya ditampilkan sekaligus.
        </p>
      ) : null}
    </section>
  );
}

// ── L10 — konfirmasi usulan ─────────────────────────────────────────────────

const REQUIRED_MISSING = "Pilih salah satu. Kalau tidak terlihat di foto, pilih “Tidak terlihat dari sini”.";

function Konfirmasi({
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
          Anda — nilai baru tersimpan setelah Anda memilihnya sendiri.
        </p>
      </div>

      <FlagNotice checks={draft.checks} />

      {modelDown ? (
        <p className="rounded-md border border-line-control bg-surface-alt p-3">
          Usulan sistem tidak tersedia untuk foto ini
          {draft.model_status === "timeout" ? " (melewati batas 8 detik)" : ""}. Isi sesuai yang Anda lihat — alur ini
          sengaja tidak bergantung pada model.
        </p>
      ) : draft.model_status === "off" ? (
        <p className="rounded-md border border-line-control bg-surface-alt p-3">Usulan sistem sedang dimatikan. Isi sesuai yang Anda lihat.</p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal (blob:) */}
        <img
          src={photoUrl}
          alt={`Foto ${VANTAGE_LABEL[vantage].toLowerCase()} ${placeName} yang baru dikirim`}
          className="h-40 w-full max-w-xs rounded-md border border-line object-cover"
        />
        <details className="min-w-0 flex-1 basis-64">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-action underline">
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
                s && !s.active ? "Usulan sistem dimatikan untuk kondisi ini karena ketepatannya belum lolos ambang." : null
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

// ── L11 — ringkasan perubahan ───────────────────────────────────────────────

function Ringkasan({
  heading,
  step,
  placeHref,
  vantageHref,
}: {
  heading: RefObject<HTMLHeadingElement | null>;
  step: Extract<Step, { name: "tersimpan" }>;
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
                    ? "Baru tercatat — sebelumnya belum ada bukti."
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
