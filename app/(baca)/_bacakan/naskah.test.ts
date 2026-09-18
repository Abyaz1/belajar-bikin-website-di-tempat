import { describe, expect, it } from "vitest";
import type { AttributeDetail, PlaceDetail } from "@/lib/ui/api/types";
import { ATTRIBUTE_ORDER } from "@/lib/ui/copy";
import { naskahAtribut, naskahLaporan, tanggalLisan } from "./naskah";

function atribut(code: string, isi: Partial<AttributeDetail> = {}): AttributeDetail {
  return {
    code,
    label: "",
    current_value: null,
    status: "belum_terverifikasi",
    is_disputed: false,
    previous_value: null,
    previous_observed_at: null,
    corroboration_count: 0,
    last_verified_at: null,
    next_review_at: null,
    source: null,
    photo_url: null,
    photo_alt: null,
    is_demo_seed: false,
    audit_url: "",
    ...isi,
  };
}

function tempat(isi: Partial<PlaceDetail> = {}): PlaceDetail {
  return {
    id: "x",
    name: "Halte Dipati Ukur",
    category: "halte",
    address: null,
    lat: 0,
    lon: 0,
    source: "osm_seed",
    profile: "netra",
    verdict: "belum_dapat_dipastikan",
    notes: [],
    unknown_attributes: [],
    freshness_notes: [],
    attributes: [],
    is_demo_seed: false,
    ...isi,
  };
}

describe("tanggalLisan", () => {
  it("nama bulan utuh, zona Jakarta; kosong atau rusak jadi null", () => {
    expect(tanggalLisan("2026-09-17T20:00:00Z")).toBe("18 September 2026");
    expect(tanggalLisan(null)).toBeNull();
    expect(tanggalLisan("bukan tanggal")).toBeNull();
  });
});

describe("naskahAtribut", () => {
  it("nol anak tangga yang terverifikasi berbeda kalimat dari yang belum diketahui", () => {
    const nol = naskahAtribut(
      atribut("step_count", { current_value: "0", status: "terverifikasi", last_verified_at: "2026-09-18T03:00:00Z" }),
    );
    const belum = naskahAtribut(atribut("step_count"));
    expect(nol.join(" ")).toContain("tidak punya anak tangga");
    expect(nol.join(" ")).toContain("Terverifikasi dengan foto, terakhir diperiksa 18 September 2026");
    expect(belum.join(" ")).toContain("belum diketahui");
    expect(belum.join(" ")).not.toContain("tidak punya");
  });

  it("klaim OSM dibacakan sebagai klaim pihak ketiga, bukan sebagai fakta", () => {
    const n = naskahAtribut(atribut("tactile_paving", { current_value: "yes", source: "osm_seed" })).join(" ");
    expect(n).toContain("OpenStreetMap mencatat");
    expect(n).toContain("tidak dipakai untuk menilai");
  });

  it("sengketa dan data demo ikut dibacakan", () => {
    const n = naskahAtribut(
      atribut("ramp_wheelchair", {
        current_value: "no",
        status: "terverifikasi",
        last_verified_at: "2026-09-18T03:00:00Z",
        is_disputed: true,
        previous_value: "yes",
        previous_observed_at: "2026-01-02T03:00:00Z",
        is_demo_seed: true,
      }),
    ).join(" ");
    expect(n).toContain("Ada catatan berbeda sebelumnya, 2 Januari 2026");
    expect(n).toContain("data demo");
  });
});

describe("naskahLaporan", () => {
  it("penilaian selalu menyebut profil, dan tempat tanpa bukti dibacakan apa adanya", () => {
    const n = naskahLaporan(
      tempat({ attributes: [atribut("tactile_paving"), atribut("step_count")], unknown_attributes: ["tactile_paving"] }),
      "netra",
      ATTRIBUTE_ORDER,
    );
    expect(n[0]).toBe("Halte Dipati Ukur, halte.");
    expect(n).toContain("Penilaian untuk profil netra: belum dapat dipastikan.");
    expect(n.join(" ")).toContain("Belum ada satu pun bukti kondisi fisik");
    expect(n).toContain("Kondisi fisik: 0 dari 2 sudah diperiksa.");
    // Urutan atribut mengikuti layar, bukan urutan data.
    expect(n.indexOf("Anak tangga di pintu masuk.")).toBeLessThan(n.indexOf("Jalur pemandu."));
  });

  it("hambatan dibacakan sebelum rincian kondisi; tanpa simbol tampilan", () => {
    const n = naskahLaporan(
      tempat({
        verdict: "tidak_dapat_diakses",
        profile: "kursi_roda_manual",
        notes: [{ rule_id: "r1", verdict: "blocker", message: "Pintu masuk punya dua anak tangga tanpa ramp" }],
        attributes: [atribut("step_count", { current_value: "2", status: "terverifikasi", last_verified_at: "2026-09-18T03:00:00Z" })],
      }),
      "kursi_roda_manual",
      ATTRIBUTE_ORDER,
    );
    expect(n).toContain("Penilaian untuk profil kursi roda manual: tidak dapat diakses.");
    expect(n.indexOf("Pintu masuk punya dua anak tangga tanpa ramp.")).toBeLessThan(n.indexOf("Pintu masuk."));
    expect(n.join(" ")).not.toMatch(/[—·›]/);
  });

  it("tidak pernah membacakan angka keyakinan", () => {
    const n = naskahLaporan(tempat({ attributes: [atribut("step_count")] }), "netra", ATTRIBUTE_ORDER).join(" ");
    expect(n).not.toMatch(/confidence|keyakinan/i);
  });
});
