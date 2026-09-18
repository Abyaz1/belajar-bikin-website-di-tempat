/**
 * Tes regresi pemilih atribut (L10) — docs/30-product.md §5.
 */

import { describe, expect, it } from "vitest";
import { NOT_VISIBLE } from "./api/types";
import { EMPTY_CHOICE, STEP_MORE, optionsFor, resolveChoice } from "./choice-logic";
import { ATTRIBUTE } from "./copy";

describe("pilihan jawaban", () => {
  it("allowed_values dari E8 yang memuat not_visible tidak membuat opsi ganda", () => {
    // Daftar ini disalin apa adanya dari jawaban E8 produksi. Server benar
    // menyertakan not_visible -- kontrak §3 menyatakan nilai itu sah untuk
    // atribut mana pun, dan E5 memvalidasi terhadap daftar yang sama.
    // Klien yang menambahkan opsinya lagi membuat dua pilihan bernilai sama,
    // key React kembar di choice.tsx, dan pilihan pengguna tidak terdaftar
    // sehingga tombol kirim menolak. Persis yang terjadi di HP jam 01.40.
    const opts = optionsFor("elevator_status", ["none", "working", "not_working", "not_visible"]);
    expect(opts.filter((o) => o.value === NOT_VISIBLE)).toHaveLength(1);
    expect(opts.at(-1)).toEqual({ value: NOT_VISIBLE, label: "Tidak terlihat dari sini" });
    expect(opts.map((o) => o.value)).toEqual(["none", "working", "not_working", NOT_VISIBLE]);
  });

  it("tidak ada nilai yang muncul dua kali, apa pun kiriman server", () => {
    const opts = optionsFor("ramp_wheelchair", ["yes", "no", "not_visible", "yes"]);
    expect(new Set(opts.map((o) => o.value)).size).toBe(opts.length);
  });

  it.each(Object.keys(ATTRIBUTE))("%s selalu punya opsi 'Tidak terlihat dari sini' di akhir", (code) => {
    const opts = optionsFor(code);
    expect(opts.at(-1)).toEqual({ value: NOT_VISIBLE, label: "Tidak terlihat dari sini" });
  });

  it("step_count memakai pilihan cepat 0·1·2·3·lebih, bukan input angka", () => {
    expect(optionsFor("step_count").map((o) => o.value)).toEqual(["0", "1", "2", "3", STEP_MORE, NOT_VISIBLE]);
  });

  it("nilai sah dari server (claimable.allowed_values) dipakai bila ada", () => {
    expect(optionsFor("kerb", ["flush", "raised"]).map((o) => o.value)).toEqual(["flush", "raised", NOT_VISIBLE]);
  });
});

describe("usulan sistem tidak pernah terpilih otomatis", () => {
  it("isian awal kosong, jadi atribut yang tidak disentuh tidak ikut terkirim", () => {
    expect(EMPTY_CHOICE.pick).toBeNull();
    expect(resolveChoice("step_count", EMPTY_CHOICE)).toBeNull();
    expect(resolveChoice("ramp_wheelchair", EMPTY_CHOICE)).toBeNull();
  });
});

describe("step_count 'lebih dari 3' (00-KONTRAK §3: 0–20)", () => {
  const lebih = (more: string) => resolveChoice("step_count", { pick: STEP_MORE, more });

  it.each(["4", "12", "20"])("%s diterima", (v) => {
    expect(lebih(v)).toEqual({ value: v });
  });

  it.each(["", "3", "21", "2.5", "-1", "empat"])("'%s' ditolak dengan pesan di dekat kolom", (v) => {
    expect(lebih(v)).toHaveProperty("error");
  });

  it("'tidak terlihat' adalah jawaban sah, bukan kosong", () => {
    expect(resolveChoice("step_count", { pick: NOT_VISIBLE, more: "" })).toEqual({ value: NOT_VISIBLE });
  });
});
