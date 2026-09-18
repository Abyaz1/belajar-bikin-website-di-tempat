/**
 * Penjaga: data acuan di migrasi harus identik dengan reference.ts, yang juga
 * dipakai tes rules engine. Kalau gagal, tabel dan tes sedang menilai dengan
 * aturan yang berbeda.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { referenceInsertSql } from "./sql";

const FOLDER = path.join(process.cwd(), "db", "migrations");

describe("migrasi data acuan", () => {
  it("memuat INSERT yang dibangkitkan dari reference.ts, persis", () => {
    const berkas = readdirSync(FOLDER).find((n) => n.endsWith("_verifikasi_referensi.sql"));
    expect(berkas, "migrasi *_verifikasi_referensi.sql tidak ditemukan").toBeDefined();
    const isi = readFileSync(path.join(FOLDER, berkas!), "utf8").replace(/\r\n/g, "\n");
    expect(isi).toContain(referenceInsertSql());
  });

  it("tidak ada kolom penilaian atau status yang disimpan (00-KONTRAK §2 aturan 1 dan 3)", () => {
    for (const n of readdirSync(FOLDER).filter((x) => x.endsWith(".sql"))) {
      const ddl = readFileSync(path.join(FOLDER, n), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("--") && !/^\s*(insert|\()/i.test(l))
        .join("\n")
        .toLowerCase();
      expect(ddl, n).not.toMatch(/\b(verdict_result|accessibility_score|score|status)\b\s+(text|integer|numeric|boolean)/);
    }
  });
});
