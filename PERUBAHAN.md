# Perubahan dari Proposal

Setiap perubahan terhadap proposal dicatat di sini saat perubahannya terjadi, satu
entri per perubahan, mengikuti ketentuan teknis no. 4 dan rubrik penilaian no. 1
(bobot 30%):

```
## [nomor]. [judul perubahan]
**Kondisi di proposal:** ...
**Yang diubah:** ...
**Alasan perubahan:** ...
**Dampak terhadap masalah inti:** ...
```

---

## Bagian I: Perubahan Arsitektur & Konsep (Proposal → Kontrak Bersama)

---

## 1. Pembagian ke dalam tiga titik pandang terpisah

**Kondisi di proposal:** Satu foto di pintu masuk direncanakan untuk memverifikasi
seluruh atribut aksesibilitas tempat, termasuk fasilitas di dalam bangunan seperti
lift dan toilet disabilitas.

**Yang diubah:** Ditetapkan tiga titik pandang (*vantage points*) terpisah:
`entrance` (pintu masuk), `interior` (dalam ruangan), dan `toilet`. Atribut yang
boleh diklaim dikunci ketat per titik pandang. Kontribusi minimum yang sah hanya
mewajibkan titik pandang `entrance` (`step_count` dan `ramp_wheelchair`).

**Alasan perubahan:** Secara optik dan fisik mustahil satu foto dari trotoar di depan
pintu masuk memperlihatkan apakah ada lift di lantai dua atau apakah toilet di
belakang gedung bisa dimasuki kursi roda. Membiarkan kontributor mencentang kondisi
lift dari foto gerbang luar memaksa mereka mengarang fakta.

**Dampak terhadap masalah inti:** API menolak klaim atribut yang berada di luar titik
pandang fotonya, jadi foto pintu masuk tidak bisa lagi mendasari klaim lift atau
toilet. Yang tidak dijamin: isi foto itu sendiri tetap dinyatakan kontributor, dan
kebenarannya bersandar pada konfirmasi manusia serta pemeriksaan provenans.

---

## 2. Kamus sembilan atribut menjadi delapan: `incline` dan `wheelchair` keluar, `surface_condition` masuk

**Kondisi di proposal:** Exsum Lampiran 3 (Tabel L1) memuat sembilan atribut
beserta padanan tag OpenStreetMap-nya: `wheelchair` (yes / limited / no),
`ramp:wheelchair`, `step_count`, `incline` (persen), `tactile_paving`, `kerb`,
`door:width` (meter), `toilets:wheelchair`, dan `highway=elevator`.

**Yang diubah:** Kamus berisi delapan atribut: `step_count`, `ramp_wheelchair`,
`kerb`, `door_width_band`, `surface_condition`, `tactile_paving`,
`elevator_status`, dan `toilets_wheelchair`.
- `incline` dihapus seluruhnya dari skema.
- `wheelchair` dikeluarkan dari kamus dan disimpan terpisah sebagai klaim pihak
  ketiga (entri 5).
- `surface_condition` (`good` / `uneven` / `damaged`) ditambahkan.
- Lebar pintu dan status lift berubah bentuk nilai (entri 3 dan 21).

**Alasan perubahan:**
- `incline`: menaksir sudut kemiringan ramp dari selembar foto 2D tanpa alat ukur
  fisik adalah presisi semu. Sudut pengambilan kamera, perspektif, dan distorsi
  lensa ponsel membuat taksirannya bias, dan taksiran yang keliru pada ramp curam
  bisa berakibat fatal bagi pengguna kursi roda manual.
- `wheelchair`: nilainya adalah penilaian, bukan fakta yang bisa diamati.
  Menyimpannya sebagai atribut bertentangan dengan Keputusan 1 di Exsum 3.1.
- `surface_condition`: Exsum Lampiran 4 (Tabel L2) punya aturan "permukaan rusak
  atau tidak rata" yang berlaku untuk ketiga profil, tetapi Tabel L1 tidak punya
  atribut untuk menampung fakta itu. Aturannya ada, datanya tidak. Atribut ini
  menutup celah tersebut.

**Dampak terhadap masalah inti:** Setiap aturan penilaian kini punya atribut yang
menjadi dasarnya, dan setiap atribut adalah fakta yang bisa dilihat di foto.
Tidak ada lagi estimasi sudut yang tampak presisi, dan tidak ada penilaian pihak
lain yang menyamar sebagai fakta.

---

## 3. Lebar pintu dikelompokkan ke dalam sistem pita, bukan angka sentimeter

**Kondisi di proposal:** Kontributor atau model AI diminta memasukkan perkiraan lebar
bukaan pintu bersih dalam satuan sentimeter (misal: "95 cm").

**Yang diubah:** Lebar pintu dikelompokkan menjadi tiga pita diskret:
kurang dari 80 cm (`lt80`), 80–90 cm (`80_90`), dan lebih dari 90 cm (`gt90`).

**Alasan perubahan:** Mengklaim bahwa manusia atau model penglihatan komputer dapat
mengukur lebar pintu secara presisi hingga satuan sentimeter dari foto acak di
trotoar adalah ketidakjujuran teknis. Di sisi pengguna, standar kursi roda manual
hanya membutuhkan kejelasan batas: apakah pintu di bawah 80 cm (pasti tersangkut),
80–90 cm (muat dengan hati-hati), atau di atas 90 cm (leluasa).

**Dampak terhadap masalah inti:** Mengurangi beban kognitif kontributor dan menutup
celah angka fiktif, sambil tetap memberikan klasifikasi yang cukup bagi rules engine
untuk menentukan kelayakan akses fisik.

---

## 4. Angka keyakinan 0,82 diganti dengan status kesegaran dan penguatan

**Kondisi di proposal:** Setiap atribut atau lokasi diberi skor keyakinan numerik
agregat (misalnya skor keyakinan 82%) yang ditampilkan di antarmuka publik.

**Yang diubah:** Angka persentase keyakinan dihapus dari seluruh tampilan pengguna
(ditegakkan di level API). Digantikan oleh status kesegaran berbasis waktu
(`belum_terverifikasi`, `terverifikasi`, `perlu_ditinjau_ulang`), jumlah penguat
independen (`corroboration_count`), dan penanda sengketa (`is_disputed`).

**Alasan perubahan:** Pada tahap awal dengan 1–2 kontributor per lokasi, angka 0,82
tidak memiliki landasan statistik yang sah dan hanya menjadi angka kosmetik yang
menimbulkan rasa aman palsu.

**Dampak terhadap masalah inti:** Pengguna disabilitas disajikan fakta transparan:
kapan atribut terakhir diperiksa, oleh berapa orang, dan apakah ada perbedaan
kesaksian — bukan persentase buatan yang menutupi minimnya data.

---

## 5. Tag OpenStreetMap `wheelchair` dialihkan menjadi klaim pihak ketiga

**Kondisi di proposal:** Tag `wheelchair=yes/no/limited` dari OpenStreetMap langsung
dipetakan menjadi status aksesibilitas tempat di sistem ini.

**Yang diubah:** Tag `wheelchair` dari OSM tidak pernah dimasukkan ke tabel
`attribute_state` dan tidak pernah menggerakkan rules engine. Tag tersebut disimpan
terpisah ke kolom `place.third_party_claims` dan hanya dimunculkan di jejak audit
dengan label: *"Klaim dari OpenStreetMap, tidak diverifikasi sistem ini"*.

**Alasan perubahan:** Tag `wheelchair` di OSM adalah penilaian (*opinion*), bukan
fakta fisik yang terukur. Siapa pun bisa menambahkan tag itu tanpa bukti foto dan
tanpa definisi terstandar. Banyak tempat dengan tangga tinggi tetap diberi label
`wheelchair=yes` di OSM oleh pembuat peta amatir.

**Dampak terhadap masalah inti:** Menegakkan prinsip dasar produk: sistem ini hanya
menyimpan fakta fisik teramati yang memiliki foto bukti, bukan mendaur ulang opini
pihak ketiga tanpa pertanggungjawaban.

---

## 6. Koreksi klaim lisensi data OpenStreetMap menjadi ODbL

**Kondisi di proposal:** Proposal menyebut data tempat publik akan diimpor dan
disajikan secara bebas "tanpa pembatasan lisensi".

**Yang diubah:** Mengakui secara eksplisit lisensi Open Database License (ODbL) dari
OpenStreetMap. Menyertakan atribusi wajib `© kontributor OpenStreetMap` pada
tampilan daftar dan peta, serta mematuhi klausul *share-alike* untuk data turunan.

**Alasan perubahan:** Data OSM tidak berada di domain publik. Mengklaimnya "tanpa
pembatasan lisensi" adalah kekeliruan pemahaman hukum yang melanggar hak cipta
kontributor OSM.

**Dampak terhadap masalah inti:** Integritas etika data dan kepatuhan hukum sejak
hari pertama, menghindarkan platform dari sengketa lisensi di masa depan.

---

## 7. Autentikasi akun diganti dengan sesi kontributor anonim bertanda tangan HMAC

**Kondisi di proposal:** Kontributor diwajibkan mendaftarkan akun (email dan kata
sandi) sebelum dapat mengirimkan foto dan verifikasi fasilitas.

