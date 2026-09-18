---
name: Astara
description: Sistem verifikasi kondisi fisik fasilitas publik; fakta berbukti, dinilai per profil kebutuhan.
colors:
  tinta-malam: "#363b58"
  abu-kabut: "#a2a8b4"
  abu-semen: "#c1c5ce"
  biru-embun: "#d5d9e4"
  dinding-kapur: "#ecebe9"
  kertas-arsip: "#e7dac7"
  putih-kartu: "#ffffff"
  tinta-redup: "#565b70"
  garis-kendali: "#6b7080"
  tidak-ink: "#9c3a1e"
  tidak-fill: "#fdefea"
  tidak-line: "#b5452b"
  catatan-ink: "#7a4a00"
  catatan-fill: "#fdf3e2"
  catatan-line: "#b07400"
  dapat-ink: "#1b5e32"
  dapat-fill: "#e9f4ec"
  dapat-line: "#2e7d4f"
  belum-ink: "#414851"
  belum-fill: "#f0f2f5"
  belum-line: "#767d86"
  demo-ink: "#4a3b00"
  demo-bg: "#fbf3d0"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
  card:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.tinta-malam}"
    textColor: "{colors.putih-kartu}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.putih-kartu}"
    textColor: "{colors.tinta-malam}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "48px"
  tab-active:
    backgroundColor: "{colors.tinta-malam}"
    textColor: "{colors.putih-kartu}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  tab-idle:
    backgroundColor: "{colors.putih-kartu}"
    textColor: "{colors.tinta-malam}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  tab-idle-hover:
    backgroundColor: "{colors.biru-embun}"
  chip-selected:
    backgroundColor: "{colors.tinta-malam}"
    textColor: "{colors.putih-kartu}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
  chip-idle:
    backgroundColor: "{colors.putih-kartu}"
    textColor: "{colors.tinta-malam}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "48px"
  floating-panel:
    backgroundColor: "{colors.putih-kartu}"
    rounded: "{rounded.lg}"
    padding: "8px"
  place-card:
    backgroundColor: "{colors.putih-kartu}"
    textColor: "{colors.tinta-malam}"
    rounded: "{rounded.md}"
    padding: "24px"
  verdict-tidak:
    backgroundColor: "{colors.tidak-fill}"
    textColor: "{colors.tidak-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  verdict-catatan:
    backgroundColor: "{colors.catatan-fill}"
    textColor: "{colors.catatan-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  verdict-dapat:
    backgroundColor: "{colors.dapat-fill}"
    textColor: "{colors.dapat-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  verdict-belum:
    backgroundColor: "{colors.belum-fill}"
    textColor: "{colors.belum-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  evidence-badge:
    backgroundColor: "{colors.biru-embun}"
    textColor: "{colors.tinta-malam}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  input-text:
    backgroundColor: "{colors.putih-kartu}"
    textColor: "{colors.tinta-malam}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  demo-label:
    backgroundColor: "{colors.demo-bg}"
    textColor: "{colors.demo-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: Astara

## Overview

**Creative North Star: "Papan Petunjuk Publik"**

Astara berbicara seperti papan penunjuk arah di stasiun atau gedung layanan publik:
tenang, jelas, bisa dibaca siapa saja dari jarak mana pun, dan tidak pernah berhias
lebih dulu daripada memberi informasi. Pengunjung datang untuk satu pertanyaan, "bisakah
saya masuk ke tempat ini", dan setiap elemen di layar ada untuk menjawabnya, lengkap
dengan dasar jawabannya: foto, tanggal, dan hasil pemeriksaan.

Ruang utamanya adalah kota itu sendiri. Beranda membuka peta layar penuh; kepala
halaman, panel profil, dan dialog melayang di atasnya sebagai kartu putih membulat di
atas latar abu hangat. Karakternya lembut dan tenang: sudut membulat, tanpa bayangan,
tanpa animasi yang tidak perlu. Warna dipakai hemat. Satu warna gelap (Tinta Malam)
membawa teks, merek, dan aksi; lima warna terang membawa ruang. Warna yang benar-benar
"berbicara" hanya warna penilaian, dan itu pun selalu disertai ikon berbentuk khas dan
teks.

Sistem ini menolak tampilan template generik: tidak ada hero foto stok, kartu fitur
berikon seragam, gradien, atau badge hijau yang berkata "aman" tanpa bukti.

