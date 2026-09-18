# CLAUDE.md — Instruksi Repositori

Tim: **belajar bikin website di tempat** · Hack Day IFEST 2026 · 18–19 September 2026
Nama produk: **Astara** (satu sumber di `lib/ui/brand.ts`, jangan ditulis ulang di tempat lain)

Berkas ini adalah kontrak bersama tim, dipadatkan dari dokumen kerja internal (PRD dan TRD
v2.1, serta kontrak lengkap `docs/00-KONTRAK.md`) yang tidak di-commit. Dibaca asisten koding
dan manusia. **Kalau isi berkas ini bentrok dengan kontrak lengkap, yang menang kontrak lengkap,
dan perbedaannya dicatat di `PERUBAHAN.md`.**
Kontrak dibekukan jam 10:00. Perubahan sesudahnya butuh persetujuan tiga engineer dan satu
entri di `PERUBAHAN.md`.

---

## 1. Produk ini apa

Sistem verifikasi atribut aksesibilitas fasilitas publik. Yang disimpan adalah **fakta fisik
yang bisa diamati**, bukan penilaian. Penilaian dihitung saat request, dengan menerapkan profil
kebutuhan pengguna ke fakta itu. Tidak ada atribut tersimpan tanpa foto, hasil pemeriksaan
keaslian, dan timestamp.

**Ini bukan aplikasi peta.** Peta hanya salah satu cara menyajikan hasil. Jangan menamai modul,
variabel, commit, atau komentar dengan istilah yang memosisikan produk ini sebagai aplikasi peta.

### Aturan bahasa, berlaku di kode, komentar, pesan galat, dan dokumen

Jangan pernah menulis bahwa sistem **"memastikan"**, **"menjamin"**, atau **"memverifikasi
keaslian"** sesuatu, kalau yang sebenarnya terjadi cuma **"mempersulit"**. Seluruh data provenans
— koordinat, akurasi, timestamp, metode penangkapan — dinyatakan klien dan bisa dipalsukan oleh
penyerang yang memanggil API langsung. Lapisan ini menaikkan biaya pemalsuan, bukan menutup celah.
Kalimat yang benar: *"tidak dijamin, yang dilakukan sistem adalah ..."*.

---

## 2. Enam aturan yang tidak boleh dilanggar kode

Keenamnya ditegakkan di level **database dan API**, bukan di UI. Kalau sebuah perubahan melanggar
salah satunya, perubahan itu ditolak, apa pun alasan kecepatannya.

| # | Aturan | Bentuk teknisnya |
|---|---|---|
| 1 | Penilaian tidak pernah disimpan ke database. Yang disimpan fakta | Tidak ada kolom `assessment`/`rating`/`score` di skema mana pun. Penilaian = fungsi murni dipanggil saat request |
| 2 | Nilai usulan AI tidak boleh jadi nilai berlaku tanpa konfirmasi kontributor | `observation.confirmed_value` berstatus **NOT NULL** di level DDL. E4 tidak pernah menulis `observation`. Hanya E5 yang menulis |
| 3 | Status kesegaran tidak disimpan sebagai kolom | Tidak ada kolom `status` di `attribute_state`. Diturunkan dari `last_verified_at` dan `next_review_at` lewat **satu** fungsi bersama |
| 4 | Kontribusi yang ditolak tetap masuk audit log | Gagal provenans tetap menulis `evidence`, `provenance_check`, dan `audit_event` `provenance_failed`. Yang tidak ditulis hanya atribut |
| 5 | Angka keyakinan tidak pernah tampil ke pengguna | `observation.ai_confidence` disimpan, tapi **dilarang** muncul di response payload mana pun. Serializer wajib memakai allow-list kolom, bukan `SELECT *` |
| 6 | Setiap penolakan menampilkan alasan **dan** nilai terukurnya | Bentuk galat seragam `{ code, message, measured, threshold }` |

**Yang tidak pernah dipotong, berapa pun sisa waktunya:** penolakan berbukti, konfirmasi wajib,
aturan profil, jejak audit. Keempatnya adalah alasan produk ini ada.

---

## 3. Kepemilikan folder — mutlak

Tidak ada dua orang menyentuh berkas yang sama. Butuh sesuatu di folder orang lain? **Minta,
jangan kerjakan sendiri.** Satu cabang per orang, digabung ke `main` di tiap titik integrasi.

