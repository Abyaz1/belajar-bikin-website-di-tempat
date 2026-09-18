# Perubahan dari Proposal

Setiap perubahan terhadap proposal dicatat di sini saat perubahannya terjadi, satu
entri per perubahan.

<!--
Format tiap entri, persis:

## [nomor]. [judul perubahan]
**Kondisi di proposal:** ...
**Yang diubah:** ...
**Alasan perubahan:** ...
**Dampak terhadap masalah inti:** ...
-->

> **Belum lengkap.** Entri di bawah baru mencakup penyimpangan jalur tulis yang
> ditemukan saat implementasi. Lima belas perubahan terhadap proposal penyisihan
> yang sudah disepakati di dokumen perencanaan belum dipindahkan ke sini, dan itu
> pekerjaan problem owner. Penomoran ini sementara; susun ulang saat keduanya
> digabung.

---

## 1. Kolom token bukti dipecah menjadi klaim klien dan hasil verifikasi server

**Kondisi di proposal:** Tabel bukti punya satu kolom untuk token sesi pengambilan
foto. Terpisah dari itu, rancangan mewajibkan kontribusi yang ditolak tetap
menulis baris bukti, hasil pemeriksaan, dan catatan audit — hanya atributnya yang
tidak ditulis.

**Yang diubah:** Satu kolom dipecah jadi dua. `claimed_capture_token` menyimpan
token persis sebagaimana dikirim klien, tanpa foreign key. `capture_session_token`
berupa foreign key unik yang boleh kosong, dan hanya terisi ketika pemeriksaan C0
berhasil mencocokkan token itu ke sesi yang sah.

**Alasan perubahan:** Rancangan semula tidak bisa dijalankan. Penyebab paling umum
C0 gagal adalah token yang tidak dikenal — dan dengan satu kolom wajib berforeign
key, baris bukti untuk kasus itu mustahil ditulis karena melanggar integritas
referensial. Artinya justru kelas penolakan yang paling sering terjadi tidak akan
pernah punya jejak audit. Kontradiksi ini baru terlihat saat rancangan itu
benar-benar dituliskan jadi kode.

**Dampak terhadap masalah inti:** Masalah inti kami adalah platform yang menyimpan
klaim tanpa dasar dan tidak bisa menjawab atas dasar apa, oleh siapa, kapan
terakhir diperiksa. Pemecahan kolom ini membuat pembedaan itu berbentuk fisik di
dalam skema: ada kolom untuk apa yang dinyatakan, dan kolom terpisah untuk apa
yang berhasil diverifikasi. Selain itu penolakan token palsu dan token kedaluwarsa
kini benar-benar punya jejak audit, sehingga keterlacakan 100 persen bukan angka
yang dibulatkan ke atas.

---

## 2. Tabel `draft_suggestion` ditambahkan sebagai ingatan server atas usulan model

**Kondisi di proposal:** Bentuk kiriman saat kontributor mengonfirmasi dikunci
hanya berisi kode atribut dan nilai yang dikonfirmasi. Pada saat yang sama tabel
observasi wajib menyimpan nilai usulan model beserta angka keyakinannya, dan
penanda "dikoreksi" diturunkan dari perbandingan keduanya.

**Yang diubah:** Ditambahkan tabel `draft_suggestion` yang bersifat append-only,
ditulis saat model menjawab dan dibaca saat kontributor mengonfirmasi.

**Alasan perubahan:** Tanpa tabel ini server tidak punya cara mengingat apa yang
diusulkan model di antara dua langkah itu, sehingga satu-satunya sumber nilai
usulan adalah kiriman klien. Itu berarti angka yang mengukur seberapa sering
kontributor mengoreksi AI akan ditulis oleh pihak yang paling berkepentingan
mengubahnya.

