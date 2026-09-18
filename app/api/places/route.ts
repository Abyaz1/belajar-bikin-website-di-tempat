/**
 * E1 GET /api/places?profile=&bbox=&limit= — daftar tempat beserta penilaian
 * untuk satu profil (00-KONTRAK §8, docs-20 §6). `profile` wajib; tanpa itu 400.
 * Penilaian dihitung saat request, tidak dibaca dari kolom mana pun.
 */

import { muatAturan } from "@/lib/rules/muat";
import { muatDaftarTempat, muatState, muatTipeAtribut } from "./muat";
import { bacaBbox, bacaLimit, bacaProfil, galat, PESAN_PROFIL_WAJIB, rakitRingkasan } from "./rakit";

// Jangan pernah dirender saat build: butuh basis data.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const profile = bacaProfil(q.get("profile"));
  if (!profile) return galat(400, "PROFILE_REQUIRED", PESAN_PROFIL_WAJIB);
  const bbox = bacaBbox(q.get("bbox"));
  if (bbox === "salah") return galat(400, "BBOX_INVALID", "bbox harus empat angka: minLon,minLat,maxLon,maxLat.");

  try {
    const [tempat, aturan, tipe] = await Promise.all([
      muatDaftarTempat(bbox, bacaLimit(q.get("limit"))),
      muatAturan(),
      muatTipeAtribut(),
    ]);
    const states = await muatState(tempat.map((t) => t.id));
    return Response.json(
      tempat.map((t) =>
        rakitRingkasan(
          t,
          states.filter((s) => s.place_id === t.id),
          tipe,
          profile,
          aturan,
        ),
      ),
    );
  } catch (e) {
    console.error("E1 /api/places:", e);
    return galat(503, "PLACES_UNAVAILABLE", "Daftar tempat tidak dapat dibaca dari basis data.");
  }
}