**Key Characteristics:**
- Peta sebagai ruang utama, kartu putih mengambang di atasnya.
- Palet bernomor 1 sampai 6; hanya warna 1 yang dipakai untuk teks.
- Warna semantik hanya untuk empat penilaian, selalu dengan ikon dan teks.
- Sudut membulat, datar, tanpa bayangan; lapisan terbaca dari latar dan garis.
- Sasaran sentuh minimal 48px, teks tidak pernah di bawah 0,875rem.
- Huruf sistem, bahasa Indonesia yang lugas, tanpa em dash.

## Colors

Palet tenang dari pemilik produk: satu tinta gelap kebiruan di atas lima nada abu,
biru, dan krem yang terang. Nomor 1 sampai 6 adalah nama kerja tim; arahan perubahan
cukup menyebut nomornya, dan di kode tersedia sebagai `--color-p1` sampai `--color-p6`.

### Primary
- **Tinta Malam** (warna 1): teks utama, merek, tombol utama, tab dan chip terpilih, cincin fokus. Satu-satunya warna palet yang lolos kontras teks (9,16 di atas Dinding Kapur, 10,92 di atas putih).

### Secondary
- **Kertas Arsip** (warna 6): aksen hangat. Kotak sorotan kalimat penting ("kami tidak menyimpan kata aksesibel"), lingkaran nomor langkah, latar ilustrasi, dan banner data contoh. Juga warna cincin fokus di atas latar Tinta Malam (7,93).

### Neutral
- **Dinding Kapur** (warna 5): latar halaman. Tidak putih murni, untuk menekan silau.
- **Biru Embun** (warna 4): latar bagian, hover, badge status bukti, latar ilustrasi.
- **Abu Semen** (warna 3): garis dekoratif dan pemisah.
- **Abu Kabut** (warna 2): titik indikator langkah dan garis tanah ilustrasi. Tidak untuk teks (2,00 di atas Dinding Kapur).
- **Putih Kartu**: isi kartu, panel mengambang, kendali.
- **Tinta Redup**: teks sekunder dan meta. Nada Tinta Malam yang lebih terang (5,64 di atas Dinding Kapur).
- **Garis Kendali**: batas input, tombol sekunder, kartu yang bisa ditekan. Nada Tinta Malam yang lebih terang (4,14 di atas Dinding Kapur, di atas ambang 3:1).

### Tertiary: warna penilaian
Empat keluarga warna semantik, masing-masing dengan tinta, isian, dan garis. Garis
vs isian selalu di atas 3:1 (tidak 4,86, catatan 3,57, dapat 4,47, belum 3,71).
- **Karat** (tidak dapat diakses): oranye karat, bukan merah menyala, supaya memperingatkan tanpa memicu panik.
- **Madu Tua** (dapat diakses dengan catatan).
- **Hijau Daun** (dapat diakses).
- **Abu Tanya** (belum dapat dipastikan).
- **Kuning Demo** (label data demonstrasi): sengaja asing dari semua warna lain.

### Named Rules
**The Satu Tinta Rule.** Teks hanya ditulis dengan Tinta Malam atau nada turunannya (Tinta Redup). Warna 2 sampai 6 tidak pernah menjadi warna teks.

**The Warna Hanya Untuk Penilaian Rule.** Warna semantik (karat, madu, hijau, abu tanya) hanya dipakai untuk empat penilaian. Status bukti selalu netral Biru Embun, dan badge "Terverifikasi" tidak pernah hijau, karena "terverifikasi tidak ada ramp" justru menghasilkan penilaian buruk.

**The Tidak Pernah Warna Saja Rule.** Setiap warna penilaian datang bersama ikon berbentuk khas (segi delapan berpalang, segitiga seru, lingkaran centang, lingkaran tanya) dan teks yang menyebut profilnya.

## Typography

**Display Font:** tumpukan huruf sistem (system-ui, Segoe UI, Roboto, Noto Sans, dan seterusnya)
**Body Font:** sama

**Character:** Satu keluarga huruf sistem untuk semuanya, menghormati setelan huruf yang
dipasang pengguna low vision dan tanpa unduhan font. Hierarki dibangun dari ukuran dan
ketebalan, bukan dari keluarga huruf kedua.

