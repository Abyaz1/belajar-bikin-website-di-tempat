# Progres

Diperbarui menjelang tiap checkpoint panitia. Problem owner yang memegang berkas
ini; bagian per orang diisi masing-masing.

Aturan isinya satu: **tulis yang terukur, bukan yang terasa.** Angka tanpa cara
mengukurnya tidak dipakai, dan yang belum jadi disebut belum jadi.

---

## Checkpoint 2 — 21:00, 18 September (gerbang precision)

Sasaran jadwal: *gerbang precision diputuskan, atribut di bawah 0,85 dimatikan
usulannya.*

### Ringkasan jujur

Seluruh perkakasnya siap dan teruji, tetapi **gerbangnya belum bisa dijalankan**
karena himpunan uji berlabel belum ada. Label harus ditetapkan manusia sebelum
model melihat citranya; mengarangnya akan membuat satu-satunya angka yang
menggerbangi usulan AI tidak berarti apa-apa. Jadi ini menunggu anotasi, bukan
menunggu kode.

| Sasaran | Keadaan |
|---|---|
| Aplikasi hidup di Cloud Run | **tercapai** — revisi `ifest-00004-rxf`, seluruh halaman kontrak §9 membalas 200 |
| Cloud SQL terisi dan terpakai | **tercapai** — 44 tempat, jalur baca dan tulis keduanya jalan |
| GCS terpakai | **tercapai** — unggahan nyata, objek terbukti tidak bisa diakses publik |
| Vertex AI terpanggil | **tercapai** — `model_status: ok`, model menjawab pada kontribusi nyata |
| Gerbang precision | **belum** — menunggu himpunan uji berlabel dari problem owner |

### Yang berubah sejak checkpoint 1

- Deployment diperbaiki. Sebelumnya melayani image lama yang belum memuat E1,
  sehingga `/uji-penolakan` membalas 500 dan `/tempat` macet di "Memuat data
  tempat…". Keduanya pulih.
- Migrasi dan data benih demo diterapkan ke Cloud SQL.
- Penyemaian OSM koridor Dipatiukur masuk: 39 tempat, 3 klaim atribut, semuanya
  `belum_terverifikasi`.
- Jalur tulis diuji ujung ke ujung di produksi: sesi anonim, token penangkapan,
  draft dengan kesembilan pemeriksaan lolos, konfirmasi wajib ditegakkan,
  pengulangan ditolak 409.
- Penegakan append-only diuji langsung di Cloud SQL, bukan hanya di lokal.
- Uji penolakan dinaikkan jadi 55 kasus supaya memenuhi syarat sepuluh per kelas.

### Satu hasil yang layak masuk deck

Pada kontribusi nyata di produksi, model menjawab `not_visible` untuk ketiga
atribut yang diukur — citranya memang bukan pintu — lalu kontributor
mengoreksinya, dan `was_corrected` tercatat `true`. Model menolak menebak,
manusia mengoreksi, keduanya terekam. Itu pengaman yang paling sering gagal di
sistem sejenis, dan di sini ada buktinya.

### Batasan yang diakui

- **Tidak ada satu pun bukti yang punya foto tayang.** Pengaburan wajah adalah
  butir 1 daftar pemotongan dan belum dikerjakan, jadi kolom foto tayang kosong
  untuk semua baris termasuk data demo. Fotonya tersimpan, hanya tidak
  ditampilkan. Ini perlu keputusan: dipotong resmi dan dicatat, atau dikerjakan.
- Penolakan Row Level Security bersifat senyap: nol baris, tanpa galat.
- Unggahan bersih lewat API langsung tidak tertangkap pemeriksaan metadata, dan
  koordinat yang dikarang lolos pemeriksaan jarak. Keduanya punya tes sendiri
  yang sengaja mengharapkan hasil itu.

### Angka

| Ukuran | Angka | Cara |
|---|---|---|
| Unit test seluruh repo | 285 lolos, 2 dilewati | `npm test` |
| Uji penolakan | 55 lolos, sepuluh atau lebih per kelas | `pytest tests/rejection` |
| Tempat di produksi | 44 (39 OSM, 5 demo) | Cloud SQL |
| Atribut terverifikasi tanpa jejak audit | 0 | pemeriksaan di akhir skrip benih |
| Build produksi | berhasil, tanpa peringatan | `npm run build` |

---

## Checkpoint 1 — 15:00, 18 September

Sasaran jadwal: *aplikasi nyata sudah di Cloud Run, Cloud SQL dan GCS tersambung.*

### Ringkasan jujur

Infrastruktur GCP siap dan terbukti dipakai, tetapi **aplikasinya belum pernah
di-deploy**. Jadi sasaran checkpoint ini tercapai sebagian: lapisan datanya hidup
dan sudah diuji dari laptop, lapisan penyajiannya belum ada di Cloud Run.

| Sasaran | Keadaan |
|---|---|
| Cloud SQL tersambung | **tercapai** — kelima migrasi diterapkan, penegakan append-only diuji langsung di sana |
| GCS tersambung | **tercapai** — unggahan nyata berhasil, objek terbukti tidak bisa diakses publik |
| Aplikasi di Cloud Run | **belum** — tidak ada layanan Cloud Run di region mana pun, dan Artifact Registry masih kosong |

### Jalur tulis (Trust)

Selesai dan terverifikasi:

