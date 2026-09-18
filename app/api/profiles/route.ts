/**
 * E6 GET /api/profiles — daftar profil beserta aturannya, untuk transparansi
 * (00-KONTRAK §8, docs-20 §6). Halaman /profil memakainya.
 *
 * Aturan dibaca dari tabel, bukan dari kode: yang tampil di sini persis yang
 * dipakai menilai. Kalau basis data tidak bisa dibaca, jawab 503 dengan bentuk
 * galat seragam — TIDAK jatuh ke salinan di kode, karena itu bisa menampilkan
 * aturan yang berbeda dari yang sedang berlaku.
 */

import { muatAturan } from "@/lib/rules/muat";
import { profilPublik } from "@/lib/rules/profil";

// Jangan pernah dirender saat build: butuh basis data.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rules, minimum } = await muatAturan();
    return Response.json(profilPublik(rules, minimum));
  } catch (e) {
    console.error("E6 /api/profiles:", e);
    return Response.json(
      { code: "RULES_UNAVAILABLE", message: "Aturan profil tidak dapat dibaca dari basis data.", measured: null, threshold: null },
      { status: 503 },
    );
  }
}