| Pemilik | Folder |
|---|---|
| **Product** | `app/(kontribusi)/`, `app/tempat/` (daftar + peta), `components/`, token design system, konfigurasi deploy |
| **Trust** | `lib/trust/`, `app/api/contributions/`, `app/api/session/`, `app/api/capture-sessions/`, migrasi tabel jalur tulis |
| **Verification** | `lib/rules/`, `lib/verification/`, `app/api/places/`, `app/api/profiles/`, `scripts/seed/`, dan **sejak jam 21:00** rute sisi baca L4/L5/L6 di direktori rute terpisah |
| **Problem owner** | `PERUBAHAN.md`, `docs/PROGRESS.md` (tidak di-commit), data uji, deck, video |

Yang membaca keluaran asisten koding adalah **pemilik folder itu**, sebelum di-commit. Panitia
mengizinkan AI, jadi tidak ada yang perlu disembunyikan — tapi ada yang perlu dipahami, karena
kamu akan ditanya soal kode di foldermu.

---

## 4. Kamus atribut

Delapan atribut. Disimpan di tabel `attribute_type`, **bukan di-hardcode di kode**.

| code | tipe | nilai sah | titik pandang | wajib | usulan AI | tinjau ulang |
|---|---|---|---|---|---|---|
| `step_count` | integer | 0–20 | entrance | **ya** | **ya** | 365 hari |
| `ramp_wheelchair` | enum | `yes` `no` | entrance | **ya** | **ya** | 365 |
| `kerb` | enum | `flush` `lowered` `raised` | entrance | tidak | tidak | 365 |
| `door_width_band` | enum | `lt80` `80_90` `gt90` | entrance | tidak | tidak | 365 |
| `surface_condition` | enum | `good` `uneven` `damaged` | entrance | tidak | tidak | 365 |
| `tactile_paving` | enum | `yes` `no` | entrance | tidak | **ya** | 365 |
| `elevator_status` | enum | `none` `working` `not_working` | interior | tidak | tidak | **90** |
| `toilets_wheelchair` | enum | `yes` `no` | toilet | tidak | tidak | 365 |

**Hanya tiga atribut yang boleh dapat usulan AI**, yaitu yang precision-nya diukur. Sisanya diisi
kontributor. Ini disiplin, bukan keterbatasan.

`step_count = 0` berarti **terverifikasi tidak ada anak tangga**, berbeda dari belum diketahui.
Sama untuk `ramp_wheelchair = no` dan `elevator_status = none`.

`not_visible` sah di level `observation` untuk atribut mana pun. Dicatat, masuk audit,
**tidak membentuk `attribute_state`**.

---

## 5. Titik pandang

| kode | wajib | atribut yang boleh diklaim |
|---|---|---|
| `entrance` | ya | step_count, ramp_wheelchair, kerb, door_width_band, surface_condition, tactile_paving |
| `interior` | tidak | elevator_status |
| `toilet` | tidak | toilets_wheelchair |

Kontribusi minimum yang sah: **satu foto `entrance` dengan `step_count` dan `ramp_wheelchair`
terkonfirmasi.**

Atribut di luar daftar titik pandangnya **ditolak 400** di API. Foto pintu masuk tidak boleh
mendasari klaim lift atau toilet.

---

## 6. Kosakata status dan penilaian

**Status atribut** — diturunkan saat baca, tidak disimpan:
`belum_terverifikasi` · `terverifikasi` · `perlu_ditinjau_ulang`

Penanda tambahan: `is_disputed` (boolean, **disimpan**)

**Penilaian** — dihitung saat request, tidak pernah disimpan:
`dapat_diakses` · `dengan_catatan` · `tidak_dapat_diakses` · `belum_dapat_dipastikan`

**Profil:** `kursi_roda_manual` · `alat_bantu_jalan` · `netra`

Tempat tanpa bukti apa pun **tidak boleh** dinilai `dapat_diakses` untuk profil mana pun.
Ini cacat yang ditemukan tim lewat pengujian pada rancangannya sendiri dan sudah diperbaiki.

Badge `terverifikasi` **tidak boleh hijau**.

---

## 7. Kode alasan penolakan

Dipakai bersama server dan klien. Kalimat untuk manusia ditentukan server.