### Hierarchy
- **Display** (700, 2.25rem, naik ke 2.75rem di layar lebar, 1.25): judul halaman utama seperti "Cara kerja Astara" dan judul panduan.
- **Headline** (700, 1.75rem, 1.25): judul layar dan judul langkah di dialog.
- **Title** (700, 1.375rem, 1.3): judul bagian.
- **Card** (600, 1.125rem, 1.35): nama tempat, nama profil, judul langkah.
- **Body** (400, 1.0625rem, 1.5): teks utama. Paragraf dibatasi sekitar 48rem.
- **Meta** (400, 0.9375rem, 1.5): keterangan, tanggal, hitungan.
- **Label** (600, 0.875rem, 1.3): badge, chip, tab di layar sempit.

### Named Rules
**The Batas Bawah Rule.** Tidak ada teks di bawah 0,875rem, dan semua ukuran teks memakai rem, tidak pernah px.

**The Tanpa Em Dash Rule.** Teks antarmuka tidak memakai em dash. Pisahkan dengan titik, koma, titik dua, atau titik tengah.

## Layout

Isi halaman berada di satu kolom tengah selebar maksimal 72rem (max-w-6xl), dengan jarak
tepi 12px di ponsel dan 24px mulai 768px. Kepala halaman, banner, isi, dan kaki halaman
memakai batas kiri dan kanan yang sama persis, sehingga semuanya sejajar.

Beranda berbeda: peta memenuhi layar (fixed, inset 0), kepala halaman mengambang di atas
dengan jarak 12px dari tepi, dan panel profil mengambang di bawah dengan lebar maksimal
56rem. Kendali Leaflet digeser supaya tidak tertutup keduanya.

Skala jarak satu-satunya adalah 4, 8, 12, 16, 24, 32, 48, 64px. Jarak antar bagian
halaman 32 sampai 64px; jarak di dalam kartu 24px; jarak antar sasaran sentuh minimal 8px.

Di layar sempit, empat tab memakai grid empat kolom dengan label pendek (Peta, Daftar,
Aturan, Cara kerja), kartu profil di dialog menjadi mendatar (ilustrasi di kiri), dan
nama profil di panel peta memendek (Kursi roda, Alat bantu, Netra). Halaman tidak pernah
bergulir mendatar, termasuk saat diperbesar 200%.

## Elevation & Depth

Sistem ini datar. Tidak ada bayangan di mana pun. Kedalaman dibaca dari tiga lapis
warna: Dinding Kapur di dasar, Putih Kartu untuk kartu dan panel, Biru Embun untuk hover
dan bagian. Batas lapisan ditandai garis Abu Semen setebal 1px. Satu-satunya lapisan
"di atas" adalah dialog, yang memisahkan diri dengan tirai Tinta Malam tembus pandang
(60%) di belakangnya.

### Named Rules
**The Garis Bukan Bayangan Rule.** Pemisah lapisan selalu garis atau perbedaan latar, tidak pernah box-shadow.

## Shapes

Bahasa bentuknya lembut dan membulat. Empat tingkat sudut: 4px untuk label kecil, 8px
untuk tombol, kartu, dan input, 16px untuk panel mengambang (kepala halaman, panel profil,
dialog, kartu langkah), dan pil penuh untuk tab, chip, badge, dan pemilih profil. Garis
selalu 1px kecuali penanda terpilih (3px Tinta Malam) dan tepi kiri kartu tempat (6px,
berwarna penilaian, putus-putus untuk "belum dapat dipastikan").

## Components

### Buttons
Padat dan tenang, satu aksi utama per kelompok.
- **Shape:** sudut membulat (8px); di dialog panduan berbentuk pil.
- **Primary:** isian Tinta Malam, teks putih, tinggi minimal 48px, padding 8px 16px.
- **Secondary:** isian putih, garis 2px Tinta Malam, teks Tinta Malam.
- **Teks:** tanpa garis, bergaris bawah.
- **Hover / Focus:** hover sedikit memudar atau berlatar Biru Embun; fokus berupa cincin 3px Tinta Malam dengan jarak 2px dari tepi, yang tidak boleh dikurangi.
- **Memuat:** teksnya berubah jadi kata kerja ("Memeriksa bukti..."), bukan hanya spinner.

