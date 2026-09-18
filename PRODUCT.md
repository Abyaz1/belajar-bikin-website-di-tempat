# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Prioritas redesain: juri dan penguji saat demo** Hackathon IFEST 2026. Mereka menilai
  dalam beberapa menit: memahami gagasan, membuka laporan satu tempat, lalu mencoba
  mengelabui sistem (unggah dari galeri, foto lokasi lain, foto daur ulang) dan melihat
  penolakannya beserta alasan dan angkanya. Kalau ada tarik-menarik keputusan desain,
  pengalaman mereka yang didahulukan.
- **Pencari informasi:** penyandang disabilitas, pendamping, dan keluarga yang ingin tahu
  "bisakah saya masuk ke tempat X" sebelum berangkat. Tiga profil: kursi roda manual, alat
  bantu jalan (kruk, walker, tongkat), netra. Banyak memakai pembaca layar, zoom 200%,
  atau punya keterbatasan motorik.
- **Kontributor lapangan:** siapa pun yang berdiri di depan bangunan dan memotretnya lewat
  kamera dalam aplikasi, tanpa akun, target di bawah 60 detik per lokasi, sering dengan
  satu tangan di trotoar.

## Product Purpose

Astara adalah sistem verifikasi kondisi fisik fasilitas publik. Yang disimpan adalah fakta
fisik yang bisa diamati (jumlah anak tangga, ada tidaknya ramp, lebar pintu, jalur
pemandu, lift, toilet), bukan penilaian. Penilaian dihitung saat diminta, menurut profil
kebutuhan pengguna. Setiap fakta membawa foto, hasil pemeriksaan keaslian, tanggal, dan
jumlah penguat. Berhasil kalau pengguna bisa memutuskan berangkat atau tidak berdasarkan
bukti, dan kalau data belum ada, sistem mengatakan belum tahu.

## Positioning

Platform lain (Google Maps, OpenStreetMap, Wheelmap) menyimpan klaim "aksesibel" tanpa
bukti dan sebagai penilaian tunggal. Astara menyimpan fakta berbukti, menilai per profil,
dan membuka seluruh jejak pemeriksaannya, termasuk kontribusi yang ditolak. Ini sistem
verifikasi yang hasilnya kebetulan bisa ditampilkan di peta, bukan aplikasi peta.

## Operating Context

- Demo langsung di depan juri, dari laptop dan ponsel, di koridor UNPAD Dipatiukur,
  Bandung (kampus, halte, fasilitas kesehatan). Tautan publik di Cloud Run.
- Alur baca: beranda dan pilih profil, daftar tempat (peta sekunder), laporan tempat,
  rincian atribut, jejak audit publik, halaman aturan penilaian.
- Alur kontribusi: pilih titik pandang, kamera dalam aplikasi, penolakan dengan alasan
  terukur atau konfirmasi usulan, ringkasan perubahan. Panel uji penolakan terpisah untuk
  juri.
- Tombol Bacakan membacakan laporan tempat dan rincian atribut.

## Capabilities and Constraints

- Stack yang ada: Next.js 16, React 19, Tailwind CSS v4, TypeScript. Leaflet dengan ubin
  OpenStreetMap untuk peta. Aturan lomba: tidak boleh component library atau template
  siap pakai; komponen ditulis sendiri di `lib/ui/`.
- Kosakata tetap: empat penilaian (tidak dapat diakses, dapat diakses dengan catatan,
  dapat diakses, belum dapat dipastikan), tiga status bukti (terverifikasi, belum
  terverifikasi, perlu ditinjau ulang) ditambah bersengketa, delapan atribut, tiga titik
  pandang (pintu masuk, bagian dalam, toilet).
- Aturan antarmuka di `CLAUDE.md` dan `docs/docs-30-product.md` (warna semantik hanya untuk
  penilaian, badge terverifikasi tidak hijau, sasaran sentuh 48px, huruf sistem, tanpa
  localStorage, tanpa kata "aksesibel" tanpa profil) berlaku sebagai bawaan. Pemilik
  produk menyatakan aturan ini **boleh diubah dan akan diarahkan kasus per kasus**; jangan
  mengubahnya tanpa arahan eksplisit.
- Angka keyakinan AI tidak pernah tampil ke pengguna. Usulan model tidak pernah terpilih
  otomatis.
- Tidak termasuk lingkup: pemanduan rute, akun, lokasi tersimpan, notifikasi, papan
  kendali pengelola.

## Brand Commitments

- Nama produk: Astara.
- Suara: bahasa Indonesia yang lugas dan harfiah. Hambatan disebut pada bangunan, bukan
  pada orang. Tanpa permintaan maaf, tanpa nada riang. Kosakata mesin diterjemahkan, kode
  aslinya tetap tampil kecil.
- Kejujuran terhadap batas sistem adalah bagian dari identitas: "tidak dijamin, yang
  dilakukan sistem adalah ...", bukan "memastikan" atau "menjamin".

## Evidence on Hand

- Data tempat dari OpenStreetMap (ODbL, atribusi wajib), `scripts/seed/data/`.
- Data demo berlabel `is_demo_seed`, `db/seed/seed_demo.sql`; data contoh antarmuka di
  `lib/ui/api/fixtures.ts`.
- Foto bukti tayang dengan pengaburan wajah otomatis (`evidence.public_path`).
- Himpunan uji precision, `tools/metrics/testset/`.
- Ilustrasi atau foto dekoratif **boleh** dipakai selama jelas bukan bukti. Tidak ada
  testimoni, angka dampak, logo mitra, atau pengguna yang boleh dikarang.

## Product Principles

1. Fakta, bukan penilaian: penilaian selalu menyebut profilnya.
2. Setiap klaim membawa buktinya: foto, pemeriksaan, tanggal, penguat.
3. "Belum tahu" dikatakan terang-terangan dan tidak pernah tertukar dengan "tidak ada".
4. Penolakan adalah fitur: alasan dan angka terukurnya selalu terlihat.
5. AI hanya asisten; manusia yang mengonfirmasi.

## Accessibility & Inclusion

WCAG 2.1 AA sebagai syarat minimum. Semua fungsi bisa dicapai papan ketik dengan fokus
selalu terlihat, peta selalu punya padanan daftar, status tidak pernah disampaikan lewat
warna saja, halaman bisa diperbesar 200% tanpa gulir mendatar, dan foto bukti punya teks
alternatif serta keterangan tekstual.
