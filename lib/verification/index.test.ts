/**
 * Pintu masuk untuk E4 — dipanggil lewat mintaUsulan() di
 * lib/trust/verification-port.ts, yang mengimpor '@/lib/verification' dan
 * memakai suggestWithVertex. Ditulis sebelum index.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const panggil = vi.fn();
vi.mock("./vertex-caller", () => ({ vertexCaller: () => panggil }));

const ENV = { GCP_PROJECT_ID: "proj", VERTEX_LOCATION: "global", VERTEX_MODEL: "gemini-uji" };

async function muat() {
  vi.resetModules();
  return (await import("./index")).suggestWithVertex;
}

const masukan = {
  image: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  mimeType: "image/jpeg",
  vantage: "entrance" as const,
  attributes: [
    { attribute_code: "step_count", ai_suggestable: true, allowed_values: ["0", "1", "2", "3"] },
    { attribute_code: "ramp_wheelchair", ai_suggestable: true, allowed_values: ["yes", "no"] },
    { attribute_code: "kerb", ai_suggestable: false, allowed_values: ["flush", "lowered", "raised"] },
  ],
};

beforeEach(() => {
  panggil.mockReset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});
afterEach(() => vi.unstubAllEnvs());

describe("suggestWithVertex (bentuk SuggestResult yang dipakai E4)", () => {
  it("status ok, usulan membawa confidence untuk disimpan E4, bentuk utuh enam kunci", async () => {
    panggil.mockResolvedValue(JSON.stringify({ step_count: { value: "2", confidence: 0.9 }, ramp_wheelchair: { value: "not_visible", confidence: 0.6 } }));
    const r = await (await muat())(masukan);
    expect(r.status).toBe("ok");
    expect(r.model).toBe("gemini-uji");
    expect(Object.keys(r).sort()).toEqual(["latency_ms", "model", "prompt_version", "reason", "status", "suggestions"]);
    expect(r.suggestions).toEqual([
      { attribute_code: "step_count", value: "2", confidence: 0.9, active: true },
      { attribute_code: "ramp_wheelchair", value: "not_visible", confidence: 0.6, active: true },
    ]);
  });

  it("env model kosong → status off beserta sebabnya, model tidak dipanggil", async () => {
    vi.stubEnv("VERTEX_MODEL", "");
    const r = await (await muat())(masukan);
    expect(r).toMatchObject({ status: "off", suggestions: [] });
    expect(r.reason).toMatch(/VERTEX_MODEL/);
    expect(panggil).not.toHaveBeenCalled();
  });

  it("galat model → status failed beserta sebabnya, tidak pernah melempar", async () => {
    panggil.mockRejectedValue(new Error("503 sibuk"));
    const r = await (await muat())(masukan);
    expect(r.status).toBe("failed");
    expect(r.reason).toMatch(/503/);
  });

  it("lewat batas waktu VERTEX_TIMEOUT_MS → status timeout, tanpa retry", async () => {
    vi.stubEnv("VERTEX_TIMEOUT_MS", "40");
    panggil.mockImplementation(() => new Promise(() => {}));
    const r = await (await muat())(masukan);
    expect(r.status).toBe("timeout");
    expect(panggil).toHaveBeenCalledTimes(1);
  });
});
