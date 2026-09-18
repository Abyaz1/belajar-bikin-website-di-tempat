/**
 * Tes modul verifikasi — docs-20 §4. Tanpa jaringan: model diganti pemanggil
 * palsu. Ditulis sebelum core.ts.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ATTRIBUTE_TYPES } from "@/lib/rules/reference";
import { buildPrompt, publicSuggestions, responseSchema, suggestAttributes, type AttributeFlag, type ModelCaller } from "./core";

const IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

/** Atribut pintu masuk persis seperti di tabel attribute_type. */
const ENTRANCE: AttributeFlag[] = ATTRIBUTE_TYPES.filter((a) => a.vantage === "entrance").map((a) => ({
  attribute_code: a.code,
  ai_suggestable: a.ai_suggestable,
  allowed_values: a.allowed_values,
}));

const jawab = (obj: unknown): ModelCaller => vi.fn(async () => JSON.stringify(obj));

function jalankan(call: ModelCaller, attributes = ENTRANCE, timeoutMs = 8000) {
  return suggestAttributes({ image: IMAGE, mimeType: "image/jpeg", vantage: "entrance", attributes }, { call, model: "model-uji", timeoutMs });
}

describe("hanya tiga atribut terukur yang ditanyakan", () => {
  it("step_count, ramp_wheelchair, tactile_paving — tidak pernah kerb, lebar pintu, atau permukaan", async () => {
    const call = jawab({});
    await jalankan(call);
    const { schema, prompt } = vi.mocked(call).mock.calls[0][0];
    expect(Object.keys((schema as { properties: object }).properties).sort()).toEqual(["ramp_wheelchair", "step_count", "tactile_paving"]);
    expect(prompt).not.toMatch(/kerb|door_width|surface/);
  });

  it("walau tabel keliru menyalakan ai_suggestable untuk atribut lain, atribut itu tetap tidak ditanyakan", async () => {
    const keliru = ENTRANCE.map((a) => (a.attribute_code === "kerb" ? { ...a, ai_suggestable: true } : a));
    const call = jawab({});
    await jalankan(call, keliru);
    expect(Object.keys((vi.mocked(call).mock.calls[0][0].schema as { properties: object }).properties)).not.toContain("kerb");
  });

  it("gerbang precision: atribut terukur yang dimatikan tidak ditanyakan dan dikembalikan active=false", async () => {
    const tanpaPemandu = ENTRANCE.map((a) => (a.attribute_code === "tactile_paving" ? { ...a, ai_suggestable: false } : a));
    const r = await jalankan(jawab({ step_count: { value: "2", confidence: 0.9 }, ramp_wheelchair: { value: "no", confidence: 0.8 } }), tanpaPemandu);
    expect(r.suggestions).toContainEqual({ attribute_code: "tactile_paving", value: null, confidence: null, active: false });
  });

  it("tidak ada yang boleh ditanyakan → model tidak dipanggil sama sekali", async () => {
    const call = jawab({});
    const r = await suggestAttributes(
      { image: IMAGE, mimeType: "image/jpeg", vantage: "toilet", attributes: [{ attribute_code: "toilets_wheelchair", ai_suggestable: false, allowed_values: ["yes", "no"] }] },
      { call, model: "m" },
    );
    expect(call).not.toHaveBeenCalled();
    expect(r.status).toBe("off");
  });
});

