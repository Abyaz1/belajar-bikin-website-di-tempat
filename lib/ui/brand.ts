/**
 * Nama produk di satu tempat. PRD menyebut nama ditetapkan problem owner di
 * jam 0; "Jejak Akses" dipakai sampai ada keputusan lain. Ganti di sini saja.
 */
export const PRODUCT_NAME = "Jejak Akses";

/** Mode data contoh untuk mengembangkan antarmuka sebelum endpoint siap.
 *  Mati secara bawaan. Kalau menyala, setiap halaman menampilkan bilah
 *  peringatan — isinya fiktif dan tidak boleh muncul di demo. */
export const UI_FIXTURES = process.env.NEXT_PUBLIC_UI_FIXTURES === "1";

/** Sakelar darurat: NEXT_PUBLIC_MAP_ENABLED=0 menyembunyikan peta. Daftar
 *  tetap jalan. Kalau peta bermasalah saat demo, jangan buang waktu —
 *  matikan di sini (spek 30 §8). */
export const MAP_ENABLED = process.env.NEXT_PUBLIC_MAP_ENABLED !== "0";
