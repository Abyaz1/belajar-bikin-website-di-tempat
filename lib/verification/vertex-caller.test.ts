/**
 * Adapter Vertex memanggil SDK dengan bentuk yang benar. SDK di-mock; uji ke
 * Vertex sungguhan ada di vertex.live.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const konstruktor = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(opts: unknown) {
      konstruktor(opts);
    }
  },
}));

const { vertexCaller } = await import("./vertex-caller");

beforeEach(() => {
  generateContent.mockReset();
  konstruktor.mockReset();
});

describe("vertexCaller", () => {
  it("memakai Vertex (bukan kunci API), gambar inline base64, keluaran JSON terbatas skema, tanpa retry", async () => {
    generateContent.mockResolvedValue({ text: '{"ok":true}' });
    const signal = new AbortController().signal;
    const schema = { type: "object" };

    const teks = await vertexCaller({ project: "proj", location: "global" })({
      model: "gemini-uji",
      prompt: "tanya",
      schema,
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
      signal,
    });

    expect(teks).toBe('{"ok":true}');
    expect(konstruktor).toHaveBeenCalledWith({ vertexai: true, project: "proj", location: "global" });
    const arg = generateContent.mock.calls[0][0];
    expect(arg.model).toBe("gemini-uji");
    expect(arg.contents[0].parts).toEqual([{ text: "tanya" }, { inlineData: { mimeType: "image/jpeg", data: "AQID" } }]);
    expect(arg.config).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0,
      abortSignal: signal,
      httpOptions: { retryOptions: { attempts: 1 } },
    });
  });

  it("jawaban kosong dari SDK jadi string kosong (core.ts yang menandainya failed)", async () => {
    generateContent.mockResolvedValue({ text: undefined });
    const teks = await vertexCaller({ project: "p", location: "l" })({
      model: "m",
      prompt: "",
      schema: {},
      image: new Uint8Array(),
      mimeType: "image/jpeg",
      signal: new AbortController().signal,
    });
    expect(teks).toBe("");
  });
});
