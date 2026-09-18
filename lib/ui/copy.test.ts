/**
 * Tes regresi aturan teks docs/30-product.md §7 dan layar penolakan (L9).
 * Yang dijaga di sini adalah hal yang paling gampang "diperbaiki" orang saat
 * capek: kalimat belum-diketahui, nama profil di penilaian, angka di penolakan.
 */

import { describe, expect, it } from "vitest";
import { PROFILES, VERDICTS, type ReasonCode } from "./api/types";
import {
  ATTRIBUTE,
  CHECK_LABEL,
  PROFILE_LABEL,
  REASON_MESSAGE,
  REASON_NEXT,
  measuredNumber,
  measuredSentence,
  reasonOf,
  valueSentence,
  verdictWithProfile,
} from "./copy";

const KODE_KONTRAK: ReasonCode[] = [
  "CAPTURE_SESSION_INVALID",
  "RATE_LIMITED",
  "FILE_METADATA_PRESENT",
  "TIMESTAMP_SKEW",
  "GEO_MISSING",
  "GEO_ACCURACY_LOW",
  "GEO_FIX_STALE",
  "GEO_TOO_FAR",
  "DUPLICATE_IMAGE",
];

describe("aturan 5: terverifikasi-tidak-ada ≠ belum-diketahui", () => {
  for (const [code, a] of Object.entries(ATTRIBUTE)) {
    it(`${code}: setiap nilai terperiksa punya kalimat yang strukturnya beda dari 'belum diketahui'`, () => {
      const unknown = valueSentence(code, null);
      expect(unknown).toMatch(/belum diketahui/i);
      for (const v of a.values) {
        const known = valueSentence(code, v);
        expect(known).not.toBe(unknown);
        expect(known).not.toMatch(/belum diketahui/i);
      }
    });
  }

  it("step_count 0 dibaca sebagai 'tidak punya anak tangga', bukan kosong", () => {
    expect(valueSentence("step_count", "0")).toBe("Pintu masuk ini tidak punya anak tangga.");
    expect(valueSentence("step_count", null)).toBe("Jumlah anak tangga di pintu masuk ini belum diketahui.");
  });

  it("ramp no dan elevator none juga fakta, bukan ketiadaan data", () => {
    expect(valueSentence("ramp_wheelchair", "no")).toMatch(/tidak punya ramp/);
    expect(valueSentence("elevator_status", "none")).toMatch(/tidak punya lift/);
  });
});

describe("aturan 2: penilaian selalu menyebut profil", () => {
  for (const v of VERDICTS)
    for (const p of PROFILES)
      it(`${v} × ${p}`, () => {
        expect(verdictWithProfile(v, p)).toContain(`— ${PROFILE_LABEL[p]}`);
      });
});

describe("kode alasan 00-KONTRAK §6", () => {
  it("kalimat bawaan sama persis dengan tabel kontrak", () => {
    expect(REASON_MESSAGE.GEO_TOO_FAR).toBe("Lokasi pengambilan terlalu jauh dari tempat yang dipilih");
    expect(REASON_MESSAGE.FILE_METADATA_PRESENT).toBe("Berkas ini tampak berasal dari galeri, bukan dari kamera aplikasi");
  });

  it.each(KODE_KONTRAK)("%s punya label pemeriksaan dan langkah berikutnya", (code) => {
    expect(CHECK_LABEL[code]).toBeTruthy();
    expect(REASON_NEXT[code]).toBeTruthy();
  });

  it("kode pemeriksaan C0–C8 dipetakan ke kode alasan", () => {
    expect(reasonOf("C7")).toBe("GEO_TOO_FAR");
    expect(reasonOf("C6b")).toBe("GEO_FIX_STALE");
    expect(reasonOf("DUPLICATE_IMAGE")).toBe("DUPLICATE_IMAGE");
    expect(reasonOf("TIDAK_ADA")).toBeNull();
  });
});

describe("aturan 6: penolakan menyebut angka dan ambang", () => {
  it("angka bersatuan dari server (format suite tests/rejection) tidak digandakan satuannya", () => {
    const s = measuredSentence("GEO_TOO_FAR", "214 m", "120 m");
    expect(s).toBe("Jarak terukur 214 meter. Batas untuk tempat ini 120 meter.");
    expect(s).not.toMatch(/m meter/);
  });

  it("jarak Hamming ditulis 'hamming 4' oleh server", () => {
    expect(measuredSentence("DUPLICATE_IMAGE", "hamming 4", "hamming 2")).toMatch(/foto yang sudah ada 4 .*2 atau kurang/);
  });

  it("angka polos tetap jalan", () => {
    expect(measuredSentence("C7", "214", "120")).toBe("Jarak terukur 214 meter. Batas untuk tempat ini 120 meter.");
  });

  it.each(["GEO_TOO_FAR", "TIMESTAMP_SKEW", "DUPLICATE_IMAGE", "GEO_ACCURACY_LOW"] as const)(
    "%s (measured wajib) menghasilkan kalimat yang memuat kedua angka",
    (code) => {
      const s = measuredSentence(code, "31", "17");
      expect(s).toContain("31");
      expect(s).toContain("17");
    },
  );

  it("penjelasan metadata tetap tampil walau server tidak mengirim angka", () => {
    expect(measuredSentence("FILE_METADATA_PRESENT", null, null)).toMatch(/Ditemukan metadata berkas/);
  });

  it("measuredNumber: angka pertama, koma desimal, teks tanpa angka apa adanya", () => {
    expect(measuredNumber("1,5 m")).toBe("1,5");
    expect(measuredNumber("-245 dtk")).toBe("-245");
    expect(measuredNumber("EXIF, tag GPS")).toBe("EXIF, tag GPS");
    expect(measuredNumber(null)).toBeNull();
    expect(measuredNumber("  ")).toBeNull();
  });
});
