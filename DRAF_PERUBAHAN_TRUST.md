# Draf entri `PERUBAHAN.md` — jalur tulis (Trust engineer)

Status: **draf**. Lima entri di bawah ini disusun untuk dipindahkan ke
`PERUBAHAN.md` oleh problem owner, memakai format baku empat bagian yang
diwajibkan ketentuan teknis no. 4.

Kelimanya adalah penyimpangan terhadap `docs/10-trust.md` (TRD v2.1) yang
diputuskan **di dalam sesi**, saat menulis kode, bukan saat merancang. Tiga di
antaranya — entri 1, 2, dan 4 — ditemukan karena spesifikasinya tidak bisa
dijalankan apa adanya. Itu bukan hal yang perlu disamarkan: metrik penilaian
no. 1 menilai justifikasi perubahan, dan tim yang menemukan cacat pada
rancangannya sendiri lewat implementasi punya cerita yang lebih kuat daripada
tim yang rancangannya kebetulan tidak pernah diuji.

Urutan entri mengikuti urutan ditemukannya, bukan tingkat kepentingannya.

---

## Entri 1 — Kolom token bukti dipecah menjadi klaim klien dan hasil verifikasi server

**Kondisi di proposal.**
TRD §1 mendefinisikan tabel `evidence` dengan satu kolom untuk token sesi
penangkapan. TRD §E4 secara terpisah mewajibkan bahwa kontribusi yang ditolak
tetap menulis baris `evidence`, `provenance_check`, dan `audit_event`
`provenance_failed` — hanya atributnya yang tidak ditulis. Aturan 4 pada
`docs/00-KONTRAK.md` §2 menyatakan hal yang sama sebagai aturan yang tidak
boleh dilanggar kode.

**Hal yang diubah.**
Satu kolom itu dipecah jadi dua. `claimed_capture_token` menyimpan token persis
sebagaimana dikirim klien: `NOT NULL`, tanpa foreign key, tanpa `UNIQUE`.
`capture_session_token` berupa foreign key `UNIQUE` yang boleh `NULL`, dan
hanya terisi ketika C0 berhasil mencocokkan token itu ke sesi penangkapan yang
sah. Perubahannya ada di `db/migrations/202609181302_trust_perbaikan.sql`.

**Alasan perubahan.**
Rancangan semula tidak bisa dijalankan. Penyebab paling umum C0 gagal adalah
token yang tidak dikenal — dan dengan satu kolom `NOT NULL` yang sekaligus foreign key,
baris `evidence` untuk kasus itu mustahil ditulis karena melanggar integritas
referensial. Artinya justru kelas penolakan yang paling sering terjadi tidak
akan pernah punya jejak audit, dan aturan 4 gagal ditegakkan tepat di tempat
dia paling dibutuhkan. Kontradiksi ini baru terlihat saat menulis E4, bukan
saat menulis TRD.

**Dampaknya terhadap masalah inti.**
Masalah inti kami adalah platform yang menyimpan klaim tanpa dasar dan tidak
bisa menjawab atas dasar apa, oleh siapa, kapan terakhir diperiksa. Pemecahan
kolom ini membuat pembedaan itu berbentuk fisik di dalam skema: ada kolom untuk
apa yang **dinyatakan**, dan kolom terpisah untuk apa yang **berhasil
diverifikasi**. Keduanya bisa ditunjukkan berdampingan ke juri. Selain itu,
kelas penolakan token palsu dan token kedaluwarsa kini benar-benar punya jejak
audit, yang berarti panel uji penolakan punya isi dan keterlacakan 100 persen
bukan angka yang kami bulatkan ke atas.

---

## Entri 2 — Tabel `draft_suggestion` ditambahkan sebagai ingatan server atas usulan model

**Kondisi di proposal.**
TRD §E5 mengunci bentuk kiriman klien ke `[{ attribute_code, confirmed_value }]`
— tidak ada nilai usulan di dalamnya. Pada saat yang sama TRD §1 mewajibkan
tabel `observation` menyimpan `ai_suggested_value` dan `ai_confidence`, dan
menurunkan `was_corrected` dari perbandingan keduanya terhadap
`confirmed_value`.