- Sembilan pemeriksaan provenans C0–C8 berjalan seluruhnya tanpa berhenti di
  kegagalan pertama; penolakan membawa alasan dan nilai terukurnya.
- E4, E5, E7, E8 jalan. Konfirmasi wajib ditegakkan `NOT NULL` di level basis
  data, bukan validasi aplikasi.
- Mesin status atribut, penanda sengketa, dan jejak audit di semua jalur.
- Data benih demo bertanggal mundur dan berlabel; memunculkan ketiga status
  sekaligus satu kasus sengketa.

Angka yang bisa disebut, beserta cara mengukurnya:

| Ukuran | Angka | Cara |
|---|---|---|
| Unit test seluruh repo | 248 lolos, 2 dilewati | `npm test` |
| Uji penolakan jalur tulis | 41 lolos, 0 dilewati | `pytest tests/rejection` melawan basis data hasil migrasi |
| Atribut terverifikasi tanpa jejak audit | 0 | pemeriksaan keterlacakan di akhir `seed_demo.sql` |
| Pemeriksaan tipe | 0 galat | `npx tsc --noEmit` |
| Build produksi | berhasil, tanpa peringatan | `npm run build` |

Dua hal yang diverifikasi langsung di Cloud SQL, bukan hanya di lokal:

- **Append-only berlaku di produksi.** Peran koneksi `ifest_app` tidak membawa
  `BYPASSRLS`, begitu pula `cloudsqlsuperuser` yang diwarisinya. Percobaan
  `UPDATE` dan `DELETE` pada `audit_event` memengaruhi nol baris, sementara
  `SELECT` pada baris yang sama tetap melihatnya — jadi yang menolak memang RLS,
  bukan klausa `WHERE` yang meleset.
- **Objek bukti asli tidak publik.** Unggahan nyata ke bucket berhasil, lalu
  diambil tanpa kredensial membalas HTTP 403, dan bucket tidak punya binding
  `allUsers`.

Batasan yang diakui, bukan ditutupi:

- Penolakan RLS bersifat **senyap**: nol baris, tanpa galat. Jalur kode yang
  keliru mencoba mengubah jejak audit tidak akan gagal berisik, hanya tidak
  melakukan apa-apa.
- Unggahan JPEG bersih hasil re-encode lewat API langsung **tidak** tertangkap
  pemeriksaan metadata, dan koordinat yang dikarang **lolos** pemeriksaan jarak.
  Keduanya punya tes sendiri yang sengaja mengharapkan hasil itu. Lapisan ini
  menaikkan biaya pemalsuan, tidak menutup celah.
- `evidence.public_path` belum diisi jalur mana pun, jadi foto tayang hasil
  pengaburan wajah belum ada.
- Belum ada mekanisme reset batas laju yang tercatat di audit untuk latihan demo.

### Jalur baca dan model (Verification)

Rules engine, tabel aturan profil, E6, modul usulan Vertex, dan perkakas
pengukur precision sudah masuk `main` beserta tesnya. Angka precision belum
diukur; gerbangnya jam 21:00.

Satu hal yang memblokir pengujian lokal: modul basis data bersama menuntut
`CLOUD_SQL_CONNECTION_NAME` tanpa jalan mundur ke `DATABASE_URL`, sehingga E6
tidak bisa dijalankan dari laptop.

### Antarmuka dan deploy (Product)

Layar baca L1–L6, alur kontribusi L7–L11, panel uji penolakan L12, dan design
system sudah masuk `main` beserta tes regresinya.

**Yang menahan checkpoint ini:** belum ada `gcloud builds submit` maupun
`gcloud run deploy` yang pernah dijalankan. `README.md` mencantumkan URL Cloud
Run untuk panitia, tetapi URL itu membalas 404 karena layanannya belum pernah
dibuat. Runnable Artifact wajib menurut ketentuan teknis no. 5c.

Satu hal yang harus ikut sebelum deploy pertama: perintah di `README.md` belum
mengirim `SESSION_SECRET`. Tanpa itu endpoint sesi melempar galat pada
permintaan pertama dan seluruh alur kontribusi mati.

### Data uji dan dokumen (Problem owner)

`PERUBAHAN.md` masih berisi template tanpa satu pun entri. Lima entri jalur tulis
sudah siap dalam format empat bagian di `DRAF_PERUBAHAN_TRUST.md` dan tinggal
dipindahkan. Metrik no. 1 yang berbobot 30 persen menilai berkas itu secara
eksplisit.

---

## Keputusan yang sudah diambil

| Jam | Keputusan | Alasan singkat |
|---|---|---|
| 10:00 | Mekanisme kamera `getUserMedia` | Keluaran kanvas tidak membawa EXIF, sehingga adanya EXIF menjadi penanda yang berarti |
| 10:00 | Radius dasar 75 m, batas gagal 120 m | Nilai kontrak; penjepit `min(75 + akurasi, 120)` mencegah dua aturan bertabrakan |
| 10:00 | Ambang pHash: identik ≤ 2, mirip 3–6 | Ambang tunggal akan menolak penguatan yang sah |
| 13:00 | `place` dan `attribute_type` milik Verification | Dua migrasi membuat tabel yang sama; jalur tulis menyerahkannya dan menyesuaikan kolom |
| 14:00 | Satu pool basis data untuk seluruh proses | Dua pool menggandakan koneksi, dan jalur tulis tidak akan tersambung di Cloud Run |

## Pemotongan yang dijalankan

Belum ada.
