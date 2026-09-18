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

**Dampak terhadap masalah inti:** Memastikan setiap fakta yang tersimpan di basis data
didukung oleh bukti visual langsung dari sudut pandang yang masuk akal. Tidak ada lagi
klaim fasilitas yang tidak terlihat di foto bukti.

---

## 2. Delapan atribut terukur; atribut kemiringan (`incline`) dikeluarkan

**Kondisi di proposal:** Mengusulkan 9 atribut aksesibilitas fisik, termasuk
kemiringan lintasan (*incline*) dalam satuan derajat atau persentase sudut kemiringan
ramp.

**Yang diubah:** Kamus atribut disederhanakan menjadi 8 atribut fisik yang dapat
diamati. Atribut `incline` dihapus seluruhnya dari skema.

**Alasan perubahan:** Menaksir sudut kemiringan ramp dari selembar foto 2D tanpa
alat ukur fisik (*inclinometer*) adalah presisi semu (*false precision*). Sudut
pengambilan kamera, perspektif, dan distorsi lensa ponsel membuat estimasi sudut
sangat bias. Kesalahan tebakan sudut pada ramp yang curam dapat berakibat fatal bagi
pengguna kursi roda manual.

**Dampak terhadap masalah inti:** Menghilangkan ilusi akurasi yang berbahaya. Sistem
hanya mencatat fakta biner yang benar-benar dapat diverifikasi dari foto (apakah ada
ramp: `yes` / `no`), bukan estimasi sudut subjektif yang menyesatkan.

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

**Dampak terhadap masalah inti:** Memastikan bahwa hak AI untuk memberikan usulan
hanya aktif jika model terbukti berpresisi tinggi secara objektif, melindungi
kontributor dari halusinasi model yang meyakinkan.

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
(`docs-20 §2.2`). Jika ada satu saja atribut dalam himpunan minimum yang belum
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

**Kondisi di proposal:** Spesifikasi penyemaian OSM (docs-20 §3) mengambil
`highway=elevator` bersama tag fakta lain seperti `ramp:wheelchair`, `step_count`,
dan `tactile_paving`.

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
perkiraan docs-20 bahwa tag koridor Indonesia nyaris kosong. Yang terjaga adalah
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
(docs-30 §6, A1–A9). Tidak ada keluaran suara dari produk itu sendiri.

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