**Yang diubah:** Pendaftaran akun dihapus. Digantikan oleh pembuatan sesi anonim
instan yang ditandatangani cookie HMAC-SHA256 (`SESSION_SECRET`) pada endpoint E7,
yang menghasilkan `contributor_id` anonim (misal: "Kontributor #7").

**Alasan perubahan:** Kewajiban mendaftar akun merusak target waktu kontribusi
(< 60 detik di trotoar) dan menjadi penghalang besar bagi kontributor spontan. Di
samping itu, skenario demo di atas panggung juri tidak memungkinkan proses
pendaftaran akun email yang memakan waktu.

**Dampak terhadap masalah inti:** Menurunkan friksi kontribusi secara drastis tanpa
mengorbankan akuntabilitas; sesi anonim tetap dapat diikat ke pembatas laju (rate limit)
dan seluruh aksinya tercatat permanen di jejak audit.

---

## 8. Gerbang precision model diukur dari test set berlabel independen

**Kondisi di proposal:** Akurasi model AI direncanakan diukur dari seberapa sering
kontributor menyetujui usulan AI di antarmuka aplikasi.

**Yang diubah:** Tingkat persetujuan kontributor ditolak sebagai ukuran presisi model.
Gerbang aktivasi usulan AI (ambang precision 0,85) wajib diukur secara terpisah pada
himpunan uji citra nyata yang dilabeli manusia sebelum model melihatnya.

**Alasan perubahan:** Tingkat persetujuan pengguna di aplikasi hanya mengukur bias
kepatuhan (*compliance bias* / kecenderungan orang malas mengubah pilihan *default*),
bukan kebenaran model terhadap realitas fisik. Menjadikan tingkat koreksi sebagai
dasar gerbang AI adalah penalaran melingkar (*circular logic*).

**Dampak terhadap masalah inti:** Hak AI memberikan usulan kini digerbangi angka yang
diukur pada citra berlabel manusia, bukan pada tingkat persetujuan kontributor. Yang
tidak dijamin: dengan sampel sekecil yang akhirnya tersedia (entri 28 dan 29), angka
itu indikatif. Yang benar-benar menahan halusinasi model masuk ke basis data adalah
konfirmasi wajib kontributor, bukan gerbang ini.

---

## 9. Penegakan kamera beralih dari string `capture_method` ke token sesi C0

**Kondisi di proposal:** Mencegah pengunggahan foto galeri dengan memeriksa apakah
kolom `capture_method` bernilai `"camera"`.

**Yang diubah:** Nilai string `capture_method` diturunkan statusnya menjadi sekadar
keterangan catatan audit. Penegakan penolakan berkas luar diserahkan ke C0: token sesi
penangkapan kriptografis yang diterbitkan server sesaat sebelum kamera dibuka
(`POST /api/capture-sessions`), terikat ke `place_id` dan `vantage`, berkadaluwarsa
dalam 10 menit, dan hanya dapat digunakan satu kali.

**Alasan perubahan:** Nilai string `capture_method` dideklarasikan oleh klien;
penyerang yang memanggil API secara langsung dapat dengan mudah menyuntikkan teks
`"camera"` sambil mengirimkan berkas dari galeri.

**Dampak terhadap masalah inti:** Mengganti validasi formalitas di sisi klien dengan
pemeriksaan berbasis jam server dan token sekali pakai, menaikkan biaya pemalsuan data
secara signifikan.

---

## 10. Rules Engine wajib memakai himpunan atribut minimum

**Kondisi di proposal:** Penilaian kesiapan tempat (*verdict*) dihitung dengan
mengevaluasi aturan penghalang (*blocker*). Jika tidak ada aturan blocker yang
terpenuhi, tempat langsung dinyatakan `dapat_diakses`.

**Yang diubah:** Diperkenalkan konsep **Himpunan Atribut Minimum** per profil
(`MINIMUM_ATTRIBUTES` di `lib/rules/reference.ts`). Jika ada satu saja atribut dalam himpunan minimum yang belum
terverifikasi, status tempat wajib jatuh ke `belum_dapat_dipastikan`, terlepas dari
apakah ada aturan blocker yang menyala atau tidak.

**Alasan perubahan:** Ini adalah temuan cacat rancangan paling kritis. Profil
`alat_bantu_jalan` dan `netra` tidak memiliki aturan bertipe *blocker* (seluruh
aturannya bertipe *caution*). Pada rancangan proposal awal, himpunan aturan blocker
kedua profil ini kosong. Akibatnya, tempat dari OSM yang baru masuk dan belum
memiliki satu pun foto atau data atribut akan dievaluasi tidak memiliki blocker,
sehingga **otomatis berstatus `dapat_diakses` (hijau)**! Mengganti profil ke netra
akan membuat 39 tempat kosong di koridor berubah hijau tanpa ada satu pun bukti fisik.

| Profil | Kondisi Tempat | Hasil Rancangan Proposal | Hasil Sesudah Diperbaiki |
|---|---|---|---|
| `kursi_roda_manual` | 0 atribut terverifikasi | `belum_dapat_dipastikan` | `belum_dapat_dipastikan` |
| `alat_bantu_jalan` | 0 atribut terverifikasi | ❌ **`dapat_diakses`** (Fatal) | ✅ `belum_dapat_dipastikan` |
| `netra` | 0 atribut terverifikasi | ❌ **`dapat_diakses`** (Fatal) | ✅ `belum_dapat_dipastikan` |
| `kursi_roda_manual` | Tangga ada, ramp tidak ada | `tidak_dapat_diakses` | `tidak_dapat_diakses` |

**Dampak terhadap masalah inti:** Mencegah kesalahan fatal yang dapat membahayakan
penyandang disabilitas di lokasi nyata. Tempat yang belum memiliki bukti dilarang
keras dinyatakan aman untuk dikunjungi.

---

## 11. Penambahan Panel Uji Penolakan (L12) dan revisi batasan pemilih berkas

**Kondisi di proposal:** Antarmuka kontributor mengunci tombol pemilihan berkas
galeri (aturan antarmuka W2) sebagai satu-satunya bentuk pembuktian pencegahan foto
luar.

**Yang diubah:** Dibuat rute khusus `/uji-penolakan` (L12) yang menyediakan instrumen
simulasi penyerangan: mengunggah berkas galeri ber-EXIF, mengirim koordinat GPS palsu
yang jauh, dan mendaur ulang foto yang pernah masuk, semuanya menembak endpoint E4 yang
sama.

**Alasan perubahan:** Kamera produksi (`lib/ui/camera.tsx`) memakai `getUserMedia`
murni sehingga tidak memiliki pemilih berkas. Tanpa panel uji L12, juri di panggung
tidak akan pernah bisa membuktikan klaim bahwa server benar-benar menolak foto galeri
atau foto jarak jauh.

**Dampak terhadap masalah inti:** Menggeser pembuktian keamanan dari "antarmuka kami
tidak menyediakan tombol galeri" menjadi "server kami secara aktif menolak berkas galeri
meskipun dikirim langsung ke API".

---

## 12. Pemindahan atribut jalur pemandu (`tactile_paving`) ke titik pandang pintu masuk

**Kondisi di proposal:** Atribut jalur pemandu difabel netra dialokasikan pada titik
pandang terpisah di luar area pintu masuk (titik pandang pedestrian/trotoar).

**Yang diubah:** `tactile_paving` dipindahkan ke dalam titik pandang `entrance`.

**Alasan perubahan:** Pada tipologi fasilitas publik di Indonesia, jalur pemandu kuning
hampir selalu terletak di trotoar tepat di depan tangga/pintu gerbang masuk. Memisahkan
jalur pemandu ke titik pandang tersendiri memaksa kontributor mengambil dua foto
berbeda untuk satu sudut pandang yang sama, memicu kejenuhan dan melanggar batas waktu
60 detik.

**Dampak terhadap masalah inti:** Mempersingkat beban alur kontribusi tanpa kehilangan
informasi krusial mengenai keberadaan pemandu fisik bagi pengguna netra.

---

## 13. Sanggahan diwujudkan sebagai kontribusi tandingan dan penanda sengketa

**Kondisi di proposal:** Merencanakan sistem pengaduan dan tiket sanggahan manual yang
dikelola oleh moderator internal.

**Yang diubah:** Sistem tiket dihapus. Sanggahan diintegrasikan ke dalam alur
kontribusi normal. Jika ada kontributor baru yang mengirimkan foto bukti sah dengan
nilai yang bertentangan dengan nilai sebelumnya (dan data lama masih dalam jendela
kesegaran), sistem otomatis menyematkan penanda `is_disputed = true` pada atribut
tersebut dan menyimpan nilai pembandingnya ke `previous_value`.

**Alasan perubahan:** Membangun antarmuka tiket sanggahan dan sistem antrean moderasi
adalah jebakan ruang lingkup yang tidak realistis dalam 24 jam, serta menciptakan
ketergantungan pada otoritas admin tunggal.

**Dampak terhadap masalah inti:** Transparansi sengketa terdesentralisasi. Pengguna
langsung diperingatkan saat ada dua bukti fisik yang saling bertolak belakang di
lapangan (misal: satu foto menunjukkan ramp tersedia, foto lain menunjukkan ramp
sedang dibongkar).

---

## 14. Deteksi duplikat pHash disesuaikan secara kontekstual (Ambang bertingkat C8)

