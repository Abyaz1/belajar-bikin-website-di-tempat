import { describe, expect, it } from "vitest";
import {
  KODE_ATRIBUT,
  KODE_PENOLAKAN,
  PENILAIAN,
  PROFIL,
  STATUS_ATRIBUT,
  TITIK_PANDANG,
} from "@/lib/kontrak";

// Mengubah kosakata ini butuh persetujuan tiga engineer dan entri di PERUBAHAN.md.
describe("kosakata kontrak", () => {
  it("jumlah dan keunikan kode sesuai kontrak", () => {
    const daftar = [KODE_ATRIBUT, TITIK_PANDANG, PROFIL, STATUS_ATRIBUT, PENILAIAN, KODE_PENOLAKAN];
    for (const kode of daftar) expect(new Set(kode).size).toBe(kode.length);
    expect(daftar.map((kode) => kode.length)).toEqual([8, 3, 3, 3, 4, 9]);
  });
});