| kode | kalimat |
|---|---|
| `CAPTURE_SESSION_INVALID` | Sesi pengambilan foto sudah kedaluwarsa. Buka ulang layar kamera |
| `RATE_LIMITED` | Terlalu banyak kontribusi dalam waktu singkat |
| `FILE_METADATA_PRESENT` | Berkas ini tampak berasal dari galeri, bukan dari kamera aplikasi |
| `TIMESTAMP_SKEW` | Waktu pengambilan tidak wajar |
| `GEO_MISSING` | Izin lokasi diperlukan untuk memverifikasi kontribusi |
| `GEO_ACCURACY_LOW` | Ketelitian lokasi terlalu rendah untuk diverifikasi |
| `GEO_FIX_STALE` | Posisi terakhir terlalu lama. Tunggu sebentar lalu ulangi |
| `GEO_TOO_FAR` | Lokasi pengambilan terlalu jauh dari tempat yang dipilih |
| `DUPLICATE_IMAGE` | Foto ini sudah pernah dikirim sebelumnya |

**Bentuk galat seragam, tanpa pengecualian:**

```json
{ "code": "...", "message": "...", "measured": null, "threshold": null }
```

`measured` dan `threshold` boleh null, **kecuali** untuk `GEO_TOO_FAR`, `TIMESTAMP_SKEW`,
`DUPLICATE_IMAGE`, dan `GEO_ACCURACY_LOW` — di keempatnya **wajib diisi**.

Respons gagal E4 memuat **semua** alasan sekaligus: `{ "errors": [ {...}, {...} ] }`.

---

## 8. Konfigurasi terpusat

Semua di env atau tabel config. **Tidak ada satu pun angka di bawah ini boleh di-hardcode.**

| parameter | nilai | nama env |
|---|---|---|
| Rate limit per sesi per jam | 10 | `RATE_LIMIT_PER_HOUR` |
| Selisih waktu maks ke belakang | 180 detik | `SKEW_MAX_BEHIND_S` |
| Selisih waktu maks ke depan | 60 detik | `SKEW_MAX_AHEAD_S` |
| Panjang pHash | 64 bit | `PHASH_BITS` |
| Ambang duplikat identik | Hamming ≤ 2 | `PHASH_IDENTICAL_MAX` |
| Ambang duplikat mirip | Hamming 3–6 | `PHASH_SIMILAR_MAX` |
| Radius dasar | 75 m | `GEO_BASE_RADIUS_M` |
| Batas gagal jarak | 120 m | `GEO_FAIL_RADIUS_M` |
| Akurasi GPS maks diterima | 150 m | `GEO_MAX_ACCURACY_M` |
| Umur fix GPS maks | 60 detik | `GEO_MAX_FIX_AGE_S` |
| Masa berlaku token penangkapan | 10 menit, sekali pakai | `CAPTURE_TOKEN_TTL_S` |
| Sisi terpanjang tangkapan | 1600 px | `CAPTURE_MAX_EDGE_PX` |
| Ukuran unggahan maks | 5 MB | `UPLOAD_MAX_BYTES` |
| Sisi terpanjang foto tayang | 1200 px | `DISPLAY_MAX_EDGE_PX` |
| Timeout model | 8 detik, tanpa retry | `VERTEX_TIMEOUT_MS` |
| Ambang precision aktivasi usulan | 0,85 per atribut | `SUGGESTION_PRECISION_GATE` |

Tidak pernah ada kredensial di dalam commit, sejak commit pertama.

---

## 9. Endpoint

| # | path | method | pemilik |
|---|---|---|---|
| E1 | `GET /api/places` | baca | Verification |
| E2 | `GET /api/places/{id}` | baca | Verification |
| E3 | `GET /api/places/{id}/attributes/{code}/audit` | baca | Verification |
| E4 | `POST /api/contributions/draft` | tulis | **Trust** |
| E5 | `POST /api/contributions/{draftId}/confirm` | tulis | **Trust** |
| E6 | `GET /api/profiles` | baca | Verification |
| E7 | `POST /api/session` | tulis | **Trust** |
| E8 | `POST /api/capture-sessions` | tulis | **Trust** |

**Hanya E5 yang boleh menulis ke `observation` dan `attribute_state`.** Ini bukan konvensi,
ini pagar. E4 menulis `evidence`, `provenance_check`, dan `audit_event` saja.

Parameter **`profile`** wajib di E1 dan E2. Tanpa itu, 400 `PROFILE_REQUIRED`.

Perhatikan ejaannya, karena dua lapisan memakai kata yang berbeda dan itu disengaja
menurut §14: API memakai **`profile`** (bahasa domain, Inggris), sedangkan URL halaman
di bawah memakai **`profil`** (bahasa yang dilihat pengguna, Indonesia). Jadi
`/tempat?profil=netra` benar, dan `/api/places?profile=netra` juga benar; menukar
keduanya menghasilkan 400.

