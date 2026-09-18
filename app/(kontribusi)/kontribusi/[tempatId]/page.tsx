import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceFacts } from "@/lib/ui/api/server";
import { VANTAGES, isProfile } from "@/lib/ui/api/types";
import { ATTRIBUTE_ORDER, VANTAGE_HINT, VANTAGE_LABEL, attributeLabel, attributeVantage } from "@/lib/ui/copy";
import { GeoStatus } from "@/lib/ui/geo-status";

// L7 — pilih titik pandang. Satu foto pintu masuk tidak mungkin memperlihatkan
// lift atau toilet, jadi atribut diikat ke titik pandangnya.

export async function generateMetadata({ params }: PageProps<"/kontribusi/[tempatId]">): Promise<Metadata> {
  const { tempatId } = await params;
  const facts = await getPlaceFacts(tempatId).catch(() => null);
  return { title: facts ? `Perbarui data: ${facts.name}` : "Perbarui data" };
}

export default async function Page({ params, searchParams }: PageProps<"/kontribusi/[tempatId]">) {
  const { tempatId } = await params;
  const raw = (await searchParams).profil;
  const q = isProfile(raw) ? `?profil=${raw}` : "";
  const facts = await getPlaceFacts(tempatId);
  if (!facts) notFound();

  return (
    <div className="max-w-3xl space-y-8">
      <nav aria-label="Jejak halaman" className="breadcrumb text-meta">
        <Link href={`/tempat/${encodeURIComponent(tempatId)}${q}`}>{facts.name}</Link> <span aria-hidden="true">›</span>{" "}
        <span aria-current="page">Perbarui data</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-screen">Perbarui data: {facts.name}</h1>
        <p>
          Anda perlu berada di depan tempat ini. Foto diambil lewat kamera di halaman ini; galeri sengaja tidak tersedia.
        </p>
        <GeoStatus />
      </header>

      <section aria-labelledby="judul-titik" className="space-y-4">
        <h2 id="judul-titik" className="text-section">
          Dari mana Anda memotret?
        </h2>
        <p className="text-meta text-ink-muted">
          Kiriman paling sedikit: satu foto pintu masuk dengan jumlah anak tangga dan ramp.
        </p>
        <ul className="grid gap-3">
          {VANTAGES.map((v) => {
            const codes = ATTRIBUTE_ORDER.filter((c) => attributeVantage(c) === v);
            return (
              <li key={v} className="card-link min-h-12 space-y-2 rounded-md border border-line-control p-4">
                <h3 className="text-card">
                  <Link href={`/kontribusi/${encodeURIComponent(tempatId)}/${v}${q}`} className="stretch text-ink no-underline hover:underline">
                    {VANTAGE_LABEL[v]}
                  </Link>
                  {v === "entrance" ? <span className="ms-2 text-meta font-normal text-ink-muted">(paling dibutuhkan)</span> : null}
                </h3>
                <p className="text-meta">{VANTAGE_HINT[v]}</p>
                <p className="text-meta text-ink-muted">
                  Yang bisa dicatat dari sini: {codes.map((c) => attributeLabel(c).toLowerCase()).join(", ")}.
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
