# Himpunan uji berlabel — pengukuran precision

Dipakai `lib/verification/presisi.run.test.ts` untuk mengukur precision usulan
model (docs-20 §5). Angka dari sini adalah **satu-satunya yang sah** menjadi
gerbang 0,85.

Citranya tidak ikut ter-commit (lihat `.gitignore` di folder ini) karena foto
nyata. Yang ikut hanya `labels.json`, supaya pemisahan dan pelabelnya terlacak.

---

## Kenapa pengelompokan folder saja belum cukup

Foto datang dikelompokkan `layak` / `kurang_layak` / `tidak_layak`. Itu
**verdict**, dan verdict adalah hasil rules engine menerapkan profil ke atribut —
bukan atributnya sendiri. Satu foto bisa masuk `tidak_layak` karena anak tangga,
karena pintu sempit, atau karena kerb tinggi, dan dari nama foldernya tidak ada
cara mengetahui yang mana.

Yang diukur precision-nya adalah jawaban model **per atribut**. Jadi tiap citra
butuh tiga label terpisah. Kelompok asalnya tetap dicatat di `kelompok_asal`
sebagai konteks, tidak dipakai menghitung.

## Kenapa labelnya harus diisi manusia

docs-20 §5: label ditetapkan manusia **sebelum** model melihat citranya. Kalau
label diisi model lain — termasuk asisten koding — maka yang diukur adalah
kesepakatan antar model, bukan ketepatan terhadap kenyataan. Angkanya akan
terlihat sama, tapi tidak berarti apa-apa, dan itu justru angka yang paling
mungkin ditanyakan juri.

Karena itu `label` di `labels.json` sengaja dibiarkan kosong.

---

## Cara mengisi

Buka `labels.json`, isi tiga medan untuk tiap citra sambil melihat fotonya.

| medan | nilai sah |
|---|---|
| `step_count` | `ada` · `tidak_ada` · `not_visible` — **bukan angka** |
| `ramp_wheelchair` | `yes` · `no` · `not_visible` |
| `tactile_paving` | `yes` · `no` · `not_visible` |

Isi juga `pelabel` dengan namamu.

Aturannya satu: **ragu berarti `not_visible`.** Jangan menyimpulkan dari jenis
bangunan atau dari yang biasanya ada. Kalau bagian itu terpotong, tertutup, atau
tidak jelas, jawabannya `not_visible`. Nilai itu dikeluarkan dari perhitungan
precision dan dilaporkan terpisah sebagai cakupan, jadi memilihnya tidak
merugikan angka — menebak yang merugikan.

`bagian` semuanya `ukur`. Prompt sudah dibekukan di `2026-09-18.v1` sebelum
foto-foto ini ada, jadi tidak ada citra yang perlu disisihkan untuk penyetelan.
Kalau prompt diubah sesudah ini, naikkan versinya dan ukur ulang.

## Cara menjalankan

```bash
set -a && . ./.env.local && set +a
UJI_PRESISI_DIR=tools/metrics/testset npx vitest run lib/verification/presisi.run.test.ts
```

Menghitung ulang tanpa memanggil model lagi:

```bash
UJI_PRESISI_DIR=tools/metrics/testset UJI_PRESISI_JAWABAN=tools/metrics/testset/hasil/<berkas>.json npx vitest run lib/verification/presisi.run.test.ts
```

## Soal ukuran sampel

Ada 12 citra. docs-20 §5 meminta 60–90, dan `presisi.ts` memperingatkan di bawah
20. Pengukuran tetap bisa dijalankan dan **harus dilaporkan apa adanya**, tetapi
dengan 12 citra intervalnya lebar dan angkanya indikatif.

Artinya untuk gerbang 0,85: angka dari 12 citra belum cukup kuat untuk menyatakan
sebuah atribut lolos. Dia cukup untuk menyatakan sebuah atribut **jelas gagal**,
dan itu tetap berguna — mematikan usulan lebih aman daripada menyalakannya.
Sebutkan ukuran sampelnya setiap kali menyebut angkanya.