**Kondisi di proposal:** Seluruh foto yang memiliki jarak Hamming pHash ≤ 6 terhadap
foto yang sudah ada di basis data akan ditolak mutlak sebagai duplikat.

**Yang diubah:** Ambang pHash C8 dibuat sensitif terhadap konteks pengirim:
- Kontributor sama, tempat sama: Hamming ≤ 6 ditolak (`fail`).
- Kontributor berbeda, tempat sama: Hamming ≤ 2 ditolak (`fail`, terindikasi berkas
  dioper), tetapi Hamming 3–6 **diterima** dan ditandai di jejak audit (`flag`,
  penguatan sah).

**Alasan perubahan:** Dua orang berbeda yang berdiri memotret pintu masuk yang sama
akan menghasilkan foto dengan kemiripan visual tinggi (Hamming 3–6). Ambang tunggal
akan menolak kontributor kedua, padahal kehadiran kontributor independen adalah
bentuk penguatan (*corroboration*) yang dicari sistem.

**Dampak terhadap masalah inti:** Memfasilitasi penguatan data antar-warga sambil
tetap mencegah kecurangan satu akun yang mengirimkan ulang foto yang sama berkali-kali.

---

## 15. Penyederhanaan pembatas laju menjadi satu jendela waktu per jam

**Kondisi di proposal:** Merancang pembatas laju berlapis (*sliding windows*: per menit,
per jam, per hari) yang terikat pada skor reputasi pengguna.

**Yang diubah:** Disederhanakan menjadi satu batasan pasti: maksimal 10 kontribusi per
sesi anonim per jam (C1).

**Alasan perubahan:** Sistem *multi-window sliding* dengan kurva reputasi menambah
kompleksitas basis data dan memicu risiko *race condition* pada lingkungan komputasi
serverless, tanpa memberikan perlindungan tambahan yang signifikan pada skala purwarupa.

**Dampak terhadap masalah inti:** Menjaga keandalan kode jalur tulis tetap sederhana,
deterministik saat dites, dan mudah diaudit saat demo.

---

## Bagian II: Perubahan Teknis selama Implementasi (Jalur Tulis, Baca, & Model)

---

## 16. Kolom token bukti dipecah menjadi klaim klien dan hasil verifikasi server

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

## 17. Tabel `draft_suggestion` ditambahkan sebagai ingatan server atas usulan model

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

## 18. Tabel observasi dijadikan append-only

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

## 19. Penanda "dikoreksi" menjadi kolom terhitung, bukan kolom yang diisi aplikasi

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

## 20. Pembuatan sesi anonim ikut dicatat di jejak audit

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

## 21. Tag `highway=elevator` dari OpenStreetMap tidak dipetakan ke status lift

**Kondisi di proposal:** Exsum Lampiran 3 (Tabel L1) memadankan atribut lift
dengan tag `highway=elevator` ("tersedia; status fungsi"), bersama tag fakta lain
seperti `ramp:wheelchair`, `step_count`, dan `tactile_paving`.

**Yang diubah:** Tag itu tidak dipetakan ke atribut apa pun. `elevator_status`
dari penyemaian selalu kosong, jadi atribut ini hanya bisa terisi lewat
kontribusi berfoto dari titik pandang interior.

**Alasan perubahan:** Kosakata `elevator_status` punya tiga nilai: `none`,
`working`, `not_working`. Tag `highway=elevator` hanya menyatakan liftnya ada.
Tag itu tidak menyatakan liftnya berfungsi, dan ketiadaan tag tidak berarti
`none`. Memetakannya berarti memilih `working` tanpa dasar. Justru klaim tanpa
dasar semacam itu yang ingin dihilangkan produk ini. Ketidaksesuaian ini baru
terlihat saat pemetaannya ditulis jadi kode (`scripts/seed/osm.ts`).

**Dampak terhadap masalah inti:** Hampir tidak ada yang hilang. Pada koridor UNPAD
Dipatiukur, 39 tempat hasil penyemaian hanya membawa 3 klaim atribut, sesuai
perkiraan tim sejak awal bahwa tag koridor Indonesia nyaris kosong. Yang terjaga adalah
disiplinnya: tidak ada nilai di basis data yang lebih yakin daripada sumbernya.
Status lift, satu-satunya atribut dengan masa tinjau ulang 90 hari karena mudah
berubah, tidak pernah berawal dari tebakan.

---

## 22. Uji ambang pHash dengan hash peramban dinyatakan tidak berlaku untuk C8

**Kondisi di proposal:** Ambang pHash (identik ≤ 2, mirip 3–6) diputuskan lewat
tes dua orang memotret pintu yang sama di jam 0. Hasilnya menentukan ambang C8.

**Yang diubah:**
- Tes jam 0 dijalankan di halaman uji kamera, yang menghitung hash **di peramban**.
  Hasilnya: jarak Hamming 16 dari satu pasang foto.
- Hasil itu dinyatakan tidak berlaku untuk C8. Ambang tetap 6 **sementara**.
- Kalibrasi ulang dijalankan dengan hash yang dihitung server, memakai modul
  yang sama dengan yang menegakkan C8 di E4. Ada dua jalan: dari berkas foto
  (`npm run phash:kalibrasi`), atau langsung dari hash bukti nyata yang sudah
  tersimpan (`npm run phash:dari-bukti`) setelah dua orang mengirim foto pintu
  yang sama lewat alur kontribusi.

**Alasan perubahan:** Hash peramban dan hash server berbeda karena dua hal. Basis
mediannya berbeda (peramban menyertakan koefisien DC, server membuangnya), dan
cara mengecilkan gambarnya berbeda (kanvas dan sharp). Ambang yang dikalibrasi
dari angka yang tidak dipakai untuk memutuskan tidak mengukur apa-apa.

**Dampak terhadap masalah inti:** C8 memisahkan berkas yang dioper ulang (ditolak)
dari penguatan oleh orang lain yang memotret pintu yang sama (diterima dan
ditandai). Ambang yang salah menolak penguatan yang sah, termasuk foto juri di
atas panggung. Hasil satu pasang foto (16) juga menunjukkan pHash peka terhadap
posisi pemotretan. Artinya dua foto sah dari sudut berbeda kemungkinan besar
lolos sebagai berkas berbeda, bukan ditandai mirip. Kami melaporkan ini sebagai
batasan: C8 menaikkan biaya mengirim ulang berkas yang sama, tidak mendeteksi
foto ulang dari tempat yang sama.

---

## 23. Pembacaan suara laporan kesiapan untuk pengguna netra

**Kondisi di proposal:** Profil netra dilayani lewat aturan penilaian (jalur
pemandu, tepi trotoar, permukaan) dan lewat antarmuka yang ramah pembaca layar
(Exsum 3.4 menjadikan kepatuhan pembaca layar syarat wajib). Tidak ada keluaran
suara dari produk itu sendiri.

**Yang diubah:** Tombol "Bacakan" di laporan tempat dan rincian atribut.
- Laporan dibacakan dengan mesin suara bawaan perangkat (Web Speech API). Di
  Chrome Android yang terdengar adalah suara Google Bahasa Indonesia.
- Tanpa endpoint baru dan tanpa kunci API. Kontrak E1–E8 tidak berubah.
- Naskahnya disusun untuk didengar, bukan menyalin layar: penilaian selalu
  menyebut profil, tanggal disebut dengan nama bulan utuh, klaim OSM disebut
  sebagai klaim pihak ketiga, dan terverifikasi-tidak-ada dibedakan dari
  belum-diketahui.
- Bacaan hanya mulai saat tombol ditekan.

**Alasan perubahan:**
- Tidak semua pengguna netra atau low vision memakai pembaca layar.
- Yang memakainya harus menavigasi elemen satu per satu untuk menyusun laporan
  utuh.
- Menambah fitur ini murah karena mesin suaranya sudah ada di perangkat pengguna.

**Dampak terhadap masalah inti:** Pertanyaan "bisakah saya ke sana, atas dasar
apa, kapan terakhir dicek" kini bisa dijawab dalam satu kali dengar. Aturan teks
yang sama tetap berlaku di jalur suara: kata "dapat diakses" tidak pernah
terdengar tanpa nama profilnya, dan "belum ada bukti" tidak pernah terdengar
seperti "tidak ada". Fitur ini pelengkap pembaca layar, bukan penggantinya, dan
uji TalkBack/VoiceOver di jam 18 tetap berlaku.

---

## 24. Pengaburan wajah otomatis dikerjakan dengan Cloud Vision, gagal tertutup

**Kondisi di proposal:** Foto bukti ditayangkan setelah wajah dikaburkan
otomatis (`evidence.public_path`). Di daftar pemotongan, pengaburan otomatis
ada di urutan pertama untuk dipotong, dengan pengganti peringatan dan alat
kabur manual.

**Yang diubah:**
- Pengaburan otomatis tidak dipotong.
- Setiap bukti yang lolos kesembilan pemeriksaan dibuatkan turunan tayang:
  dikecilkan ke 1200 px, wajah dideteksi Cloud Vision API, area wajah dipikselkan
  lalu dikaburkan, dan metadatanya dibuang.
- Prosesnya berjalan bersamaan dengan panggilan model, jadi tidak menambah waktu
  tunggu kontributor.
