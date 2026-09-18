/**
 * E3 GET /api/places/{id}/attributes/{code}/audit — jejak audit satu atribut,
 * kronologis: bukti beserta hasil tiap pemeriksaan dan nilai terukurnya,
 * konfirmasi kontributor, dan perubahan nilai (00-KONTRAK §8, docs-20 §6).
 * Terbuka tanpa akun dan tanpa profil (docs-30 L6).
 */

import { muatJejak, muatState, muatTempat, muatTipeAtribut } from "../../../../muat";
import { galat, idSah, rakitJejakAudit } from "../../../../rakit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string; code: string }> }) {
  const { id, code } = await ctx.params;
  if (!idSah(id)) return galat(404, "PLACE_NOT_FOUND", "Tempat tidak ditemukan.");

  try {
    const [tempat, tipe] = await Promise.all([muatTempat(id), muatTipeAtribut()]);
    if (!tempat) return galat(404, "PLACE_NOT_FOUND", "Tempat tidak ditemukan.");
    const atribut = tipe.find((t) => t.code === code);
    if (!atribut) return galat(404, "ATTRIBUTE_NOT_FOUND", "Atribut tidak dikenal.");

    const [states, bahan] = await Promise.all([muatState([id]), muatJejak(id, code, atribut.vantage)]);
    return Response.json(
      rakitJejakAudit({
        tempat,
        atribut,
        state: states.find((s) => s.attribute_code === code) ?? null,
        ...bahan,
      }),
    );
  } catch (e) {
    console.error("E3 /api/places/[id]/attributes/[code]/audit:", e);
    return galat(503, "AUDIT_UNAVAILABLE", "Jejak audit tidak dapat dibaca dari basis data.");
  }
}
