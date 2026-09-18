/**
 * Tes kontrak klien jalur tulis terhadap bentuk yang dipakai suite
 * tests/rejection milik Trust. Kalau salah satu gagal, UI dan server sudah
 * tidak bicara bahasa yang sama — dan itu ketahuan di sini, bukan di panggung.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmDraft, openCaptureSession, submitDraft, type DraftInput } from "./client";

function jawab(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function input(over: Partial<DraftInput> = {}): DraftInput {
  return {
    image: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
    captureToken: "tok",
    placeId: "p1",
    vantage: "entrance",
    fix: { lat: -6.9, lon: 107.6, accuracy: 12.34, at: Date.UTC(2026, 8, 18, 5, 0, 0) },
    capturedAt: new Date(Date.UTC(2026, 8, 18, 5, 0, 3)),
    captureMethod: "getusermedia",
    ...over,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("E4 POST /api/contributions/draft", () => {
  it("mengirim berkas di field `file` beserta semua field klien", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jawab(200, { draft_id: "d1", checks: [], suggestions: [], claimable: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await submitDraft(input());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/contributions/draft");
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(form.get("image")).toBeNull();
    expect(form.get("capture_token")).toBe("tok");
    expect(form.get("place_id")).toBe("p1");
    expect(form.get("vantage")).toBe("entrance");
    expect(form.get("capture_method")).toBe("getusermedia");
    expect(form.get("client_lat")).toBe("-6.9");
    expect(form.get("client_lon")).toBe("107.6");
    expect(form.get("client_accuracy_m")).toBe("12.3");
    expect(form.get("client_fix_at")).toBe("2026-09-18T05:00:00.000Z");
    expect(form.get("client_captured_at")).toBe("2026-09-18T05:00:03.000Z");
  });

  it("tanpa fix GPS, koordinat tidak dikirim — server yang memutuskan GEO_MISSING", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jawab(422, { errors: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await submitDraft(input({ fix: null }));
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("client_lat")).toBeNull();
    expect(form.get("client_fix_at")).toBeNull();
  });

  it("422 membawa SEMUA alasan apa adanya", async () => {
    const errors = [
      { code: "FILE_METADATA_PRESENT", message: "m1", measured: null, threshold: null },
      { code: "GEO_TOO_FAR", message: "m2", measured: "214 m", threshold: "120 m" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jawab(422, { errors })));
    expect(await submitDraft(input())).toEqual({ kind: "rejected", errors });
  });

  it("400 FILE_TYPE_INVALID bukan penolakan kontribusi", async () => {
    const e = { code: "FILE_TYPE_INVALID", message: "bukan jpeg", measured: null, threshold: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jawab(400, { errors: [e] })));
    expect(await submitDraft(input())).toEqual({ kind: "error", status: 400, error: e });
  });

  it("jaringan putus → status 0, foto tetap di klien", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await submitDraft(input())).toEqual({ kind: "error", status: 0, error: null });
  });
});

describe("E8 dan E7", () => {
  it("E7 hanya dipanggil bila E8 menjawab belum ada sesi", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jawab(401, { code: "SESSION_REQUIRED", message: "", measured: null, threshold: null }))
      .mockResolvedValueOnce(jawab(200, { contributor_id: "c", display_handle: "Kontributor #1" }))
      .mockResolvedValueOnce(jawab(200, { token: "t", expires_at: "x", claimable: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const s = await openCaptureSession("p1", "entrance");
    expect(s.token).toBe("t");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/capture-sessions", "/api/session", "/api/capture-sessions"]);
  });

  it("sesi yang sudah ada tidak membuat kontributor baru", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jawab(200, { token: "t", expires_at: "x", claimable: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await openCaptureSession("p1", "entrance");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("E5 POST /api/contributions/{draftId}/confirm", () => {
  it("badan berupa larik [{ attribute_code, confirmed_value }]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jawab(200, { changes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await confirmDraft("d 1", [{ attribute_code: "step_count", confirmed_value: "2" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/contributions/d%201/confirm");
    expect(JSON.parse(init.body)).toEqual([{ attribute_code: "step_count", confirmed_value: "2" }]);
  });

  it("409 diteruskan sebagai galat, tidak dianggap tersimpan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jawab(409, { code: "DRAFT_USED", message: "", measured: null, threshold: null })));
    expect((await confirmDraft("d1", [])).kind).toBe("error");
  });
});