- Foto tayang disajikan lewat rute baca aplikasi. Bucket bukti tetap privat, dan
  rute itu menolak apa pun di luar objek tayang.
- Bukti yang ditolak tidak pernah punya foto tayang.

**Alasan perubahan:** Saat diperiksa malam hari, tidak satu pun bukti punya foto
tayang. Tidak ada jalur yang mengisi `public_path`, dan kolom `photo_url` di API
berisi kunci objek bucket, bukan URL. Artinya klaim "tiap atribut membawa
buktinya" tidak bisa dilihat di layar mana pun. Memakai detektor wajah terkelola
lebih cepat dan lebih andal daripada alat kabur manual yang bergantung pada
ketelitian kontributor di trotoar.

**Dampak terhadap masalah inti:** Foto kembali jadi bagian dari jawaban "atas
dasar apa", bukan hanya jejak di basis data. Batasnya diakui:
- Pengaburan tidak dijamin menangkap semua wajah. Wajah kecil di kejauhan, wajah
  dari samping, dan wajah tertutup bisa lolos. Pelat nomor tidak dideteksi.
- Yang dilakukan sistem adalah mengurangi kemungkinan orang yang kebetulan lewat
  dapat dikenali.
- Kalau deteksi gagal atau lewat batas waktu, fotonya tidak tayang sama sekali.
  Menayangkan foto yang belum diperiksa wajahnya tidak pernah jadi cadangan.
- Bukti demo tidak punya citra sungguhan, jadi tetap tanpa foto.

---

## 25. Usulan model untuk jalur pemandu dimatikan setelah precision-nya diukur

**Kondisi di proposal:** Kamus atribut menetapkan tiga atribut yang boleh menerima
usulan model — `step_count`, `ramp_wheelchair`, dan `tactile_paving` — dengan
alasan bahwa ketiganya adalah yang precision-nya diukur. Exsum Lampiran 6 dan
CLAUDE.md §8 (`SUGGESTION_PRECISION_GATE`) menetapkan
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

---

## 26. Ambang pHash 6 ditetapkan final, dan pita penguatan diakui tidak terjangkau

**Kondisi di proposal:** Entri 22 menyatakan ambang 6 berlaku **sementara** sampai
kalibrasi ulang dijalankan dengan hash yang dihitung server. Pita penguatan C8
(Hamming 3–6) dirancang menandai keadaan ketika dua kontributor berbeda memotret
pintu yang sama di titik pandang yang sama.

**Yang diubah:** Kalibrasi server dijalankan, dan ambang 6 ditetapkan **final** —
tidak diturunkan ke 4, tidak pula dilebarkan. Yang berubah bukan angkanya,
melainkan status pengetahuannya: dari asumsi yang menunggu bukti menjadi keputusan
yang punya angka. Bersamaan dengan itu, pita penguatan 3–6 dinyatakan **tidak
terjangkau** oleh tangkapan yang benar-benar terpisah, dan itu dicatat sebagai
batasan yang diketahui, bukan sebagai sesuatu yang akan diperbaiki dengan
melebarkan pita.

Dua pengukuran, keduanya lewat modul yang persis menegakkan C8 di E4:

| yang diukur | hasil |
|---|---|
| 66 pasangan pintu **berbeda** | jarak terdekat **24** — tidak satu pun salah dianggap duplikat |
| dua HP, pintu **sama**, jarak 2 cm | **14** — hasil klasifikasi `none`, penguatan terlewat |

**Alasan perubahan:** Sisi pintu-berbeda menjawab kekhawatiran lama. CLAUDE.md §17
mengantisipasi "turunkan ke 4 kalau salah tolak"; dengan pasangan terdekat di 24
dan ambang di 6, jarak amannya 18 dan kekhawatiran itu tidak terbukti. Ambangnya
tidak perlu turun.

Sisi pintu-sama justru menemukan hal yang tidak diantisipasi. Dua sentimeter
praktis titik pandang yang sama — kasus paling menguntungkan yang bisa diatur —
dan hasilnya sudah 14, jauh di atas pita 3–6. Dua kontributor sungguhan, dengan
beda posisi dan waktu, akan lebih jauh lagi. Cabang "flag, bukan fail" karena itu
tidak pernah menyala dalam pemakaian nyata.

Pita **tidak** dilebarkan meski pengukurannya memperlihatkan celah 14–24 yang
bersih. Alasannya ada di dalam kode: di dalam pita, `classifyDuplicate`
mengembalikan `flag` hanya untuk kombinasi kontributor-beda-tempat-dan-vantage-sama;
semua kombinasi lain berujung `fail`. Melebarkan pita ke 18 karena itu tidak cuma
menyalakan penandaan — ia juga membuat **kontributor yang sama memotret ulang
pintu yang sama** (menyumbang lagi setelah renovasi, misalnya) jatuh di sekitar 14
dan langsung ditolak, dan membuat tempat berbeda di bawah 18 ikut ditolak padahal
sisa ruang ke lantai pintu-berbeda cuma 6. Menukar satu penandaan di jejak audit
dengan dua kelas penolakan salah adalah pertukaran yang merugikan. Ditambah lagi,
angka pintu-sama itu baru satu pasang, dan menetapkan ambang dari satu kasus
terbaik berarti menukar cacat yang diketahui dengan cacat yang tidak diketahui.

**Dampak terhadap masalah inti:** Entri 22 sudah melaporkan batasan ini sebagai
dugaan dari angka peramban. Sekarang batasan itu punya angka dari modul yang
benar, dan kalimatnya bisa dipertanggungjawabkan: C8 menaikkan biaya mengirim
ulang berkas yang sama, dan **tidak** mendeteksi dua orang yang memotret pintu
yang sama. Yang perlu ditegaskan supaya tidak salah dibaca: penguatan sebagai
fitur produk tidak ikut mati. `corroboration_count` di mesin status menghitung
`contributor_id` berbeda yang nilai terkonfirmasinya sama — ukuran yang justru
lebih tepat, karena yang menguatkan sebuah fakta adalah dua orang menyatakan hal
yang sama, bukan dua foto yang terlihat mirip. Pita pHash sedari awal jalur kedua
untuk sesuatu yang sudah punya jalur pertama yang lebih baik.

Kami juga menemukan bahwa skrip kalibrasi kami sendiri sempat menyembunyikan
temuan ini: ia hanya menganggap hasil `fail` sebagai masalah, sehingga pasangan
yang justru tidak tertangkap sebagai penguatan dilaporkan sebagai "semua masuk
pita penguatan" — sambil mencetak sisa ruang negatif di baris berikutnya. Sudah
diperbaiki. Perkakas ukur yang salah baca lebih berbahaya daripada tidak punya
perkakas, karena ia menghasilkan keyakinan.

---

## 27. Penalaran model dimatikan supaya panggilan muat di anggaran 8 detik

**Kondisi di proposal:** CLAUDE.md §8 (`VERTEX_TIMEOUT_MS`) menetapkan batas waktu
model 8 detik tanpa retry, dan modul verifikasi dirancang satu panggilan per bukti. Angka 8 detik dipilih
karena separuh anggaran 60 detik beban kontribusi tidak boleh habis di satu
panggilan. Nama model `gemini-3.8-flash` dicatat di CLAUDE.md §17 sebagai "lolos tes di
lokasi global". Yang tidak pernah diuji adalah pasangan lengkapnya: model itu,
prompt `2026-09-18.v1`, skema berbatas, dan foto pintu masuk sungguhan berukuran
1600 px.

**Yang diubah:** `lib/verification/vertex-caller.ts` sekarang mengirim
`thinkingConfig: { thinkingBudget: 0 }`. Tidak ada perubahan pada prompt, skema,
nama model, batas waktu, maupun kebijakan tanpa retry.

**Alasan perubahan:** Diukur pada foto pintu masuk 1200×1600 px, lewat jalur kode
repo dan batas waktu kontrak 8 detik, usulan model **tidak pernah sampai** ke
layar konfirmasi.

| Pengukuran | Hasil |
|---|---|
| Jalur repo, batas 8 dtk, penalaran bawaan | 3 dari 3 `timeout` (8.006 · 8.016 · 8.011 ms) |
| Panggilan langsung, prompt dan skema sama, penalaran bawaan | 9.633 ms |
| Panggilan langsung, prompt dan skema sama, `thinkingBudget: 0` | 4.164 ms |

`gemini-3.8-flash` menalar secara bawaan, dan penalaran itu memakan sekitar 5,5
detik dari anggaran 8 detik. Konsekuensinya bukan usulan yang lambat, melainkan
usulan yang tidak pernah ada: setiap kontribusi berakhir di cabang `timeout`,
layar konfirmasi selalu tampil dengan checklist kosong, dan `draft_suggestion`
tidak pernah terisi. Fitur yang menjadi alasan Vertex AI dipakai sama sekali
tidak berjalan, tanpa satu pun galat yang terlihat.

**Dampak terhadap masalah inti:** Konfirmasi wajib kontributor tetap satu-satunya
gerbang, dan aturan 2 tidak tersentuh — perubahan ini hanya membuat usulan
benar-benar tiba, bukan membuatnya berwenang. Batas yang diakui, dan semuanya
belum selesai:

