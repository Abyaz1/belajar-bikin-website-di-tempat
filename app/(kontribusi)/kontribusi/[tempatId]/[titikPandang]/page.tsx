import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlaceFacts } from "@/lib/ui/api/server";
import { isProfile, isVantage } from "@/lib/ui/api/types";
import { VANTAGE_LABEL } from "@/lib/ui/copy";
import { Alur } from "./alur";

// L8–L11 — kamera, penolakan, konfirmasi, ringkasan.

export async function generateMetadata({ params }: PageProps<"/kontribusi/[tempatId]/[titikPandang]">): Promise<Metadata> {
  const { tempatId, titikPandang } = await params;
  const facts = await getPlaceFacts(tempatId).catch(() => null);
  const v = isVantage(titikPandang) ? VANTAGE_LABEL[titikPandang].toLowerCase() : "foto";
  return { title: facts ? `Kirim foto ${v}: ${facts.name}` : "Kirim foto" };
}

export default async function Page({ params, searchParams }: PageProps<"/kontribusi/[tempatId]/[titikPandang]">) {
  const { tempatId, titikPandang } = await params;
  if (!isVantage(titikPandang)) notFound();
  const raw = (await searchParams).profil;
  const q = isProfile(raw) ? `?profil=${raw}` : "";
  const facts = await getPlaceFacts(tempatId);
  if (!facts) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-screen">
        Kirim foto {VANTAGE_LABEL[titikPandang].toLowerCase()}: {facts.name}
      </h1>
      <Alur
        place={{ id: facts.id, name: facts.name, lat: facts.lat, lon: facts.lon }}
        vantage={titikPandang}
        placeHref={`/tempat/${encodeURIComponent(tempatId)}${q}`}
        vantageHref={`/kontribusi/${encodeURIComponent(tempatId)}${q}`}
      />
    </div>
  );
}