### Chips
- **Style:** pil putih bergaris Garis Kendali 2px, teks Tinta Malam, tinggi 48px.
- **State:** terpilih berisi Tinta Malam dengan teks putih dan tanda centang atau teks "dipilih" untuk pembaca layar. Dipakai untuk pemilih profil dan pintasan jenis tempat.

### Cards / Containers
- **Corner Style:** 8px untuk kartu tempat, 16px untuk kartu langkah dan panel.
- **Background:** Putih Kartu di atas Dinding Kapur.
- **Shadow Strategy:** tidak ada (lihat Elevation & Depth).
- **Border:** 1px Garis Kendali untuk kartu yang bisa ditekan, 1px Abu Semen untuk wadah pasif.
- **Internal Padding:** 24px.
- **Kartu tempat:** seluruh kartu satu sasaran tekan; tepi kiri 6px berwarna penilaian.

### Inputs / Fields
- **Style:** putih, garis 2px Garis Kendali, sudut 8px, tinggi 48px, label terlihat di atasnya.
- **Focus:** cincin 3px Tinta Malam berjarak 2px.

### Navigation
- **Style:** satu kartu putih membulat (16px) yang mengambang 12px dari tepi atas, berisi tanda merek dan empat tab berbentuk pil: Peta, Daftar tempat, Aturan penilaian, Cara kerja.
- **State:** tab aktif berisi Tinta Malam dengan teks putih dan `aria-current`; tab lain berlatar Biru Embun saat hover.
- **Mobile:** grid empat kolom, label pendek, satu baris, tinggi 48px.

### Peta layar penuh (signature)
Peta Leaflet dengan ubin OpenStreetMap memenuhi layar beranda. Penanda tempat berbentuk
ikon penilaian (36px). Tombol perbesar dan perkecil berukuran 48px di kanan bawah.
Di bawah melayang panel profil berilustrasi dan tombol Daftar; keterangan penanda
tersimpan di balik tombol "Keterangan penanda". Atribusi OpenStreetMap selalu terlihat.

### Dialog panduan (signature)
Dialog modal asli tiga langkah (tentang Astara, cara kerja, pilih profil), panel putih
16px, tirai Tinta Malam 60%. Indikator langkah berupa titik Abu Kabut dengan langkah aktif
memanjang Tinta Malam. Tampil sekali pada kunjungan pertama.

### Ilustrasi profil
Adegan datar sederhana: sosok Tinta Malam di depan pintu putih, matahari Kertas Arsip,
latar Biru Embun, tanah Kertas Arsip. Kursi roda, walker, dan tongkat putih di atas jalur
pemandu. Selalu dekoratif dan selalu disertai nama profil.

### Badge penilaian dan status bukti
Badge penilaian: pil berisian warna penilaian, ikon khas, teks "Tidak dapat diakses untuk
kursi roda manual". Badge status bukti: pil netral Biru Embun dengan ikon perisai, jam,
atau dua panah, dan tanggal; "Belum terverifikasi" bergaris putus-putus.

## Do's and Don'ts

### Do:
- **Do** memakai Tinta Malam (warna 1) untuk semua teks, dan Tinta Redup untuk teks sekunder.
- **Do** menyertakan ikon berbentuk khas dan nama profil pada setiap penilaian.
- **Do** menjaga sasaran sentuh minimal 48px dan jarak antar sasaran minimal 8px.
- **Do** menyejajarkan kepala halaman, banner, isi, dan kaki halaman pada batas yang sama (12px di ponsel, 24px di layar lebar, maksimal 72rem).
- **Do** menandai data demonstrasi dengan label Kuning Demo bermotif diagonal.
- **Do** menyebut arahan warna dengan nomor palet 1 sampai 6.

### Don't:
- **Don't** memakai warna 2 sampai 6 sebagai warna teks.
- **Don't** membuat badge "Terverifikasi" berwarna hijau.
- **Don't** memakai bayangan, gradien, atau efek kaca.
- **Don't** mengurangi jarak 2px cincin fokus atau menghapusnya.
- **Don't** menulis ukuran teks dalam px atau di bawah 0,875rem.
- **Don't** memakai em dash di teks antarmuka.
- **Don't** memakai component library atau template siap pakai.
- **Don't** menampilkan angka keyakinan AI kepada pengguna.
