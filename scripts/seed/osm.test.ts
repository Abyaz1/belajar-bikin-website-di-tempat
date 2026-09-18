import { describe, expect, it } from "vitest";
import { atributDariTag, kategori, lebarKePita, petakan, pilih, type ElemenOsm } from "./osm";

describe("kategori", () => {
  it("kampus, fasilitas kesehatan, halte; selain itu diabaikan", () => {
    expect(kategori({ amenity: "university" })).toBe("kampus");
    expect(kategori({ amenity: "clinic" })).toBe("fasilitas kesehatan");
    expect(kategori({ healthcare: "doctor" })).toBe("fasilitas kesehatan");
    expect(kategori({ highway: "bus_stop" })).toBe("halte");
    expect(kategori({ public_transport: "platform", bus: "yes" })).toBe("halte");
    expect(kategori({ amenity: "cafe" })).toBeNull();
  });
});

describe("lebarKePita", () => {
  it("meter bawaan, cm dikenali, batas 80 dan 90 masuk pita tengah", () => {
    expect(lebarKePita("0.7")).toBe("lt80");
    expect(lebarKePita("0.8")).toBe("80_90");
    expect(lebarKePita("90 cm")).toBe("80_90");
    expect(lebarKePita("0,95 m")).toBe("gt90");
    expect(lebarKePita("1.2")).toBe("gt90");
  });

  it("nilai tak masuk akal atau tak terbaca diabaikan, bukan ditebak", () => {
    expect(lebarKePita("12")).toBeNull();
    expect(lebarKePita("lebar")).toBeNull();
    expect(lebarKePita(undefined)).toBeNull();
  });
});

describe("atributDariTag", () => {
  it("memetakan tag fakta dan mengabaikan nilai di luar kosakata", () => {
    expect(
      atributDariTag({
        "ramp:wheelchair": "yes",
        step_count: "3",
        tactile_paving: "incorrect",
        kerb: "rolled",
        "toilets:wheelchair": "no",
      }),
    ).toEqual({ ramp_wheelchair: "yes", step_count: "3", toilets_wheelchair: "no" });
  });

  it("wheelchair, door:width, dan smoothness TIDAK jadi atribut", () => {
    expect(atributDariTag({ wheelchair: "yes", "door:width": "0.9", smoothness: "bad" })).toEqual({});
  });
});

describe("petakan", () => {
  const elemen: ElemenOsm[] = [
    {
      type: "way",
      id: 10,
      center: { lat: -6.8925, lon: 107.618 },
      nodes: [1, 2, 3],
      tags: { amenity: "clinic", name: "Klinik Contoh", wheelchair: "limited", "addr:street": "Jalan Dipati Ukur", "addr:housenumber": "35", "ramp:wheelchair": "no" },
    },
    { type: "node", id: 2, lat: -6.8926, lon: 107.6181, tags: { entrance: "service", width: "0.7" } },
    { type: "node", id: 3, lat: -6.8927, lon: 107.6182, tags: { entrance: "main", width: "95 cm", "ramp:wheelchair": "yes", step_count: "0" } },
    { type: "node", id: 20, lat: -6.891, lon: 107.617, tags: { highway: "bus_stop", name: "Halte Dipati Ukur" } },
    { type: "node", id: 21, lat: -6.891, lon: 107.617, tags: { highway: "bus_stop" } },
  ];
  const hasil = petakan(elemen);

  it("node entrance jadi bahan, bukan tempat; elemen tanpa nama dilewati", () => {
    expect(hasil.map((t) => t.name)).toEqual(["Klinik Contoh", "Halte Dipati Ukur"]);
  });

  it("pintu utama didahulukan dan tag-nya menang atas tag bangunan", () => {
    expect(hasil[0].atribut).toEqual({ ramp_wheelchair: "yes", step_count: "0", door_width_band: "gt90" });
  });

  it("wheelchair hanya jadi klaim pihak ketiga; alamat dirangkai dari addr:*", () => {
    expect(hasil[0].third_party_claims).toEqual({ wheelchair: "limited" });
    expect(hasil[0].address).toBe("Jalan Dipati Ukur 35");
    expect(hasil[1].third_party_claims).toBeNull();
  });
});

describe("pilih", () => {
  const t = (name: string, category: "kampus" | "halte", lat: number) =>
    ({ osm_type: "node", osm_id: lat, name, category, lat, lon: 107.618, address: null, third_party_claims: null, atribut: {} }) as const;

  it("kampus/kesehatan didahulukan, lalu halte terdekat, sampai batas maksimum", () => {
    const hasil = pilih(
      [t("Halte Jauh", "halte", -6.9), t("Halte Dekat", "halte", -6.8926), t("Kampus Jauh", "kampus", -6.899)],
      { lat: -6.8925, lon: 107.618 },
      2,
    );
    expect(hasil.map((x) => x.name)).toEqual(["Halte Dekat", "Kampus Jauh"]);
  });
});
