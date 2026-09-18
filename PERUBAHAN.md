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

> **Belum lengkap.** Entri di bawah baru mencakup penyimpangan jalur tulis
> (1–5) serta jalur baca dan model (6–9) yang ditemukan saat implementasi. Entri
> himpunan uji precision menunggu hasil gerbang di `DRAF_PERUBAHAN_VERIFICATION.md`. Lima belas perubahan terhadap proposal penyisihan
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

## 6. Tag `highway=elevator` dari OpenStreetMap tidak dipetakan ke status lift

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

## 7. Uji ambang pHash dengan hash peramban dinyatakan tidak berlaku untuk C8

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

## 8. Pembacaan suara laporan kesiapan untuk pengguna netra

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

## 9. Pengaburan wajah otomatis dikerjakan dengan Cloud Vision, gagal tertutup

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