**Dampak terhadap masalah inti:** Produk ini berdiri di atas klaim bahwa AI adalah
asisten, bukan otoritas. Bukti bahwa klaim itu benar adalah catatan berapa kali
manusia menolak usulan mesin. Kalau catatan itu bisa dikarang klien, buktinya
hilang dan yang tersisa cuma janji.

---

## 3. Tabel observasi dijadikan append-only

**Kondisi di proposal:** Hanya tabel hasil pemeriksaan keaslian yang disebut
append-only. Tabel observasi tidak diberi keterangan apa pun soal ini, yang secara
praktis berarti bisa diubah dan dihapus.

**Yang diubah:** Tabel observasi diberi Row Level Security tanpa kebijakan ubah
maupun hapus, ditambah trigger penolak dan pencabutan hak di level basis data.
Satu-satunya cara mengubah nilai yang sudah dikonfirmasi adalah lewat kontribusi
baru.

**Alasan perubahan:** Aturan "nilai usulan AI tidak berlaku tanpa konfirmasi
kontributor" ditegakkan saat baris dibuat. Kalau baris itu bisa diubah sesudahnya,
penegakan tersebut hanya berlaku sekali seumur baris, dan nilai yang sudah
dikonfirmasi manusia bisa ditimpa jalur kode mana pun tanpa ada manusia kedua yang
menyetujuinya. Sanggahan juga sudah dirancang berbentuk kontribusi tandingan yang
memunculkan penanda sengketa; membiarkan penyuntingan terbuka menyediakan jalur
kedua yang bertentangan dengan rancangan itu.

**Dampak terhadap masalah inti:** Keterlacakan berubah dari disiplin tim menjadi
sifat basis data. Setiap nilai yang pernah berlaku tetap ada beserta bukti dan
waktunya, dan konflik antar kontributor tampil sebagai sengketa alih-alih
diratakan diam-diam oleh penyuntingan terakhir. Itu kebalikan dari kegagalan yang
kami tuduhkan ke platform yang sudah ada.

---

## 4. Penanda "dikoreksi" menjadi kolom terhitung, bukan kolom yang diisi aplikasi

**Kondisi di proposal:** Penanda itu didaftarkan sebagai kolom boolean biasa,
dengan keterangan "true kalau nilai dikonfirmasi berbeda dari nilai usulan".

**Yang diubah:** Menjadi kolom terhitung yang rumusnya dijaga basis data:
bernilai true hanya kalau ada nilai usulan DAN nilai konfirmasinya berbeda.

**Alasan perubahan:** Rumus semula ambigu untuk kasus yang justru paling sering
terjadi. Lima dari delapan atribut memang tidak pernah mendapat usulan AI, dan
untuk atribut itu nilai usulannya kosong — pembacaan harfiah "dikonfirmasi berbeda
dari usulan" menghasilkan true, sehingga setiap pengisian manual akan tercatat
sebagai koreksi terhadap AI. Kesalahan itu menggelembungkan angka koreksi ke arah
yang kebetulan menguntungkan kami, dan justru itulah alasannya harus ditutup di
level skema.

**Dampak terhadap masalah inti:** Salah satu aspek yang dinilai adalah kejujuran
terhadap batasan sistem. Angka yang menguntungkan kami karena salah rumus adalah
bentuk paling halus dari ketidakjujuran, dan paling sulit dibela kalau juri
memeriksanya sendiri.

---

## 5. Pembuatan sesi anonim ikut dicatat di jejak audit

**Kondisi di proposal:** Daftar tindakan pada jejak audit dikunci ke lima nilai,
dan tidak ada satu pun yang berarti "sesi anonim dibuat".

**Yang diubah:** Ditambahkan tindakan keenam, `session_created`, dan endpoint sesi
memakainya.

**Alasan perubahan:** Pembatas laju menghitung kontribusi per kontributor. Karena
itu meminta sesi anonim baru adalah cara paling murah memutar satu-satunya
pembatas laju yang ada, dan siapa pun bisa melakukannya kapan saja tanpa perangkat
khusus. Itu batas nyata dari lapisan ini, dan batas yang tidak meninggalkan jejak
tidak bisa diukur, tidak bisa dilaporkan, dan tidak bisa dibela ketika ditanyakan.