describe("keluaran", () => {
  it("jawaban sah diteruskan, termasuk not_visible apa adanya", async () => {
    const r = await jalankan(
      jawab({
        step_count: { value: "2", confidence: 0.91 },
        ramp_wheelchair: { value: "no", confidence: 0.7 },
        tactile_paving: { value: "not_visible", confidence: 0.6 },
      }),
    );
    expect(r.status).toBe("ok");
    expect(r.suggestions).toEqual([
      { attribute_code: "step_count", value: "2", confidence: 0.91, active: true },
      { attribute_code: "ramp_wheelchair", value: "no", confidence: 0.7, active: true },
      { attribute_code: "tactile_paving", value: "not_visible", confidence: 0.6, active: true },
    ]);
  });

  it("nilai di luar kosakata atribut dibuang, bukan ditebak ulang", async () => {
    const r = await jalankan(
      jawab({ step_count: { value: "banyak", confidence: 0.9 }, ramp_wheelchair: { value: "yes", confidence: 0.8 }, tactile_paving: { value: "21", confidence: 1 } }),
    );
    expect(r.suggestions.map((s) => s.attribute_code)).toEqual(["ramp_wheelchair"]);
  });

  it("confidence di luar 0–1 atau bukan angka jadi null", async () => {
    const r = await jalankan(jawab({ step_count: { value: "0", confidence: 7 }, ramp_wheelchair: { value: "yes", confidence: "tinggi" } }));
    expect(r.suggestions.map((s) => s.confidence)).toEqual([null, null]);
  });

  it("publicSuggestions membuang confidence — angka keyakinan tidak pernah tampil (00-KONTRAK §2 aturan 5)", async () => {
    const r = await jalankan(jawab({ step_count: { value: "1", confidence: 0.5 } }));
    const publik = publicSuggestions(r.suggestions);
    expect(JSON.stringify(publik)).not.toMatch(/confidence/);
    expect(publik).toContainEqual({ attribute_code: "step_count", value: "1", active: true });
  });
});

describe("kegagalan tidak pernah menghentikan alur kontribusi", () => {
  it("JSON rusak → status failed, checklist kosong", async () => {
    const r = await jalankan(vi.fn(async () => "bukan json {"));
    expect(r.status).toBe("failed");
    expect(r.suggestions.filter((s) => s.active)).toEqual([]);
  });

  it("galat jaringan dari model → status failed", async () => {
    const r = await jalankan(vi.fn(async () => Promise.reject(new Error("503"))));
    expect(r.status).toBe("failed");
    expect(r.reason).toMatch(/503/);
  });

  it("melewati batas waktu → status timeout, sinyal dibatalkan, TANPA retry", async () => {
    let signal: AbortSignal | undefined;
    const call = vi.fn<ModelCaller>(
      (req) =>
        new Promise((_, reject) => {
          signal = req.signal;
          req.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const r = await jalankan(call, ENTRANCE, 30);
    expect(r.status).toBe("timeout");
    expect(signal?.aborted).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("pemanggil yang mengabaikan sinyal pun tetap diputus di batas waktu", async () => {
    const r = await jalankan(vi.fn(() => new Promise<string>(() => {})), ENTRANCE, 30);
    expect(r.status).toBe("timeout");
  });

  it("satu panggilan per bukti, bukan per atribut", async () => {
    const call = jawab({});
    await jalankan(call);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("prompt dan skema", () => {
  it("prompt meminta not_visible bila tidak jelas terlihat, dan melarang menebak", () => {
    const p = buildPrompt("entrance", ["step_count", "ramp_wheelchair", "tactile_paving"]);
    expect(p).toMatch(/not_visible/);
    expect(p).toMatch(/do not guess/i);
  });

  it("skema membatasi nilai per atribut, termasuk not_visible", () => {
    const s = responseSchema(ENTRANCE.filter((a) => a.attribute_code === "ramp_wheelchair"));
    expect(s).toMatchObject({
      type: "object",
      required: ["ramp_wheelchair"],
      properties: { ramp_wheelchair: { properties: { value: { enum: ["yes", "no", "not_visible"] } } } },
    });
  });
});

describe("batas modul", () => {
  it("lib/verification tidak pernah mengimpor basis data — hanya mengembalikan usulan", () => {
    const folder = path.join(process.cwd(), "lib", "verification");
    for (const n of readdirSync(folder).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      expect(readFileSync(path.join(folder, n), "utf8"), n).not.toMatch(/from\s+["'](@\/lib\/db|pg|\.\.\/db)/);
    }
  });
});
