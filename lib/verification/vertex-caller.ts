/**
 * Adapter Vertex AI untuk ModelCaller. Tipis dengan sengaja: semua aturan
 * (skema, batas waktu, validasi) ada di core.ts.
 *
 * Kredensial dari Application Default Credentials — lokal lewat
 * `gcloud auth application-default login`, di Cloud Run lewat service account.
 */

import { GoogleGenAI } from "@google/genai";
import type { ModelCaller } from "./core";

export function vertexCaller(opts: { project: string; location: string }): ModelCaller {
  const ai = new GoogleGenAI({ vertexai: true, project: opts.project, location: opts.location });
  return async ({ model, prompt, schema, image, mimeType, signal }) => {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: Buffer.from(image).toString("base64") } }] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0,
        abortSignal: signal,
        // Eksplisit tanpa retry (docs-20 §4), tidak bergantung pada bawaan SDK.
        httpOptions: { retryOptions: { attempts: 1 } },
        // Penalaran dimatikan. gemini-3.8-flash menalar secara bawaan, dan pada
        // foto pintu masuk 1600 px itu menembus anggaran 8 detik kontrak §7:
        // 9,6 dtk menyala, 4,2 dtk mati. Tanpa baris ini seluruh usulan model
        // selalu berakhir "timeout" dan tidak pernah sampai ke layar konfirmasi.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return res.text ?? "";
  };
}
