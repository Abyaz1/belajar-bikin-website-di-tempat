import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAudit, getPlaceFacts } from "@/lib/ui/api/server";
import { isProfile } from "@/lib/ui/api/types";
import { attributeFacts, corroborationText, photoAlt } from "@/lib/ui/attribute-row";
import { DemoLabel, EvidenceBadge } from "@/lib/ui/badges";
import { ButtonLink } from "@/lib/ui/button";
import { VANTAGE_LABEL, attributeLabel, attributeVantage, valueOption, valueSentence } from "@/lib/ui/copy";
import { EvidencePanel } from "@/lib/ui/evidence";
import { formatDate } from "@/lib/ui/format";
import { naskahAtribut } from "../../../../_bacakan/naskah";
import { TombolBacakan } from "../../../../_bacakan/tombol-bacakan";

// L5 — rincian atribut. Keadaan: terverifikasi, belum, perlu ditinjau, bersengketa.
// URL-nya tidak wajib membawa profil: fakta tidak bergantung profil.

export async function generateMetadata({ params }: PageProps<"/tempat/[id]/atribut/[kode]">): Promise<Metadata> {
  const { id, kode } = await params;
  const facts = await getPlaceFacts(id).catch(() => null);
  const a = facts?.attributes.find((x) => x.code === kode);
  return { title: facts && a ? `${attributeLabel(kode, a.label)} — ${facts.name}` : "Rincian atribut" };
}

export default async function Page({ params, searchParams }: PageProps<"/tempat/[id]/atribut/[kode]">) {
  const { id, kode } = await params;
  const raw = (await searchParams).profil;
  const profileQuery = isProfile(raw) ? `?profil=${raw}` : "";

  const [facts, trail] = await Promise.all([getPlaceFacts(id), getAudit(id, kode)]);
  const a = facts?.attributes.find((x) => x.code === kode);
  if (!facts || !a) notFound();

  const label = attributeLabel(a.code, a.label);
  const vantage = attributeVantage(a.code);
  const { checked, osmClaim, sentence } = attributeFacts(a);
  const corroboration = corroborationText(a.corroboration_count);
  const evidenceEntry =
    trail?.entries
      .filter((e) => e.action === "evidence_submitted" && !e.checks?.some((c) => c.result === "fail"))
      .at(-1) ?? null;
  const placeHref = `/tempat/${encodeURIComponent(id)}${profileQuery}`;
  const auditHref = `/tempat/${encodeURIComponent(id)}/atribut/${encodeURIComponent(kode)}/audit`;
  const contributeHref = `/kontribusi/${encodeURIComponent(id)}/${vantage}${profileQuery}`;

  return (
    <div className="space-y-8">
      <nav aria-label="Jejak halaman" className="breadcrumb text-meta">
        <Link href={`/tempat${profileQuery}`}>Daftar tempat</Link> <span aria-hidden="true">›</span>{" "}
        <Link href={placeHref}>{facts.name}</Link> <span aria-hidden="true">›</span>{" "}
        <span aria-current="page">{label}</span>
      </nav>

      <header className="space-y-3">
        <p className="text-meta text-ink-muted">
          {facts.name} · {VANTAGE_LABEL[vantage]}
        </p>
        <h1 className="text-screen">{label}</h1>
        <p className={checked ? "text-section" : "text-section text-ink-muted"}>{sentence}</p>
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge status={a.status} lastVerifiedAt={a.last_verified_at} disputed={a.is_disputed} />
          {corroboration ? <span>{corroboration}</span> : null}
          {a.is_demo_seed ? <DemoLabel detail="riwayat atribut ini disemai, bukan hasil kontribusi nyata" /> : null}
        </div>
        {checked && a.next_review_at ? (
          <p className="text-meta">
            {a.status === "perlu_ditinjau_ulang"
              ? `Tenggat tinjau ulang ${formatDate(a.next_review_at)} sudah lewat. Nilai ini masih dipakai untuk menilai, dengan catatan kesegaran.`
              : `Tinjau ulang sebelum ${formatDate(a.next_review_at)}.`}{" "}
            {a.code === "elevator_status"
              ? "Status lift ditinjau tiap 90 hari karena bisa berubah dalam hitungan minggu."
              : "Kondisi ini ditinjau tiap 365 hari karena perubahannya menuntut konstruksi."}
          </p>
        ) : null}
        <TombolBacakan naskah={[`${facts.name}.`, ...naskahAtribut(a)]} judul="Bacakan kondisi ini" />
      </header>

      {a.is_disputed ? (
        <section aria-labelledby="judul-sengketa" className="space-y-2 rounded-md border-2 border-line-control bg-surface-alt p-4">
          <h2 id="judul-sengketa" className="text-card">
            Dua catatan berbeda
          </h2>
          <p>
            Terbaru ({formatDate(a.last_verified_at)}): <span className="font-semibold">{valueOption(a.code, a.current_value).toLowerCase()}</span>.
          </p>
          <p>
            Sebelumnya ({formatDate(a.previous_observed_at)}): {valueOption(a.code, a.previous_value).toLowerCase()}.
          </p>
          <p className="text-meta">
            Mekanisme penyelesaian sengketa belum dibangun. Keduanya ditampilkan supaya Anda bisa menilai sendiri; yang
            dipakai untuk menilai adalah catatan terbaru.
          </p>
        </section>
      ) : null}

      {!checked ? (
        <section aria-labelledby="judul-belum" className="space-y-2 rounded-md border-2 border-dashed border-line-control p-4">
          <h2 id="judul-belum" className="text-card">
            Belum ada bukti yang lolos pemeriksaan
          </h2>
          {osmClaim ? (
            <p>
              OpenStreetMap mencatat &ldquo;{valueOption(a.code, osmClaim).toLowerCase()}&rdquo;. Itu klaim pihak ketiga tanpa
              foto dan tanpa tanggal pemeriksaan, jadi tidak dipakai untuk menilai.
            </p>
          ) : (
            <p>Tidak ada sumber lain yang mencatat kondisi ini.</p>
          )}
        </section>
      ) : (
        <section aria-labelledby="judul-bukti" className="space-y-3">
          <h2 id="judul-bukti" className="text-section">
            Bukti
          </h2>
          <EvidencePanel
            photoUrl={a.photo_url ?? evidenceEntry?.evidence?.photo_url ?? null}
            alt={photoAlt(a, facts.name)}
            entry={evidenceEntry}
            attributeCode={a.code}
            sentence={valueSentence(a.code, a.current_value)}
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <ButtonLink href={contributeHref}>Perbarui kondisi ini</ButtonLink>
        <ButtonLink href={auditHref} variant="sekunder">
          Jejak audit lengkap
        </ButtonLink>
      </div>
    </div>
  );
}