- **Perubahan ini perlu, tetapi belum cukup.** Sesudah diterapkan, tes §10 pada
  batas 8 detik lolos 2 dari 5 kali. Tiga sisanya tetap `timeout`.
- **Ekor latensinya menempel di batas.** Enam panggilan berjarak 12 detik:
  3.856 · 3.123 · 7.545 · 2.738 · 2.819 ms. Rata-ratanya 4,0 detik, tetapi satu
  panggilan menyentuh 7,5 detik. Anggaran 8 detik nyaris tanpa ruang gerak.
- **Kuota menolak sebagian panggilan.** HTTP 429 muncul 1 dari 6 panggilan
  meskipun sudah dijarakkan, dan satu penolakan baru terjawab setelah 15.090 ms.
  Ini penyebab kegagalan yang tersisa, dan bukan sesuatu yang bisa diperbaiki
  dari sisi kode.
- **Semua diukur dari satu laptop ke endpoint `global`.** Cloud Run di
  `asia-southeast2` belum diukur dan bisa berbeda.

**Akibat untuk entri 25, dan ini perlu diperiksa sebelum angkanya dipakai.**
Gerbang precision di entri 25 dijalankan ketika baris ini belum ada, yaitu dengan
penalaran menyala. Dua hal menyusul dari situ:

1. Precision hanya sah untuk pasangan model dan prompt yang diukur (CLAUDE.md
   §17, baris nama model). Mematikan penalaran mengubah jawaban model — pada satu foto ruangan
   dalam, jawabannya berubah dari `not_visible` menjadi `no` untuk
   `tactile_paving`. Gerbang 0,85 karena itu perlu dijalankan ulang di atas
   konfigurasi ini.
2. **Angka n yang kecil di entri 25 belum tentu berarti model menolak menebak.**
   `presisi.run.test.ts` memanggil `suggestAttributes` lewat jalur yang sama yang
   di sini timeout 3 dari 3 kali, dan menjalankannya tiga paralel sehingga
   penolakan kuota lebih mungkin. Kalau sebagian besar dari 36 citra itu berakhir
   `timeout`, daftar usulannya kosong bukan karena model diam, melainkan karena
   jawabannya tidak pernah datang. Itu akan menjelaskan n=3 dan n=2 dari 36
   citra. Laporan hasil ukur menyimpan `status` dan `latency_ms` per citra, jadi
   ini bisa dipastikan dengan menghitung berapa yang `ok` dan berapa yang
   `timeout` — sebelum kesimpulan "model tidak pernah mengusulkan ada jalur
   pemandu" dibawa ke deck.

Perubahan ini tidak membatalkan entri 25 dan tidak menyentuh migrasi yang sudah
diterapkan. Yang diminta hanya satu: hitung ulang statusnya, lalu putuskan.

Syarat pembekuan nama model di CLAUDE.md §17 (foto 1600 px dijawab di bawah 8
detik) sendiri **belum terpenuhi**. Yang berubah
adalah penyebabnya sudah diketahui dan terukur, bukan statusnya.

---

## 28. Gerbang precision diukur ulang di atas penalaran yang dimatikan

**Kondisi di proposal:** Entri 25 mencatat keputusan gerbang precision, dan entri
27 mematikan penalaran model supaya panggilan muat di anggaran 8 detik. Entri 27
sendiri menyatakan konsekuensinya: mematikan penalaran mengubah jawaban model,
jadi gerbang 0,85 harus diukur ulang di atas konfigurasi itu.

**Yang diubah:** Pengukuran diulang atas 36 citra berlabel yang sama, prompt yang
sama `2026-09-18.v1`, dengan `thinkingBudget: 0` dan batas waktu kontrak 8 detik —
bukan 45 detik seperti pengukuran pertama.

| atribut | precision | n | 95% | gerbang |
|---|---|---|---|---|
| `step_count` | 1,00 | 2 | 0,34–1,00 | lolos |
| `ramp_wheelchair` | 1,00 | 1 | 0,21–1,00 | lolos |
| `tactile_paving` | tidak terdefinisi | 0 | — | **dimatikan** |

**Keputusannya tidak berubah.** `tactile_paving` tetap mati, dua atribut lain
tetap menyala, dan tidak ada satu pun salah positif di ketiganya. Yang berubah
angka pendukungnya, dan itu justru menguatkan: kali ini diukur di bawah batas
waktu yang sama dengan produksi, jadi angkanya berlaku untuk konfigurasi yang
benar-benar dipakai. Latensi median turun ke 4.955 ms dari 10.643 ms, dan 30 dari
36 citra terjawab — dibanding 7 dari 36 pada percobaan pertama dengan batas waktu
kontrak.

**Alasan perubahan:** Angka precision hanya berlaku untuk pasangan model, prompt,
dan konfigurasi tertentu. Membiarkan angka lama berdiri sesudah penalaran
dimatikan berarti memajang angka yang tidak pernah diukur pada sistem yang
dijalankan. Entri 25 sengaja tidak diubah: angkanya benar untuk konfigurasi saat
itu, dan menghapusnya diam-diam akan menghilangkan jejak bahwa konfigurasinya
pernah berbeda.

Pengukuran ulang ini juga membongkar cacat di perkakas ukurnya sendiri. Percobaan
pertama sesudah penalaran dimatikan melaporkan 16 panggilan "failed", dan angka
precision-nya tetap terlihat baik. Sebabnya ternyata bukan model, melainkan
**HTTP 429, kuota Vertex habis** karena satu sesi pengukuran menembak 36
panggilan beruntun dan sesi itu sudah dijalankan berkali-kali. Panggilan yang
gagal dikeluarkan dari hitungan, sehingga precision dihitung dari sisa citra yang
kebetulan terjawab — makin banyak yang gagal, makin sedikit kesempatan model
berbuat salah, dan makin bagus angkanya. Perkakas ukur yang diam saat gagal
menghasilkan angka yang menyanjung.

Dua perbaikan dipasang di pengukur, keduanya **tidak menyentuh jalur produksi**:
sebab kegagalan kini ikut dicatat dan dicetak, sehingga "16 gagal" tidak lagi
perlu ditebak apakah itu kuota, skema, atau jaringan; dan kegagalan kuota
ditunggu lalu diulang dengan jeda berlipat, paralelisme diturunkan dari tiga ke
dua. CLAUDE.md §8 melarang retry di jalur produksi dan larangan itu tetap berlaku
utuh untuk E4 — yang diukur di sini adalah ketepatan model, bukan perilaku E4
saat sibuk, dan keduanya menuntut aturan yang berbeda.

**Dampak terhadap masalah inti:** Gerbang precision adalah janji bahwa usulan
model tidak dinyalakan tanpa bukti. Janji itu kosong kalau angkanya diukur pada
konfigurasi yang bukan konfigurasi yang dijalankan, atau dihitung dari citra yang
kebetulan lolos sementara sisanya hilang tanpa suara. Sesudah dua perbaikan ini,
angka yang kami sebut adalah angka dari sistem yang sama dengan yang dipakai
kontributor, dengan jumlah citra yang gagal disebutkan terang-terangan di
laporannya. Enam citra masih melewati 8 detik dan dilaporkan apa adanya; itu
berarti sekitar satu dari enam kontribusi tidak akan menerima usulan model sama
sekali, dan kontributor mengisi formulirnya sendiri — perilaku yang memang
dirancang, bukan kegagalan.

---

## Bagian III: Perbedaan terhadap Exsum yang ditemukan saat audit akhir

Entri di bawah ini ditemukan dengan membandingkan Exsum baris demi baris, termasuk
gambar dan lampirannya, dengan implementasi di akhir babak final. Sebagian adalah
penyimpangan yang disengaja tetapi belum dicatat. Sebagian lagi adalah janji di
Exsum yang tidak terpenuhi, dan dicatat sebagai batasan.

---

## 29. Himpunan uji precision 36 citra, dan rencana cadangannya tidak dijalankan

**Kondisi di proposal:** Exsum Lampiran 6 (Tabel L4) menetapkan set uji 60 hingga
90 citra yang dikumpulkan dan dianotasi tim. Lampiran 9 menyiapkan rencana
cadangan: bila variasi atribut di sekitar lokasi acara tidak mencukupi,
**khususnya untuk contoh negatif**, set uji beralih ke citra berlisensi terbuka
dari basis data aksesibilitas publik, dengan ukuran set dan ambang tetap, dan
peralihannya dicatat.

**Yang diubah:**
- Set uji berisi 36 foto koridor Dipatiukur, bukan 60–90. Semuanya dipakai
  mengukur; tidak ada bagian penyetelan. Prompt dibekukan di versi `2026-09-18.v1`
  sebelum foto-foto ini ada, jadi tidak ada citra yang pernah dipakai menyetelnya.
- Sebaran labelnya timpang:
  - `step_count`: 14 tanpa anak tangga, 22 dengan anak tangga.
  - `ramp_wheelchair`: 7 ada ramp, 29 tanpa ramp.
  - `tactile_paving`: **36 dari 36 tanpa ubin pemandu**. Tidak ada satu pun contoh
    positif.
- Rencana cadangan citra berlisensi terbuka **tidak dijalankan**, padahal syarat
  peralihannya terpenuhi untuk `tactile_paving`. Ini penyimpangan dari rencana kami
  sendiri, bukan hanya dari angka.