**Dampak terhadap masalah inti:** Tesis kami bukan bahwa kontribusi tidak bisa
dipalsukan, melainkan bahwa memalsukannya jadi mahal dan setiap jejaknya terlihat.
Mencatat pembuatan sesi membuat celah termurah pada tesis itu ikut terlihat di
jejak audit yang sama dengan yang dipakai menampilkan bukti — bukan disembunyikan
di tempat lain, dan bukan tidak dicatat sama sekali.

---

## 6. Usulan model untuk jalur pemandu dimatikan setelah precision-nya diukur

**Kondisi di proposal:** Kamus atribut menetapkan tiga atribut yang boleh menerima
usulan model — `step_count`, `ramp_wheelchair`, dan `tactile_paving` — dengan
alasan bahwa ketiganya adalah yang precision-nya diukur. Kontrak §7 menetapkan
ambang aktivasi 0,85 per atribut. Tabel `attribute_type` menyalakan ketiganya.

**Yang diubah:** `tactile_paving` dimatikan, `ai_suggestable = false`. Dua atribut
lainnya dibiarkan menyala. Perubahannya berupa migrasi
`202609182330_verifikasi_gerbang_precision.sql`, sudah diterapkan ke basis data
produksi.

**Alasan perubahan:** Ambangnya diukur, bukan diperkirakan. Tiga puluh enam foto
pintu masuk dilabeli manusia lebih dulu, prompt dibekukan di `2026-09-18.v1`
sebelum foto-foto itu ada, lalu model gemini-3.8-flash ditanya satu per satu.
Hasilnya: `step_count` precision 1,00 (n=3), `ramp_wheelchair` 1,00 (n=2),
`tactile_paving` **tidak terdefinisi**. Model tidak pernah sekali pun mengusulkan
"ada jalur pemandu", jadi tidak ada satu pun usulan yang bisa dinilai benar atau
salah. Terpisah dari itu, himpunan ujinya sendiri tidak punya contoh positif: 36
dari 36 citra dilabeli "tidak ada ubin pemandu". Dua alasan yang berdiri sendiri,
dan keduanya soal bukti yang tidak ada — bukan soal model yang terbukti salah.

Dua atribut lain dibiarkan menyala karena aturan gerbang yang dibekukan sebelum
pengukuran memang terpenuhi, dan tidak ada satu pun salah positif. Tapi n-nya 3
dan 2, dan batas bawah selang kepercayaan 95% ada di 0,44 dan 0,34 — jauh di
bawah 0,85. Angka itu tidak boleh disebut tanpa menyebut n-nya. Memperketat
ambang sesudah melihat hasil sama menyesatkannya dengan melonggarkannya, jadi
aturannya diterapkan apa adanya dan ketidakpastiannya dilaporkan terbuka.

**Dampak terhadap masalah inti:** Masalah inti kami adalah platform yang menyimpan
klaim tanpa dasar. Kalau gerbang precision cuma angka di dokumen dan tidak pernah
benar-benar mematikan apa pun, dia adalah janji, bukan pengaman — persis bentuk
klaim tanpa dasar yang kami tuduhkan ke sistem lain, hanya saja tuduhannya
mengarah ke diri sendiri. Satu atribut benar-benar mati hari ini karena tidak
lolos, dan yang mematikannya adalah pengukuran, bukan pendapat. Perlu dicatat
juga bahwa yang menahan nilai salah masuk ke basis data bukan gerbang ini,
melainkan aturan 2: usulan model tidak pernah jadi nilai berlaku tanpa konfirmasi
kontributor. Gerbang ini mengurangi usulan yang mengganggu; dia tidak sendirian
menjaga pintunya.