**Hal yang diubah.**
Ditambahkan tabel `draft_suggestion` (`evidence_id`, `attribute_code`,
`ai_suggested_value`, `ai_confidence`), bersifat append-only, ditulis oleh E4
segera setelah model menjawab dan dibaca oleh E5 saat membentuk `observation`.
Ada di `db/migrations/202609181303_trust_draft_suggestion.sql`.

**Alasan perubahan.**
Tanpa tabel ini, server tidak punya cara mengingat apa yang diusulkan model di
antara E4 dan E5, sehingga satu-satunya sumber nilai usulan adalah kiriman
klien. Itu berarti angka yang mengukur seberapa sering kontributor mengoreksi
AI akan ditulis oleh pihak yang paling berkepentingan mengubahnya. Kami sudah
memutuskan sebelumnya bahwa precision diukur dari himpunan uji berlabel dan
bukan dari tingkat koreksi kontributor; keputusan itu jadi kosong kalau tingkat
koreksinya sendiri tidak bisa dipercaya.

**Dampaknya terhadap masalah inti.**
Produk ini berdiri di atas klaim bahwa AI adalah asisten, bukan otoritas.
Bukti bahwa klaim itu benar adalah catatan tentang berapa kali manusia menolak
usulan mesin. Kalau catatan itu bisa dikarang klien, buktinya hilang dan yang
tersisa cuma janji. Tabel ini membuat `was_corrected` menjadi angka yang bisa
dipertanggungjawabkan sumbernya.

---

## Entri 3 — Tabel `observation` dijadikan append-only

**Kondisi di proposal.**
TRD §1 hanya menyebut `provenance_check` sebagai append-only. `observation`
tidak diberi keterangan apa pun soal ini, yang secara praktis berarti bisa
di-`UPDATE` dan di-`DELETE`.

**Hal yang diubah.**
`observation` diberi Row Level Security tanpa policy `UPDATE` maupun `DELETE`,
ditambah trigger penolak mutasi dan pencabutan hak di level `GRANT`. Tiga
lapis, di `db/migrations/202609181300_trust_skema.sql` §10.3. Konsekuensinya, satu-satunya
cara mengubah nilai yang sudah dikonfirmasi adalah lewat kontribusi baru.

**Alasan perubahan.**
Aturan 2 — nilai usulan AI tidak berlaku tanpa konfirmasi kontributor —
ditegakkan lewat `confirmed_value NOT NULL` pada saat baris dibuat. Kalau baris
itu bisa di-`UPDATE` sesudahnya, penegakan tersebut cuma berlaku satu kali
seumur baris, dan nilai yang sudah dikonfirmasi manusia bisa ditimpa oleh jalur
kode mana pun tanpa ada manusia kedua yang menyetujuinya. Kami juga sudah
memutuskan bahwa sanggahan berbentuk kontribusi tandingan yang memunculkan
penanda sengketa, bukan penyuntingan nilai lama; membiarkan `UPDATE` terbuka
menyediakan jalur kedua yang bertentangan dengan keputusan itu.

**Dampaknya terhadap masalah inti.**
Keterlacakan berubah dari disiplin tim menjadi sifat basis data. Setiap nilai
yang pernah berlaku tetap ada beserta bukti dan waktunya, dan konflik antar
kontributor tampil sebagai sengketa alih-alih diratakan diam-diam oleh
penyuntingan terakhir. Itu persis kebalikan dari kegagalan yang kami tuduhkan
ke platform yang sudah ada.

---

## Entri 4 — `was_corrected` menjadi kolom terhitung (generated), bukan kolom yang diisi aplikasi

**Kondisi di proposal.**
TRD §1 mendaftarkan `was_corrected` sebagai kolom boolean biasa, dengan
keterangan "true kalau confirmed ≠ suggested".

**Hal yang diubah.**
Menjadi `GENERATED ALWAYS AS (ai_suggested_value IS NOT NULL AND confirmed_value
IS DISTINCT FROM ai_suggested_value) STORED`. Ada di
`db/migrations/202609181300_trust_skema.sql` §7.

