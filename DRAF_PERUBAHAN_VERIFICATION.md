# Draf entri `PERUBAHAN.md` — jalur baca dan model (Verification engineer)

Status: **draf, satu entri tersisa**. Entri lain (tag `highway=elevator`, uji
pHash dengan hash peramban, pembacaan suara) sudah dipindahkan ke `PERUBAHAN.md`
sebagai entri 6–8.

Entri di bawah menunggu hasil gerbang precision. Bagian hasil diisi setelah
label himpunan uji ditetapkan manusia dan pengukurannya dijalankan. Jangan diisi
perkiraan, lalu pindahkan ke `PERUBAHAN.md`.

---

## Entri 2 — Himpunan uji precision 12 citra, tanpa bagian penyetelan

**Kondisi di proposal:** Gerbang precision 0,85 diukur pada 60–90 citra berlabel
(docs-20 §5). Sebagian citra disisihkan khusus untuk menyetel prompt. Prompt
dibekukan, lalu precision diukur pada sisanya.

**Yang diubah:**
- Himpunan uji berisi 12 foto koridor Dipatiukur, semuanya bagian `ukur`.
- Tidak ada bagian penyetelan. Prompt dibekukan di versi `2026-09-18.v1`
  **sebelum** foto-foto ini ada, jadi tidak ada citra yang pernah dipakai untuk
  menyetelnya.
- Pemisahan dan pelabelnya tercatat di `tools/metrics/testset/labels.json`.

**Alasan perubahan:** Foto koridor yang terkumpul sampai tenggat hanya 12.
Menyisihkan sebagian untuk penyetelan akan menyisakan terlalu sedikit untuk
diukur. Karena prompt dibekukan lebih dulu, syarat intinya tetap terpenuhi:
model tidak pernah disetel pada citra yang dipakai mengukurnya.

**Hasil gerbang:** *[diisi setelah pengukuran: per atribut jumlah usulan, jumlah
salah, precision, interval Wilson 95 persen, cakupan `not_visible`, ukuran
sampel, dan atribut mana yang `ai_suggestable`-nya dimatikan]*

**Dampak terhadap masalah inti:** Dengan 12 citra, intervalnya lebar. Angkanya
cukup untuk menyatakan sebuah atribut **jelas gagal**, tapi belum cukup untuk
menyatakan sebuah atribut lolos dengan yakin. Karena itu keputusan gerbang
condong ke mematikan usulan. Mematikan usulan tidak mengurangi apa pun yang bisa
dicatat: kontributor tetap mengisi atribut itu sendiri, dan konfirmasi manusia
tetap wajib untuk setiap nilai. Yang kami hindari adalah angka precision yang
terlihat meyakinkan tetapi tidak didukung sampelnya.
