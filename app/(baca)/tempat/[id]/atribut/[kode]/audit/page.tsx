import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAudit } from "@/lib/ui/api/server";
import { DemoLabel } from "@/lib/ui/badges";
import { attributeLabel } from "@/lib/ui/copy";
import { AuditTimeline } from "@/lib/ui/evidence";

// L6 — jejak audit. Selalu bisa dibuka tanpa akun dan tanpa profil di URL.
// Memuat SEMUA kejadian, termasuk kontribusi yang ditolak.

export async function generateMetadata({ params }: PageProps<"/tempat/[id]/atribut/[kode]/audit">): Promise<Metadata> {
  const { id, kode } = await params;
  const trail = await getAudit(id, kode).catch(() => null);
  return {
    title: trail ? `Jejak audit: ${attributeLabel(kode, trail.attribute.label)} · ${trail.place.name}` : "Jejak audit",
  };
}

export default async function Page({ params }: PageProps<"/tempat/[id]/atribut/[kode]/audit">) {
  const { id, kode } = await params;
  const trail = await getAudit(id, kode);
  if (!trail) notFound();

  const label = attributeLabel(kode, trail.attribute.label);
  const rejected = trail.entries.filter((e) => e.action === "provenance_failed").length;
  const jsonHref = `/api/places/${encodeURIComponent(id)}/attributes/${encodeURIComponent(kode)}/audit`;

  return (
    <div className="space-y-8">
      <nav aria-label="Jejak halaman" className="breadcrumb text-meta">
        <Link href={`/tempat/${encodeURIComponent(id)}`}>{trail.place.name}</Link> <span aria-hidden="true" className="panah">›</span>{" "}
        <Link href={`/tempat/${encodeURIComponent(id)}/atribut/${encodeURIComponent(kode)}`}>{label}</Link>{" "}
        <span aria-hidden="true" className="panah">›</span> <span aria-current="page">Jejak audit</span>
      </nav>

      <header className="space-y-3">
        <p className="text-meta text-ink-muted">{trail.place.name}</p>
        <h1 className="text-screen">Jejak audit: {label}</h1>
        <p>
          Semua kejadian untuk kondisi ini, dari yang paling lama, termasuk kiriman yang ditolak beserta angka
          pemeriksaannya. Terbuka untuk siapa pun, tanpa akun.
          {rejected > 0 ? ` ${rejected} kiriman ditolak tercatat di sini.` : ""}
        </p>
        {trail.is_demo_seed ? <DemoLabel detail="sebagian kejadian di sini disemai untuk peragaan" /> : null}
        <p className="text-meta">
          <a href={jsonHref}>Unduh jejak ini sebagai JSON</a>, supaya bisa diperiksa sendiri, bukan hanya dilihat.
        </p>
      </header>

      {trail.third_party_claims && Object.keys(trail.third_party_claims).length > 0 ? (
        <section aria-labelledby="judul-klaim" className="space-y-2 rounded-md border-2 border-dashed border-line-control p-4">
          <h2 id="judul-klaim" className="text-card">
            Klaim dari OpenStreetMap, tidak diverifikasi sistem ini
          </h2>
          <ul className="space-y-1">
            {Object.entries(trail.third_party_claims).map(([k, v]) => (
              <li key={k}>
                <code className="font-mono">
                  {k}={v}
                </code>
              </li>
            ))}
          </ul>
          <p className="text-meta text-ink-muted">
            Tag ini berupa penilaian, bukan kondisi fisik yang bisa diamati, jadi tidak pernah dipakai untuk menilai.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="judul-riwayat" className="space-y-4">
        <h2 id="judul-riwayat" className="text-section">
          Riwayat
        </h2>
        {trail.entries.length === 0 ? (
          <p>Belum ada kejadian. Belum pernah ada foto yang dikirim untuk kondisi ini.</p>
        ) : (
          <AuditTimeline entries={trail.entries} attributeCode={kode} />
        )}
      </section>
    </div>
  );
}
