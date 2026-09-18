/**
 * GET /api/places/{id}/photos/{evidenceId} — foto TAYANG satu bukti.
 *
 * Penyaji di balik `photo_url` E2 dan E3. Bucket bukti privat (tanpa binding
 * allUsers), jadi foto sampai ke pengguna lewat rute ini, bukan URL bucket.
 *
 * Yang disajikan hanya evidence.public_path: turunan yang sudah dikecilkan dan
 * wajahnya dikaburkan. storage_path (foto asli) tidak pernah dibaca di sini —
 * kolomnya tidak dipilih, dan readPublic() menolak kunci di luar `tayang/`.
 * Bukti tanpa foto tayang → 404, sama dengan bukti yang tidak ada.
 */

import { db } from "@/lib/db";
import { readPublic } from "@/lib/trust/storage";
import { galat, idSah } from "../../../rakit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string; evidenceId: string }> }) {
  const { id, evidenceId } = await ctx.params;
  const tidakAda = () => galat(404, "PHOTO_NOT_FOUND", "Foto bukti ini tidak tersedia.");
  if (!idSah(id) || !idSah(evidenceId)) return tidakAda();

  try {
    const { rows } = await (await db()).query<{ public_path: string | null }>(
      `select public_path from evidence where id = $1 and place_id = $2`,
      [evidenceId, id],
    );
    const kunci = rows[0]?.public_path;
    if (!kunci) return tidakAda();
    const isi = await readPublic(kunci);
    return new Response(new Uint8Array(isi), {
      headers: {
        "Content-Type": "image/jpeg",
        // Kunci objek memuat hash isinya, jadi satu URL tidak pernah berganti isi.
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("GET /api/places/[id]/photos/[evidenceId]:", e);
    return galat(503, "PHOTO_UNAVAILABLE", "Foto bukti sedang tidak bisa dimuat. Coba lagi sebentar.");
  }
}
