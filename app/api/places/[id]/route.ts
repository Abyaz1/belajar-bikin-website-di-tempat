/**
 * E2 GET /api/places/{id}?profile= — laporan kesiapan satu tempat untuk satu
 * profil: penilaian, catatan, catatan kesegaran, lalu rincian tiap atribut
 * (00-KONTRAK §8, docs-20 §6). `profile` wajib; tanpa itu 400.
 */

import { muatAturan } from "@/lib/rules/muat";
import { muatFoto, muatState, muatTempat, muatTipeAtribut } from "../muat";
import { bacaProfil, galat, idSah, PESAN_PROFIL_WAJIB, rakitRincian } from "../rakit";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const profile = bacaProfil(new URL(request.url).searchParams.get("profile"));
  if (!profile) return galat(400, "PROFILE_REQUIRED", PESAN_PROFIL_WAJIB);
  if (!idSah(id)) return galat(404, "PLACE_NOT_FOUND", "Tempat tidak ditemukan.");

  try {
    const tempat = await muatTempat(id);
    if (!tempat) return galat(404, "PLACE_NOT_FOUND", "Tempat tidak ditemukan.");
    const [states, tipe, foto, aturan] = await Promise.all([
      muatState([id]),
      muatTipeAtribut(),
      muatFoto(id),
      muatAturan(),
    ]);
    return Response.json(rakitRincian(tempat, states, tipe, foto, profile, aturan));
  } catch (e) {
    console.error("E2 /api/places/[id]:", e);
    return galat(503, "PLACES_UNAVAILABLE", "Tempat tidak dapat dibaca dari basis data.");
  }
}