**Alasan perubahan.**
Rumus di TRD ambigu untuk kasus yang justru paling sering terjadi: lima dari
delapan atribut memang tidak pernah mendapat usulan AI. Untuk atribut-atribut
itu `ai_suggested_value` bernilai NULL, dan pembacaan harfiah "confirmed ≠
suggested" menghasilkan **true** — artinya setiap pengisian manual akan tercatat
sebagai "kontributor mengoreksi AI". Kesalahan ini menggelembungkan angka
koreksi ke arah yang kebetulan menguntungkan kami, dan itu justru alasan dia
harus ditutup di level skema, bukan diserahkan ke kehati-hatian penulis kode.

**Dampaknya terhadap masalah inti.**
Bobot penilaian terbesar kedua menyebut kejujuran terhadap batasan sistem.
Angka yang menguntungkan kami karena salah rumus adalah bentuk paling halus
dari ketidakjujuran, dan yang paling sulit dibela kalau juri memeriksanya
sendiri. Kolom terhitung membuat angka itu tidak bisa salah tulis dari jalur
kode mana pun.

---

## Entri 5 — Action `session_created` ditambahkan ke `audit_event`

**Kondisi di proposal.**
TRD §1 mengunci daftar action jejak audit ke lima nilai: `evidence_submitted`,
`provenance_failed`, `observation_confirmed`, `state_updated`, dan
`rate_limit_reset`. Tidak ada satu pun yang berarti "sesi anonim dibuat".

**Hal yang diubah.**
Ditambahkan nilai keenam, `session_created`, ke `CHECK` constraint pada
`audit_event`, dan E7 memakainya. Sebelum keputusan ini diambil, E7 sementara
memakai `rate_limit_reset` — efeknya memang benar, tapi namanya menyesatkan
pada jejak audit yang terbuka untuk publik.

**Alasan perubahan.**
C1 menghitung kontribusi per kontributor. Karena itu meminta sesi anonim baru
adalah cara paling murah memutar satu-satunya pembatas laju yang kami punya,
dan siapa pun bisa melakukannya kapan saja tanpa perangkat khusus. Itu batas
nyata dari lapisan ini. Batas yang tidak meninggalkan jejak tidak bisa diukur,
tidak bisa dilaporkan, dan tidak bisa dibela ketika ditanyakan.

**Dampaknya terhadap masalah inti.**
Tesis kami bukan bahwa kontribusi tidak bisa dipalsukan, melainkan bahwa
memalsukannya jadi mahal dan setiap jejaknya terlihat. Mencatat pembuatan sesi
membuat celah termurah pada tesis itu ikut terlihat di jejak audit yang sama
dengan yang dipakai untuk menampilkan bukti — bukan disembunyikan di tempat
lain, dan bukan tidak dicatat sama sekali.

---

## Catatan untuk problem owner

Tiga hal yang sebaiknya ikut disebut saat entri ini dipindahkan ke
`PERUBAHAN.md`:

1. **Entri 1, 2, dan 4 adalah cacat pada rancangan kami sendiri**, ditemukan
   karena spesifikasinya benar-benar dituliskan jadi kode di dalam sesi. Tulis
   apa adanya, termasuk bahwa ketiganya tidak terlihat saat merancang. Pola ini
   sama dengan entri 10 pada daftar lima belas perubahan — tim menemukan
   masalah pada dirinya sendiri lewat pengujian — dan entri itu sudah
   disepakati sebagai yang paling kuat.
2. **Kelimanya menambah pengekangan, tidak ada yang melonggarkan.** Tidak satu
   pun dari perubahan ini membuat sesuatu lebih mudah lolos.
3. **Satu duplikasi disengaja dan tidak dicatat sebagai perubahan**, karena
   tidak mengubah alur maupun fitur: logika mesin status ditulis dua kali, di
   `lib/trust/attribute-state.ts` dan di `db/seed/seed_demo.sql` §4, supaya
   skrip penyemaian bisa dijalankan tanpa menyalakan aplikasi. Yang menjaga
   keduanya tetap sinkron adalah blok verifikasi di akhir skrip seed, yang
   gagal keras kalau ada atribut terverifikasi tanpa jejak audit. Kalau juri
   menanyakannya, itu jawabannya — bukan bahwa kami tidak menyadarinya.