### URL halaman

```
/                                         beranda + pemilih profil
/tempat?profil=...                        daftar dan peta
/tempat/{id}?profil=...                   laporan kesiapan
/tempat/{id}/atribut/{kode}               rincian atribut
/tempat/{id}/atribut/{kode}/audit         jejak audit (tanpa profil)
/kontribusi/{tempatId}/{titikPandang}     alur kontribusi
/uji-penolakan                            panel uji, berlabel jelas
/profil                                   daftar profil dan aturannya
```

---

## 10. Pipeline provenans (jalur tulis, E4)

**Jalankan semua pemeriksaan. Jangan berhenti di kegagalan pertama.** Biayanya hampir nol, dan
layar penolakan harus bisa menampilkan beberapa alasan sekaligus. Yang dilewati kalau ada
kegagalan hanya panggilan model.

```
terima unggahan
 → C0 token sesi penangkapan
 → C1 rate limit
 → C3 metadata berkas
 → C4 selisih waktu
 → C5 geolokasi tersedia
 → C6 ketelitian geolokasi
 → C6b umur fix geolokasi
 → C7 jarak ke tempat
 → C8 berkas berulang
 ↓
 kumpulkan semua hasil
 ├─ ada satu pun fail → 422 dengan SEMUA alasan, model tidak dipanggil
 └─ tidak ada fail    → panggil modul verifikasi
```

| kode | yang diperiksa | gagal kalau | kode alasan |
|---|---|---|---|
| C0 | token sah, belum dipakai, belum lewat 10 menit, place+vantage cocok | tidak memenuhi | `CAPTURE_SESSION_INVALID` |
| C1 | kontribusi per sesi per jam | > 10 | `RATE_LIMITED` |
| C3 | metadata berkas | ada EXIF (kalau pakai getUserMedia) | `FILE_METADATA_PRESENT` |
| C4 | `server_received_at − client_captured_at` | > 180 dtk, atau < −60 dtk | `TIMESTAMP_SKEW` |
| C5 | koordinat klien ada | kosong | `GEO_MISSING` |
| C6 | `client_accuracy_m` | > 150 | `GEO_ACCURACY_LOW` |
| C6b | `server_received_at − client_fix_at` | > 60 dtk | `GEO_FIX_STALE` |
| C7 | jarak ke koordinat tempat | lihat §10.1 | `GEO_TOO_FAR` |
| C8 | pHash | lihat §10.2 | `DUPLICATE_IMAGE` |

**Kontribusi yang ditolak tetap dihitung di C1.** Kalau tidak, rate limit tidak menahan
percobaan berulang.

### 10.1 C7 bertingkat

```
radius_efektif = min(75 + client_accuracy_m, 120)

jarak ≤ radius_efektif        → pass
radius_efektif < jarak ≤ 120  → flag  (diterima, ditandai di audit)
jarak > 120                   → fail
```

Pembatas `min(..., 120)` **wajib**. Tanpa itu, akurasi 45 m ke atas bikin radius efektif melebihi
batas gagal, dan dua aturan saling bertabrakan.

Jarak dihitung dengan Haversine di server, disimpan ke `evidence.distance_to_place_m`.

### 10.2 C8 bergantung konteks

Penguatan justru terjadi ketika beberapa orang memotret pintu yang sama. Ambang tunggal akan
menolak kontribusi sah — **termasuk foto juri di atas panggung**.

| konteks | Hamming ≤ 2 | Hamming 3–6 |
|---|---|---|
| kontributor sama, tempat sama | fail | fail |
| kontributor beda, **tempat + vantage sama** | fail (berkas dioper) | **flag**, bukan fail |
| tempat berbeda | fail | fail |

### 10.3 `capture_method` bukan pemeriksaan

Nilainya dikirim klien. Penyerang tinggal menulis `getusermedia` dan mengirim JPEG bersih.
**Simpan sebagai keterangan di audit, jangan jadikan gerbang.**

Yang menggantikan perannya adalah C0. Yang dijamin C0: pengiriman berasal dari sesi yang dimulai
server, jendela waktu memakai jam server, satu token satu bukti, tempat ditetapkan sebelum foto
diambil. Yang **tidak** dijamin: bahwa bitnya benar-benar dari kamera. Hal yang sama berlaku
untuk koordinat, akurasi, dan timestamp.

---

## 11. Mesin status

Dihitung ulang setiap ada `observation` baru.