- Seluruh label ditetapkan satu orang (tercatat di kolom `pelabel` pada
  `tools/metrics/testset/labels.json`), jadi kesepakatan antarpelabel tidak diukur.

**Alasan perubahan:** Foto koridor sendiri didahulukan karena itulah kondisi yang
akan dihadapi model di koridor penerapan. Saat kekurangannya terlihat, waktu yang
tersisa tidak cukup untuk mencari citra berlisensi terbuka, memeriksa lisensinya,
lalu melabelinya dengan disiplin yang sama (label ditetapkan sebelum model melihat
citra).

**Dampak terhadap masalah inti:** Angka precision di entri 25 dan 28 berlaku,
tetapi sangat indikatif: n-nya 1 sampai 3, dan batas bawah selang kepercayaan
95% jauh di bawah 0,85. Keputusan mematikan usulan `tactile_paving` bersandar pada
ketiadaan bukti, bukan pada bukti bahwa model salah. Karena set uji tidak punya
contoh positif, model tidak pernah diuji pada jalur pemandu yang benar-benar ada.
Yang menahan nilai keliru masuk ke basis data tetap konfirmasi wajib kontributor,
bukan angka ini.

---

## 30. Recall usulan model dilaporkan

**Kondisi di proposal:** Exsum Lampiran 6 (Tabel L4): recall dilaporkan apa adanya
dan tidak dijadikan syarat aktivasi, karena usulan terlewat lebih murah biayanya
daripada usulan keliru.

**Yang diubah:** Sampai audit akhir, tidak ada angka recall di dokumen mana pun di
repositori. Angkanya dilaporkan di sini, dari pengukuran di entri 28 (penalaran
dimatikan, batas waktu 8 detik).

Definisinya: benar-positif dibagi **seluruh** citra berlabel positif, termasuk
citra yang tidak terjawab karena lewat batas waktu atau dijawab "tidak terlihat".
Ini recall ujung ke ujung, yaitu seberapa sering kontributor di depan pintu yang
bersangkutan benar-benar menerima usulan yang tepat. Karena precision di entri 28
bernilai 1,00, jumlah benar-positif sama dengan n.

| atribut | kelas positif | benar-positif | label positif | recall |
|---|---|---|---|---|
| `step_count` | tidak ada anak tangga | 2 | 14 | 0,14 |
| `ramp_wheelchair` | ada ramp | 1 | 7 | 0,14 |
| `tactile_paving` | ada ubin pemandu | 0 | 0 | tidak terdefinisi |

`lib/verification/presisi.ts` juga menghitung recall versi lain yang hanya
menghitung citra yang dijawab model dengan nilai selain "tidak terlihat". Angka
versi itu ada di berkas hasil pengukuran dan nilainya sama atau lebih tinggi.
Yang dilaporkan di sini sengaja versi yang lebih rendah.

**Alasan perubahan:** Exsum menjanjikan recall dilaporkan. Precision 1,00 tanpa
recall memberi kesan model bekerja baik, padahal model sangat jarang mengusulkan
kelas positif sama sekali.

**Dampak terhadap masalah inti:** Recall 0,14 berarti pada sebagian besar
kontribusi, model tidak membantu mengisi dua atribut penentu itu, dan kontributor
mengisinya sendiri. Itu sesuai rancangan: usulan yang terlewat hanya menambah
beberapa ketukan, sedangkan usulan yang keliru bisa mengirim orang ke pintu yang
tidak bisa dilalui. Tetapi pada konfigurasi dan set uji ini, manfaat model untuk
mempercepat kontribusi kecil, dan itu kami nyatakan.

---

## 31. Model hanya mengusulkan; model tidak pernah menolak klaim kontributor

**Kondisi di proposal:** Teks Exsum 3.2 tahap 3 menyatakan model multimodal
mengusulkan nilai atribut dan kontributor wajib mengonfirmasi atau mengoreksinya.
Tetapi wireframe di Lampiran 2 (Gambar L2) memperlihatkan arah sebaliknya: model
memeriksa klaim kontributor dan bisa menolaknya ("Guiding block ditolak").

**Yang diubah:** Implementasi mengikuti teks 3.2. Model hanya mengusulkan nilai
untuk atribut yang lolos gerbang precision (kini `step_count` dan
`ramp_wheelchair`), usulan tidak pernah terpilih otomatis, dan model tidak punya
jalur untuk menolak atau menurunkan klaim kontributor. Penolakan kontribusi hanya
datang dari sembilan pemeriksaan provenans (C0–C8), dan tidak satu pun menilai isi
foto.

**Alasan perubahan:** Model yang bisa menolak klaim adalah model yang punya
wewenang atas fakta. Precision model ini diukur pada n=1 sampai 3 (entri 28), dan
untuk jalur pemandu tidak pernah diuji pada contoh positif (entri 29). Memberinya
wewenang menolak berarti membiarkan angka yang belum terbukti menghapus kesaksian
manusia yang berdiri di depan pintu itu.

**Dampak terhadap masalah inti:** Kalimat "AI asisten, bukan otoritas" berlaku di
level kode (aturan 2, CLAUDE.md §2). Gambar L2 di Exsum tidak mewakili produk yang
dibangun, dan kami menyebutnya terbuka supaya gambar itu tidak dibaca sebagai
fitur.

---

## 32. Kontribusi yang ditolak ditolak permanen, bukan masuk antrean tinjauan manual

**Kondisi di proposal:** Diagram alur di Exsum Lampiran 1 (Gambar L1) menyatakan
kontribusi yang gagal pemeriksaan "ditandai untuk tinjauan manual".

**Yang diubah:**
- Kontribusi yang gagal satu pemeriksaan saja ditolak dengan HTTP 422, beserta
  **semua** alasannya dan nilai terukurnya.
- Bukti, hasil pemeriksaan, dan audit `provenance_failed` tetap ditulis dan
  terbaca publik di jejak audit.
- Draft yang ditolak tidak bisa dikonfirmasi selamanya (E5 membalas 422).
- Tidak ada antrean, peran peninjau, maupun jalur untuk meloloskannya belakangan.
  Satu-satunya "penandaan" adalah hasil `flag` untuk kontribusi yang **diterima**
  tetapi janggal, misalnya jarak 75–120 m dari tempat (C7). Penanda itu tercatat
  di jejak audit.

**Alasan perubahan:** Antrean tinjauan tanpa peninjau adalah janji kosong, dan
dalam 24 jam tidak ada peran moderator yang bisa dibangun dan dijalankan. Lebih
penting lagi, jalur untuk meloloskan kontribusi yang ditolak adalah jalur untuk
melewati pemeriksaan provenans: nilainya hanya sekuat orang yang memegang tombolnya.

**Dampak terhadap masalah inti:** Setiap penolakan punya alasan dan angka yang
bisa diperiksa siapa pun, dan tidak ada keputusan di balik layar yang mengubahnya.
Kontributor yang ditolak mengambil foto baru, dan percobaan itu tercatat terpisah.

---

## 33. Penguatan dihitung dari jumlah kontributor berbeda, tanpa bobot rekam jejak

**Kondisi di proposal:** Diagram di Exsum Lampiran 1 (Gambar L1) menyebut konsensus
"dibobot rekam jejak". Teks 3.2 tahap 4 justru menyatakan pembobotan reputasi
ditunda, dan Lampiran 8 memasukkannya ke daftar yang ditunda. Exsum sendiri tidak
konsisten di titik ini.

**Yang diubah:** Implementasi mengikuti teks. `corroboration_count` adalah jumlah
`contributor_id` berbeda yang nilai terkonfirmasinya sama dengan nilai berlaku dan
masih dalam jendela kesegaran. Tidak ada skor reputasi maupun bobot.

**Alasan perubahan:** Kontributor adalah sesi anonim (entri 7), jadi tidak ada rekam
jejak yang bisa dibobot. Membuat skor reputasi dari puluhan kontribusi selama 24
jam akan menghasilkan angka yang terlihat seperti ukuran kepercayaan tetapi tidak
mengukur apa pun.

**Dampak terhadap masalah inti:** Yang ditampilkan ke pengguna adalah hitungan yang
bisa diperiksa ("dikuatkan 2 kontributor berbeda"), bukan skor yang rumusnya
tersembunyi. Batasnya diakui: satu orang yang membuka beberapa sesi anonim bisa
terhitung sebagai beberapa kontributor. Pembuatan sesi tercatat di jejak audit
(entri 20), tetapi tidak dicegah.

---

## 34. Hambatan keras tidak mengeluarkan lokasi dari hasil

**Kondisi di proposal:** Exsum Lampiran 4: "Pembatas keras mengeluarkan lokasi dari
hasil; catatan bersifat peringatan tanpa mengeluarkannya."

**Yang diubah:** Tidak ada lokasi yang disembunyikan. E1 mengembalikan semua tempat
di wilayah yang diminta. Daftar dan peta menampilkan tempat dengan hambatan keras
sebagai "tidak dapat diakses" beserta nama profilnya, dan laporan tempat menyebut
kalimat hambatannya (misalnya "Pintu masuk punya dua anak tangga tanpa ramp").

