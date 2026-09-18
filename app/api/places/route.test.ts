/**
 * E1/E2/E3: jalur galat dan jalur sukses. Pembaca basis data di-mock; perakitan
 * dites di rakit.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTRIBUTE_TYPES, MINIMUM_ATTRIBUTES, RULE_GROUPS } from "@/lib/rules/reference";

const muat = {
  muatDaftarTempat: vi.fn(),
  muatTempat: vi.fn(),
  muatState: vi.fn(),
  muatTipeAtribut: vi.fn(),
  muatFoto: vi.fn(),
  muatJejak: vi.fn(),
};
vi.mock("./muat", () => muat);
const muatAturan = vi.fn();
vi.mock("@/lib/rules/muat", () => ({ muatAturan: () => muatAturan() }));

const E1 = await import("./route");
const E2 = await import("./[id]/route");
const E3 = await import("./[id]/attributes/[code]/audit/route");

const ID = "11111111-1111-4111-8111-00000000abcd";
const TEMPAT = {
  id: ID,
  name: "Gedung Uji",
  category: "kampus",
  address: null,
  lat: "-6.8915",
  lon: "107.6167",
  source: "osm_seed",
  layanan_di_atas_lantai_dasar: false,
  third_party_claims: null,
  is_demo_seed: false,
};

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });
const galatBody = (code: string) => expect.objectContaining({ code, measured: null, threshold: null });

beforeEach(() => {
  for (const f of Object.values(muat)) f.mockReset();
  muatAturan.mockReset().mockResolvedValue({ rules: RULE_GROUPS, minimum: MINIMUM_ATTRIBUTES });
  muat.muatTipeAtribut.mockResolvedValue(ATTRIBUTE_TYPES.map(({ code, label_id, vantage }) => ({ code, label_id, vantage })));
  muat.muatState.mockResolvedValue([]);
  muat.muatFoto.mockResolvedValue([]);
  muat.muatJejak.mockResolvedValue({ bukti: [], pemeriksaan: [], audit: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("E1 GET /api/places", () => {
  it("tanpa profile → 400 PROFILE_REQUIRED, basis data tidak disentuh", async () => {
    const res = await E1.GET(new Request("http://x/api/places"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(galatBody("PROFILE_REQUIRED"));
    expect(muat.muatDaftarTempat).not.toHaveBeenCalled();
  });

  it("bbox salah bentuk → 400 BBOX_INVALID", async () => {
    const res = await E1.GET(new Request("http://x/api/places?profile=netra&bbox=1,2,3"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(galatBody("BBOX_INVALID"));
  });

  it("200: larik PlaceSummary dengan penilaian", async () => {
    muat.muatDaftarTempat.mockResolvedValue([TEMPAT]);
    const res = await E1.GET(new Request("http://x/api/places?profile=kursi_roda_manual"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: ID, verdict: "belum_dapat_dipastikan", lat: -6.8915 });
  });

  it("basis data gagal → 503 dengan bentuk galat seragam", async () => {
    muat.muatDaftarTempat.mockRejectedValue(new Error("koneksi ditolak"));
    const res = await E1.GET(new Request("http://x/api/places?profile=netra"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(galatBody("PLACES_UNAVAILABLE"));
  });

  it("tidak dirender saat build", () => {
    expect(E1.dynamic).toBe("force-dynamic");
  });
});

describe("E2 GET /api/places/{id}", () => {
  it("tanpa profile → 400", async () => {
    const res = await E2.GET(new Request(`http://x/api/places/${ID}`), params({ id: ID }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(galatBody("PROFILE_REQUIRED"));
  });

  it("id bukan uuid → 404 tanpa menanyai basis data", async () => {
    const res = await E2.GET(new Request("http://x/api/places/contoh-1?profile=netra"), params({ id: "contoh-1" }));
    expect(res.status).toBe(404);
    expect(muat.muatTempat).not.toHaveBeenCalled();
  });

  it("tempat tidak ada → 404 PLACE_NOT_FOUND", async () => {
    muat.muatTempat.mockResolvedValue(null);
    const res = await E2.GET(new Request(`http://x/api/places/${ID}?profile=netra`), params({ id: ID }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(galatBody("PLACE_NOT_FOUND"));
  });

  it("200: PlaceDetail untuk profil yang diminta", async () => {
    muat.muatTempat.mockResolvedValue(TEMPAT);
    const res = await E2.GET(new Request(`http://x/api/places/${ID}?profile=netra`), params({ id: ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: ID, profile: "netra" });
    expect(body.attributes).toHaveLength(8);
  });
});

describe("E3 GET /api/places/{id}/attributes/{code}/audit", () => {
  it("atribut tidak dikenal → 404 ATTRIBUTE_NOT_FOUND", async () => {
    muat.muatTempat.mockResolvedValue(TEMPAT);
    const res = await E3.GET(new Request("http://x"), params({ id: ID, code: "incline" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(galatBody("ATTRIBUTE_NOT_FOUND"));
  });

  it("200 tanpa profil: jejak memakai titik pandang atribut", async () => {
    muat.muatTempat.mockResolvedValue(TEMPAT);
    const res = await E3.GET(new Request("http://x"), params({ id: ID, code: "elevator_status" }));
    expect(res.status).toBe(200);
    expect(muat.muatJejak).toHaveBeenCalledWith(ID, "elevator_status", "interior");
    expect(await res.json()).toMatchObject({ place: { id: ID }, attribute: { code: "elevator_status" }, entries: [] });
  });
});