1. Ambil semua `observation` untuk pasangan tempat–atribut, buang `not_visible`.
2. Kosong → nilai dari seed OSM kalau ada, `source = osm_seed`, `last_verified_at` null.
3. Ada → `current_value` = nilai observation terbaru, `last_verified_at` = waktunya.
4. `next_review_at = last_verified_at + review_interval_days`.
5. `corroboration_count` = jumlah `contributor_id` **berbeda** yang `confirmed_value`-nya sama
   dengan `current_value` dan masih dalam jendela kesegaran.
6. `is_disputed` = true kalau ada observation dalam jendela kesegaran dengan nilai berbeda.
   Simpan nilai dan waktunya ke `previous_value` / `previous_observed_at`.
7. Tulis `audit_event` `state_updated`.

**Status diturunkan saat baca**, pakai satu fungsi yang dipakai semua jalur baca:

```
last_verified_at null        → belum_terverifikasi
next_review_at < sekarang    → perlu_ditinjau_ulang
selain itu                   → terverifikasi
```

Konflik nilai **ditampilkan**, bukan disembunyikan. Dua nilai berbeda untuk atribut yang sama
adalah perilaku yang dirancang, bukan bug.

---

## 12. Penegakan E5 (urut, berhenti di kegagalan pertama)

1. draft tidak ada atau sudah dikonfirmasi → **409**
2. draft berstatus ditolak → **422**, selamanya
3. ada atribut tanpa `confirmed_value` → **400**
4. ada `attribute_code` di luar vantage-nya → **400**
5. atribut wajib untuk vantage itu tidak dikirim → **400**
6. nilai di luar kosakata atribut → **400**

Sukses: daftar perubahan `attribute_state`, nilai sebelum dan sesudah.

**Kalau ada yang usul melonggarkan konfirmasi wajib demi kecepatan, tolak.** Ini satu-satunya
hal yang tidak boleh dikompromikan. Dia yang bikin kalimat "AI cuma asisten, bukan otoritas"
jadi benar di level kode, bukan cuma janji.

---

## 13. Audit dan keterlacakan

Tabel `provenance_check` dan `audit_event` bersifat **append-only**, ditegakkan lewat
Row Level Security dan pencabutan hak `UPDATE`/`DELETE`, bukan lewat kesopanan aplikasi.

Action yang dipakai: `session_created`, `evidence_submitted`, `provenance_failed`,
`observation_confirmed`, `state_updated`, `rate_limit_reset`.

**Atribut `terverifikasi` tanpa jejak audit adalah cacat, bukan kekurangan. Harus nol.**
Kalau ketemu satu, hentikan pekerjaan lain sampai beres.

Reset rate limit saat latihan demo **wajib lewat action `rate_limit_reset` yang tercatat**,
bukan lewat akal-akalan di database.

Semua data demo diberi `is_demo_seed = true` dan **dilabeli jelas di UI**.

---

## 14. Aturan penulisan kode

- Bahasa domain di kode dan kolom: **Inggris** (`attribute_state`, `confirmed_value`).
  Bahasa yang dilihat pengguna dan pesan commit: **Indonesia**.
- Tidak ada `SELECT *` di jalur yang keluar ke response. Pakai allow-list kolom, supaya
  `ai_confidence` tidak pernah bocor (aturan 5).
- Tidak ada angka ambang di dalam fungsi. Semua dari config (§8).
- Waktu selalu `timestamptz`, selalu jam server untuk keputusan. Jam klien hanya data.
- Uang tidak ada di produk ini; kalau ada kode yang menghitung uang, itu salah tempat.
- **Dilarang** memasang pustaka komponen yang menyalin kode komponen ke dalam repositori
  (ketentuan panitia no. 9). Design system dibangun sendiri dari token dan anatomi.
- **Dilarang** memakai platform no-code atau boilerplate/template siap pakai.

---

## 15. Aturan Git

- Satu cabang per orang sesuai wilayah kepemilikan; digabung ke `main` di tiap titik integrasi.
- **Commit kecil dan sering**, pesan dalam bahasa Indonesia yang jelas. Riwayat berisi tiga
  commit raksasa tampak seperti kode yang disalin dari luar.
- Commit init framework berdiri sendiri, pesannya menyebut tegas bahwa itu keluaran perintah
  init resmi. Commit berikutnya menghapus seluruh halaman dan aset contoh bawaan. **Dua commit
  terpisah.**