**Alasan perubahan:** Tempat yang disembunyikan tidak bisa dibedakan dari tempat
yang tidak ada di data. Pengguna yang tidak menemukan puskesmas terdekatnya tidak
tahu apakah puskesmas itu tidak dapat diakses atau belum pernah diperiksa. Itu
kekaburan yang sama antara "terverifikasi tidak ada" dan "belum diketahui" yang
ingin dihapus produk ini. Pengguna juga tetap bisa memutuskan berangkat dengan
pendamping, asal tahu hambatannya apa.

**Dampak terhadap masalah inti:** Keputusan tetap di tangan pengguna, dengan fakta
dan buktinya terlihat. Penilaian "tidak dapat diakses" selalu disertai alasan dan
tanggal pemeriksaan, bukan ketiadaan yang diam.

---

## 35. Umpan balik bagi pengelola fasilitas tidak dibangun

**Kondisi di proposal:** Exsum 3.2 tahap 6 (Penyajian) mencakup "umpan balik bagi
pengelola". Lampiran 8 hanya menunda papan kendali pengelola, bukan umpan baliknya.

**Yang diubah:** Tidak ada fitur khusus pengelola. Yang tersedia bagi pengelola
sama dengan bagi siapa pun: laporan kesiapan dan jejak audit yang terbuka tanpa
akun, serta jalur sanggahan berupa kontribusi tandingan berfoto (entri 13).

**Alasan perubahan:** Ini butir 4 daftar pemotongan yang disepakati tim di awal
babak final (CLAUDE.md §16). Umpan balik yang layak butuh identitas pengelola yang
terverifikasi, dan itu tidak bisa dibangun dengan jujur dalam 24 jam.

**Dampak terhadap masalah inti:** Tautan jejak audit sebuah tempat bisa dikirim ke
pengelolanya apa adanya: isinya daftar fakta, foto, dan tanggal, bukan tuduhan.
Yang hilang adalah jalur aktif dari sistem ke pengelola. Sistem tidak memberi tahu
siapa pun; pengelola harus datang sendiri.

---

## 36. Beberapa layanan Google Cloud, bukan satu layanan terkelola

**Kondisi di proposal:** Exsum 3.4 dan Lampiran 5 (Tabel L3): basis data,
autentikasi, dan penyimpanan berkas ditangani satu layanan terkelola berbasis
PostgreSQL, supaya hemat waktu integrasi.

**Yang diubah:**

| fungsi | di implementasi |
|---|---|
| aplikasi | Cloud Run |
| basis data | Cloud SQL PostgreSQL, dengan Row Level Security untuk tabel append-only |
| penyimpanan bukti | Cloud Storage, bucket privat |
| autentikasi | tidak ada layanan; sesi anonim bertanda tangan HMAC (entri 7) |
| rahasia | Secret Manager |
| usulan model | Vertex AI |
| pengaburan wajah | Cloud Vision API (entri 24) |

**Alasan perubahan:** Model multimodal berjalan di Vertex AI, dan kredit komputasi
awan yang disebut di Tabel L3 berlaku di Google Cloud. Menaruh seluruh layanan di
satu proyek membuat izin cukup diatur lewat satu akun layanan, tanpa kunci yang
disalin antarpenyedia. Layanan autentikasi tidak lagi dibutuhkan sejak akun diganti
sesi anonim.

**Dampak terhadap masalah inti:** Integrasinya lebih banyak dari rencana, tetapi
penegakan append-only jejak audit bersandar pada Row Level Security dan pencabutan
hak di PostgreSQL biasa, dan sudah diuji langsung di Cloud SQL produksi. Aturan
keterlacakan tidak bergantung pada fitur khusus satu penyedia.

---

## 37. Aturan "lift tidak berfungsi, tujuan di atas lantai satu" tidak pernah menyala

**Kondisi di proposal:** Exsum Lampiran 4 (Tabel L2): lift tidak berfungsi dengan
tujuan di atas lantai satu berarti "tidak dapat diakses" untuk kursi roda manual
dan "dengan catatan" untuk alat bantu jalan.

**Yang diubah:** Ini batasan, bukan penyimpangan yang disengaja. Aturannya ada di
rules engine dan di tabel aturan. Syaratnya adalah properti tempat
`layanan_di_atas_lantai_dasar = true`. Kolom itu bernilai bawaan `false`, dan tidak
ada jalur yang mengisinya: bukan penyemaian OSM, bukan data demo, bukan alur
kontribusi, bukan antarmuka. Akibatnya:
- aturan lift tidak pernah menyala di purwarupa ini;
- `elevator_status` tidak pernah masuk himpunan atribut minimum, jadi status lift
  tidak pernah memengaruhi penilaian.

Status lift tetap direkam, tampil di laporan beserta tanggalnya, dan meluruh ke
"perlu ditinjau ulang" setelah 90 hari.

**Alasan perubahan:** "Tujuan di atas lantai satu" adalah fakta tentang layanan di
dalam gedung, bukan sesuatu yang terlihat dari foto pintu masuk, dan tidak ada
titik pandang yang dirancang untuk merekamnya. Celah ini baru terlihat saat audit
akhir, senasib dengan pita penguatan C8 (entri 26) yang juga tidak pernah
terjangkau.

**Dampak terhadap masalah inti:** Untuk gedung yang layanannya di lantai atas,
penilaian kursi roda bisa berbunyi "dapat diakses" padahal liftnya rusak. Karena
itu laporan tetap menampilkan status lift dan tanggalnya terpisah dari penilaian.
Perbaikannya jelas tapi belum dikerjakan: satu pertanyaan tambahan di titik pandang
interior ("layanan utama di lantai berapa?") yang mengisi properti itu dengan bukti
yang sama seperti atribut lain.

---

## 38. Letak toilet aksesibel hanya tercatat ada atau tidak

**Kondisi di proposal:** Exsum 3.3 menyebut laporan kesiapan memuat "letak toilet
aksesibel", dan wireframe di Lampiran 2 (Gambar L2) menampilkan contoh "Lantai 1".

**Yang diubah:** `toilets_wheelchair` hanya bernilai `yes` / `no`, direkam dari titik
pandang toilet. Letak atau lantainya tidak direkam.

**Alasan perubahan:** Foto toilet memperlihatkan apakah ruangnya bisa dimasuki kursi
roda, tetapi tidak memperlihatkan di lantai berapa foto itu diambil. Koordinat dari
peramban tidak membawa ketinggian yang bisa dipercaya. Letak yang diketik bebas
akan jadi satu-satunya atribut yang tidak didukung foto.

**Dampak terhadap masalah inti:** Kecil. Pengguna tahu ada toilet yang bisa dimasuki
kursi roda beserta foto dan tanggalnya, tetapi harus menanyakan letaknya di lokasi.

---

## 39. Metrik penolakan dilaporkan, dan kelas uji keempat ditambahkan

**Kondisi di proposal:** Exsum Lampiran 6 (Tabel L4) menetapkan kurang dari 5 persen
kontribusi bermasalah lolos, diuji pada tiga kelas: unggahan dari galeri, foto
lokasi lain, dan berkas daur ulang. Metrik itu dinyatakan tidak berlaku untuk
kelas serangan di luar ketiganya.

**Yang diubah:**
- Uji penolakan dijalankan sebagai suite otomatis (`tests/rejection`) yang
  menembak E4 sungguhan. Isinya 55 kasus: 11 unggahan galeri, 14 lokasi di luar
  radius, 10 berkas daur ulang, **11 unggahan bersih lewat API langsung**, ditambah
  6 kasus sesi dan waktu serta 3 pagar aturan. Pada jalan terakhir yang tercatat,
  55 dari 55 sesuai harapan.
- Suite lengkap dijalankan di lingkungan terpisah, bukan ke produksi. Tabel bukti
  bersifat append-only, jadi 55 kiriman uji akan meninggalkan puluhan baris permanen
  di basis data yang dibuka juri. Sebagai gantinya, **enam kiriman bermasalah**
  dijalankan lewat E4 produksi ke tempat khusus "Gedung Latihan Uji Penolakan":
  unggahan galeri ber-EXIF, foto lokasi lain (17.171 m, batas 120 m), ketelitian
  lokasi rendah (500 m, batas 150 m), selisih waktu 3.600 detik, berkas daur ulang
  (Hamming 0), dan satu kiriman yang gagal di empat pemeriksaan sekaligus. **Enam
  ditolak, nol lolos (n=6).** Satu kiriman bersih di tempat yang sama diterima.
- Sesudahnya, setiap bukti yang gagal di produksi punya catatan audit
  `provenance_failed`, dan tidak satu pun atribut tersimpan dari bukti yang gagal
  (aturan 4, diperiksa dengan `npm run periksa:keutuhan`).
- Di tiga kelas Exsum, setiap kiriman yang dirancang bermasalah ditolak, jadi yang
  lolos 0 persen. Suite yang sama juga memuat kasus kendali yang **harus** diterima,
  misalnya foto berbeda di tempat yang sama, dan kasus itu memang diterima.
- Kelas keempat, unggahan bersih tanpa EXIF lewat API langsung, ditambahkan
  walaupun tidak ada di Exsum. Di kelas ini pemeriksaan **diharapkan lolos**:
  JPEG yang di-encode ulang lolos C3, dan koordinat yang dikarang tepat di titik
  tempat lolos C7.

