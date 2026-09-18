/**
 * E6 GET /api/profiles. Pemuat basis data di-mock; perakitannya dites di
 * lib/rules/profil.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MINIMUM_ATTRIBUTES, RULE_GROUPS } from "@/lib/rules/reference";

const muatAturan = vi.fn();
vi.mock("@/lib/rules/muat", () => ({ muatAturan: () => muatAturan() }));

const { GET, dynamic } = await import("./route");

beforeEach(() => {
  muatAturan.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("E6 GET /api/profiles", () => {
  it("200: larik tiga profil dalam bentuk ProfileInfo", async () => {
    muatAturan.mockResolvedValue({ rules: RULE_GROUPS, minimum: MINIMUM_ATTRIBUTES });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body.map((p: { code: string }) => p.code)).toEqual(["kursi_roda_manual", "alat_bantu_jalan", "netra"]);
    expect(body[0]).toHaveProperty("rule_groups");
    expect(body[0]).toHaveProperty("minimum_attributes");
  });

  it("basis data tidak bisa dibaca → 503 dengan bentuk galat seragam, bukan salinan aturan dari kode", async () => {
    muatAturan.mockRejectedValue(new Error("koneksi Cloud SQL ditolak"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      code: "RULES_UNAVAILABLE",
      message: "Aturan profil tidak dapat dibaca dari basis data.",
      measured: null,
      threshold: null,
    });
  });

  it("tidak dirender saat build", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