- Tidak pernah ada kredensial di dalam commit.
- `PERUBAHAN.md` diperbarui **saat perubahannya terjadi**, tidak dirapel. Tiap entri empat bagian:
  **kondisi di proposal · hal yang diubah · alasan perubahan · dampaknya terhadap masalah inti.**
  Ini berkas bernilai 30 persen, bukan administrasi.

---

## 16. Daftar pemotongan — disepakati jam 0, dipotong dari atas

Hanya bila blok berjalan tertinggal lebih dari dua jam. Yang memutuskan **problem owner**,
bukan engineer yang sedang mengerjakan bagian itu.

1. Pengaburan wajah otomatis → peringatan + alat kabur manual
2. Peluruhan otomatis → data demo bertanggal mundur, dilabeli sebagai data demo
3. Hitungan penguat → tampilkan apa adanya, tanpa pengolahan
4. Umpan balik pengelola fasilitas → dihapus
5. Delapan atribut turun ke lima, yaitu titik pandang pintu masuk saja
6. Lima turun ke dua, yaitu `step_count` dan `ramp_wheelchair`
7. Peta disembunyikan, sisakan daftar

Khusus jalur Trust: kalau tertinggal, **yang dipotong jumlah window rate limit (empat → satu),
bukan pemeriksaan keaslian.** Satu window cukup untuk demo. Pemeriksaan keaslian itu tesisnya.

---

## 17. Yang masih menunggu hasil tes jam 0

**Isi tabel ini begitu hasilnya keluar, lalu bekukan. Jangan menulis kode yang mematok angka
ini sebelum terisi — pakai env.**

| Hal | Nilai | Diputuskan oleh | Dampak kalau berubah |
|---|---|---|---|
| Mekanisme kamera: `getUserMedia` atau input `capture` | **`getUserMedia`** (dibekukan, terbukti di perangkat: Samsung Browser 30 / Android 10 menghasilkan JPEG 480×640 tanpa EXIF dan tanpa tag GPS) | Tes 3 HP | Kalau input `capture`, aturan `FILE_METADATA_PRESENT` berubah dari "ada EXIF apa pun" jadi "ada tag GPS", dan bobotnya turun jadi penanda |
| Radius dasar | **75 m** (dibekukan, **terukur**) | Ukuran GPS di gedung | Diukur 18 Sep di Dipatiukur lewat /uji-kamera: 50 fix, fix pertama 2.167 ms, akurasi terbaik **4 m**, umur fix 0 detik. Radius efektif jadi `min(75+4, 120)` = 79 m. Tidak perlu dinaikkan. Catatan: pembacaan 0 fix sebelumnya berasal dari /uji-kamera yang hanya mencoba `enableHighAccuracy: true` dengan timeout 20 dtk tanpa fallback; alur kontribusi di `lib/ui/geo.tsx` turun ke akurasi rendah tanpa batas waktu, jadi lebih tahan |
| Ambang pHash | **6** (dibekukan, **diukur dan dipertahankan**) | Tes 2 orang foto pintu sama | Sudah diuji 18 Sep: pintu berbeda terdekat 24 dari 66 pasangan, jadi 6 tidak salah tolak dan tidak perlu turun ke 4. Tapi dua HP memotret pintu yang sama dari 2 cm menghasilkan 14, di atas pita penguatan 3–6, sehingga cabang `flag` C8 tidak terjangkau. Pita **tidak** dilebarkan: di dalam pita, semua kombinasi selain kontributor-beda-tempat-sama berujung `fail`, jadi melebarkannya membuat kontributor yang sama memotret ulang pintu yang sama ikut ditolak. Lihat PROGRESS.md |
| Nama model | **`gemini-3.8-flash`** (dibekukan, `VERTEX_LOCATION=global`) | Blok 1 GCP | Env `VERTEX_MODEL`. Mengganti model = ukur ulang precision; angka gerbang berlaku untuk pasangan model+prompt tertentu |

---

## 18. Empat hal yang wajib bisa dijelaskan semua orang

1. Kita bikin sistem verifikasi, hasilnya kebetulan ditampilkan di peta — bukan aplikasi peta.
2. Kita simpan fakta, bukan penilaian, karena kondisi fisik yang sama artinya beda per profil.
3. Tiap atribut bawa buktinya: atas dasar apa, siapa yang bilang, kapan terakhir dicek.
4. Kejujuran terhadap batasan sistem itu dinilai. Mengakui kelemahan dapat nilai, bukan cuma sopan.

Pembagian jawab saat tanya jawab: masalah dan dampak → PO · antarmuka → Product ·
keamanan dan provenans → Trust · model dan angka → Verification.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