**Alasan perubahan:** Angka 0 persen di tiga kelas itu sebagian besar benar menurut
konstruksi. Berkas galeri selalu membawa EXIF, jadi selalu ditolak C3, dan angka
itu tidak berarti apa-apa kalau berdiri sendiri. Kelas keempat adalah serangan yang
paling murah dan paling jujur untuk dilaporkan, jadi diukur dan dicatat sebagai
batasan yang terukur, bukan disembunyikan di luar cakupan metrik.

**Dampak terhadap masalah inti:** Batas dari tiga kelas itu ikut dinyatakan:
- "Foto lokasi lain" hanya tertolak kalau koordinat yang dikirim jujur.
- "Berkas daur ulang" hanya tertolak sampai jarak Hamming 6. Salinan yang diubah
  lebih jauh lolos sebagai berkas berbeda (entri 26).

Lapisan provenans menaikkan biaya pemalsuan, dan menutupnya tidak. Suite ini
menunjukkan persis di mana batas itu berada.

---

## 40. Beban kontribusi dilaporkan: pintu masuk 30,6 dan 61,2 detik (n=2)

**Kondisi di proposal:** Exsum Lampiran 6 (Tabel L4): beban kontribusi di bawah 60
detik per lokasi, diuji pada anggota tim dan peserta lain di lokasi acara, dan
angkanya dinyatakan bersifat awal.

**Yang diubah:** Beban diukur dari jam server, bukan stopwatch (`npm run ukur:beban`):
dari layar titik pandang dibuka (`capture_session.issued_at`) sampai konfirmasi
tersimpan (`observation.observed_at`). Metriknya dihitung hanya untuk titik pandang
**wajib**, yaitu pintu masuk (CLAUDE.md §5), karena titik pandang lain menuntut
satu atribut dan tidak memanggil model.

| titik pandang | kontribusi | total per kontribusi | lewat 60 dtk |
|---|---|---|---|
| **pintu masuk (metrik)** | 2 | **61,2 dtk** dan **30,6 dtk** | 1, lewat 1,2 dtk |
| toilet (pembanding) | 3 | 28,9 · 7,6 · 7,3 dtk | 0 |
| dalam gedung (pembanding) | 2 | 71,2 · 26,6 dtk | 1 |

Satu kontribusi lain di basis data (Gedung Latihan Uji Penolakan, waktu siapkan
dan kirim 1,0 detik) berasal dari pengujian jalur tulis lewat skrip, bukan dari
orang yang memotret. Kontribusi itu tidak dihitung.

**Alasan perubahan:** Exsum menjanjikan angka ini tanpa menyebut cara mengukurnya.
Jam server tidak bisa salah tekan dan bisa diulang siapa pun dari basis data yang
sama. Jam klien sengaja tidak dipakai karena bisa dinyatakan apa saja. Titik pandang
tidak dirata-ratakan jadi satu. Kalau dicampur, kontribusi toilet yang cepat membuat
median turun ke kisaran 29 detik, padahal tidak ada satu pun kontribusi pintu masuk
secepat itu.

**Dampak terhadap masalah inti:** Target 60 detik tercapai pada satu dari dua
kontribusi pintu masuk; yang lain lewat 1,2 detik dan tetap dihitung. Percobaan
kedua memakan separuh waktu percobaan pertama. Itu efek belajar, dan kontributor
sungguhan juga baru pertama kali mencoba, jadi angka percobaan pertama yang lebih
mewakili mereka. Selisih antara pintu masuk dan toilet memperlihatkan porsi
anggaran yang dihabiskan panggilan model dan enam atribut. Sampelnya dua, dan
pesertanya anggota tim, bukan pengguna sasaran, sesuai batas yang sudah dinyatakan
Exsum.

---

## 41. Kode atribut tidak lagi sama persis dengan tag OpenStreetMap

**Kondisi di proposal:** Exsum 3.1 menyatakan penamaan atribut mengikuti konvensi
tag OpenStreetMap, supaya data awal bisa disemai lewat Overpass API dan kontribusi
bisa dikembalikan ke ekosistem terbuka.

**Yang diubah:**
- Kode atribut ditulis sebagai pengenal yang aman untuk basis data dan kode
  (`ramp_wheelchair`, `toilets_wheelchair`), bukan tag bertitik dua
  (`ramp:wheelchair`).
- Tiga atribut tidak lagi berpadanan satu-satu dengan tag OSM:
  - `door_width_band` berupa pita, bukan meter (entri 3);
  - `elevator_status` berupa status fungsi, bukan keberadaan lift (entri 21);
  - `surface_condition` tidak punya padanan tag di node tempat (entri 2).
- Pemetaan tag ke atribut dikerjakan satu fungsi (`scripts/seed/osm.ts`), dan
  hanya berjalan satu arah: dari OSM ke sistem ini.

**Alasan perubahan:** Tag OSM dirancang untuk memetakan dunia, bukan untuk menyimpan
fakta yang bisa dibuktikan dari foto. Setiap kali keduanya berbeda, bentuk yang
bisa dibuktikan dari foto yang dipilih.

**Dampak terhadap masalah inti:** Penyemaian tetap berjalan (39 tempat di koridor
Dipatiukur). Pengembalian kontribusi ke OSM memang sudah ditunda di Exsum
Lampiran 8, tetapi sekarang jaraknya lebih jauh dari yang dibayangkan: pita lebar
pintu dan status lift tidak bisa ditulis balik ke tag OSM tanpa kehilangan makna.

---

## 42. Pilihan "tidak terlihat dari sini" untuk model dan kontributor

**Kondisi di proposal:** Exsum 3.2 tahap 3: model mengusulkan nilai atribut, dan
kontributor wajib mengonfirmasi atau mengoreksinya. Tidak disebut apa yang terjadi
kalau atributnya tidak tampak di foto.

**Yang diubah:** Nilai `not_visible` sah untuk atribut mana pun:
- model boleh menjawab `not_visible`, dan jawaban itu diteruskan apa adanya;
- kontributor punya pilihan "Tidak terlihat dari sini" di setiap atribut;
- `not_visible` dicatat di observasi dan jejak audit, tetapi **tidak pernah**
  membentuk nilai berlaku sebuah atribut.

**Alasan perubahan:** Tanpa pilihan itu, model dan kontributor dipaksa memilih nilai
untuk sesuatu yang tidak tampak di foto. Justru itu jalan paling pendek menuju
halusinasi model yang dikonfirmasi kontributor yang terburu-buru.

**Dampak terhadap masalah inti:** "Belum diketahui" tetap berbeda dari "terverifikasi
tidak ada" sampai ke level data. Foto yang tidak memperlihatkan ramp tidak
menghasilkan catatan "tidak ada ramp". Akibatnya tercatat terbuka: sebagian
jawaban model adalah `not_visible`, sehingga usulan yang bisa dinilai jadi lebih
sedikit (entri 30).

---

## 43. Lapis terverifikasi dipersempit ke gedung Unpad Dipatiukur; seed OSM koridor tetap jadi latar

**Kondisi di proposal:** Exsum 3.5 menetapkan penerapan awal pada satu koridor yang
dilalui satu komunitas, yaitu rute kampus, halte, dan fasilitas kesehatan terdekat.
Seluruh koridor itu dibayangkan menjadi wilayah verifikasi.

**Yang diubah:**
- Wilayah yang diverifikasi dengan foto dipersempit ke gedung-gedung Universitas
  Padjadjaran di Jalan Dipati Ukur. Saat entri ini ditulis, lapis terverifikasi
  berisi satu tempat, dengan 7 atribut yang punya bukti foto, hasil pemeriksaan
  keaslian, dan jejak audit.
- Hasil penyemaian OSM untuk seluruh koridor tetap dipertahankan sebagai latar:
  39 tempat berupa kampus, fasilitas kesehatan, dan halte, semuanya berstatus belum
  terverifikasi. Tempat-tempat itu tetap tampil di daftar dan peta, dan penilaiannya
  "belum dapat dipastikan" untuk semua profil.

**Alasan perubahan:** Verifikasi harus terjangkau dalam 24 jam. Satu kontribusi yang
sah menuntut kontributor berdiri di depan pintu masuk, dalam radius 75–120 m dari
titik tempat, dengan fix GPS segar. Artinya setiap tempat terverifikasi butuh
kunjungan fisik. Gedung Unpad Dipatiukur berada dalam jangkauan tim selama
acara. Halte dan fasilitas kesehatan di sepanjang koridor tidak bisa didatangi
satu per satu sambil tetap membangun sistemnya.

**Dampak terhadap masalah inti:** Keputusan ini justru menguatkan masalah inti.
Masalah yang kami angkat adalah platform yang menyimpan klaim tanpa bukti. Dengan
lapis terverifikasi yang sempit di atas latar OSM yang luas, perbandingannya
terlihat langsung di layar yang sama:
- segelintir atribut membawa foto, tanggal, dan jejak audit;
- puluhan tempat lain hanya punya lokasi dan, paling banyak, klaim pihak ketiga
  yang tidak dipakai untuk menilai.

Batasnya dinyatakan: cakupan terverifikasi jauh lebih kecil dari koridor yang
dijanjikan Exsum, dan halte serta fasilitas kesehatan belum punya satu pun bukti
berfoto.
