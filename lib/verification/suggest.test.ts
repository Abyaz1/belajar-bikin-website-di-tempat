/**
 * Port untuk E4 — kontrak di lib/trust/verification-port.ts (milik Trust).
 * Ditulis sebelum suggest.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const panggil = vi.fn();
vi.mock("./vertex-caller", () => ({ vertexCaller: () => panggil }));

const ENV = { GCP_PROJECT_ID: "proj", VERTEX_LOCATION: "global", VERTEX_MODEL: "gemini-uji" };

async function muatPort() {
  vi.resetModules();
  return (await import("./suggest")).port;
}

const masukan = (over: Record<string, unknown> = {}) => ({
  imageBytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  vantage: "entrance",
  attributeCodes: ["step_count", "ramp_wheelchair", "tactile_paving"],
  timeoutMs: 8000,
  ...over,
});

beforeEach(() => {
  panggil.mockReset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});
afterEach(() => vi.unstubAllEnvs());

describe("port.suggest (dipanggil E4 lewat loadSuggestionPort)", () => {
  it("mengembalikan { attribute_code, value, confidence } untuk jawaban yang sah, termasuk not_visible", async () => {
    panggil.mockResolvedValue(
      JSON.stringify({
        step_count: { value: "2", confidence: 0.9 },
        ramp_wheelchair: { value: "no", confidence: 0.8 },
        tactile_paving: { value: "not_visible", confidence: 0.6 },
      }),
    );
    const port = await muatPort();
    expect(await port.suggest(masukan())).toEqual([
      { attribute_code: "step_count", value: "2", confidence: 0.9 },
      { attribute_code: "ramp_wheelchair", value: "no", confidence: 0.8 },
      { attribute_code: "tactile_paving", value: "not_visible", confidence: 0.6 },
    ]);
  });

  it("jawaban tanpa confidence yang sah dibuang — draft_suggestion.ai_confidence NOT NULL, dan kami tidak mengarang angka", async () => {
    panggil.mockResolvedValue(JSON.stringify({ step_count: { value: "1", confidence: "tinggi" }, ramp_wheelchair: { value: "yes", confidence: 0.7 } }));
    const port = await muatPort();
    expect(await port.suggest(masukan())).toEqual([{ attribute_code: "ramp_wheelchair", value: "yes", confidence: 0.7 }]);
  });

  it("hanya atribut terukur yang pernah ditanyakan, walau E4 mengirim kode lain", async () => {
    panggil.mockResolvedValue("{}");
    const port = await muatPort();
    await port.suggest(masukan({ attributeCodes: ["kerb", "step_count"] }));
    const { schema } = panggil.mock.calls[0][0];
    expect(Object.keys(schema.properties)).toEqual(["step_count"]);
  });

  it("memakai timeoutMs dari E4 (env VERTEX_TIMEOUT_MS milik Trust), tanpa retry", async () => {
    panggil.mockImplementation(() => new Promise(() => {}));
    const port = await muatPort();
    const mulai = Date.now();
    expect(await port.suggest(masukan({ timeoutMs: 40 }))).toEqual([]);
    expect(Date.now() - mulai).toBeLessThan(2000);
    expect(panggil).toHaveBeenCalledTimes(1);
  });

  it("env model kosong → [] tanpa memanggil apa pun (alur manual)", async () => {
    vi.stubEnv("VERTEX_MODEL", "");
    const port = await muatPort();
    expect(await port.suggest(masukan())).toEqual([]);
    expect(panggil).not.toHaveBeenCalled();
  });

  it("titik pandang tak dikenal → [], tidak melempar", async () => {
    const port = await muatPort();
    expect(await port.suggest(masukan({ vantage: "atap" }))).toEqual([]);
  });

  it("galat model tidak pernah bocor sebagai exception", async () => {
    panggil.mockRejectedValue(new Error("503"));
    const port = await muatPort();
    await expect(port.suggest(masukan())).resolves.toEqual([]);
  });
});
