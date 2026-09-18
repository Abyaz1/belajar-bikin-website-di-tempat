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
| Atribut terverifikasi tanpa jejak audit | 0 | `npm run periksa:keutuhan` atas Cloud SQL produksi |
| Aturan jalur tulis yang terbukti berlaku di basis data hidup | 11 dari 11 | idem; append-only dibuktikan dengan mencoba UPDATE/DELETE, bukan membaca kebijakan |
| Build produksi | berhasil, tanpa peringatan | `npm run build` |
| EXIF pada tangkapan getUserMedia | tidak ada, juga tanpa tag GPS | Samsung Browser 30 / Android 10, 480x640, 40 KB, lewat /uji-kamera |
| Jarak pHash antar pintu berbeda | terdekat 24, ambang 6, jarak aman 18 | `npm run phash:kalibrasi` atas 12 foto koridor, 66 pasangan |
| Jarak pHash pintu sama, dua HP | 14 (pita penguatan 3-6: TERLEWAT) | dua HP, jarak 2 cm, dihitung modul server |
| Precision usulan model | step_count 1,00 (n=3) · ramp_wheelchair 1,00 (n=2) · tactile_paving tak terdefinisi | 36 citra berlabel manusia, gemini-3.8-flash, prompt 2026-09-18.v1 |
| Atribut usulan AI yang dimatikan gerbang | 1 dari 3 (`tactile_paving`) | migrasi 202609182330, sudah berlaku di produksi |

Gerbang precision sudah dijalankan dan sudah benar-benar mematikan sesuatu.
Angkanya tidak boleh disebut tanpa n-nya: precision 1,00 itu berdiri di atas 3
dan 2 usulan, dengan batas bawah selang 95% di 0,44 dan 0,34. Yang bisa dikatakan
jujur: tidak ada satu pun salah positif pada citra uji, dan `tactile_paving`
tidak punya bukti sama sekali sehingga dimatikan. Rinciannya di PERUBAHAN.md
entri 6.

**Risiko demo yang belum selesai: latensi model.** Pengukuran ini dijalankan dari
laptop, bukan dari Cloud Run. Pada percobaan pertama dengan timeout kontrak 8
detik, 21 dari 36 panggilan kehabisan waktu dan 7 sisanya menjawab `not_visible`
untuk semuanya — praktis tidak ada usulan yang keluar. Angka precision di atas
baru bisa diperoleh setelah timeout dinaikkan ke 45 detik khusus untuk mengukur
ketepatan; median latensinya 10,6 detik dan p95-nya 38 detik. Dari Cloud Run yang
sedaerah dengan Vertex, E4 di produksi memang menjawab `model_status: ok`, jadi
angka laptop ini bukan angka produksi. Tetapi selisihnya belum diukur dari sisi
produksi, dan sampai itu diukur, kemungkinan usulan tidak muncul saat demo harus
dianggap nyata. Yang menenangkan: alur kontribusi tidak bergantung padanya —
usulan kosong tetap menyisakan formulir yang bisa diisi kontributor, dan aturan 2
memang melarang usulan jadi nilai tanpa konfirmasi.

Kalibrasi pHash itu baru separuh. Yang terjawab: ambang 6 **tidak** salah menolak
foto pintu yang berbeda — 66 pasangan diuji, yang terdekat pun masih 24, jadi
kekhawatiran "turunkan ke 4 kalau salah tolak" di CLAUDE.md §17 tidak terbukti
dari sisi ini dan ambangnya dibiarkan 6.

Separuh yang belum terjawab kini sudah diukur, dan hasilnya: **pita penguatan C8
tidak terjangkau.** Dua HP memotret pintu yang sama dari jarak 2 cm menghasilkan
jarak **14** lewat modul server — di atas pita penguatan yang cuma 3–6. Hasil
klasifikasinya `none`, artinya C8 menganggap dua kontributor yang memotret pintu
yang sama sebagai tidak berhubungan sama sekali. Cabang "flag, bukan fail" itu
tidak pernah menyala.

Dua sentimeter praktis titik pandang yang sama, jadi ini kasus paling
menguntungkan. Tangkapan dua orang yang sungguhan — beda posisi, beda waktu —
akan lebih jauh lagi, bukan lebih dekat.

Ambangnya TIDAK diubah, dan itu keputusan sadar. Pengukuran ini memang
memperlihatkan celah 14..24 sehingga ambang mana pun di 14..23 memisahkan pintu
sama dari pintu berbeda. Tetapi n-nya satu pasang, dan pasangan itu kasus terbaik.
Kalau tangkapan dua orang yang wajar ternyata jatuh di 20–30, dia bertabrakan
dengan lantai pintu-berbeda yang ada di 24, dan tidak ada ambang bersih yang
memisahkan keduanya. Melebarkan pita dari satu pasangan terbaik berarti menukar
cacat yang diketahui dengan cacat yang tidak diketahui. Mengubahnya juga
mengubah kontrak yang dibekukan (CLAUDE.md §8 dan §17), yang butuh persetujuan
tiga engineer dan satu entri PERUBAHAN.md.

Yang tidak terpengaruh, supaya tidak salah dibaca: tugas utama C8 — menangkap
berkas daur ulang — tetap jalan, karena berkas yang sama menghasilkan jarak <=2.
Dan `corroboration_count` di mesin status tidak memakai pHash sama sekali; dia
menghitung `contributor_id` berbeda dengan nilai sama. Penguatan sebagai fitur
produk tetap hidup. Yang mati hanya satu cabang penandaan di audit.

Alasan paling menentukan untuk tidak melebarkannya datang dari kodenya sendiri.
Di dalam pita, classifyDuplicate mengembalikan `flag` HANYA untuk kombinasi
"kontributor beda + tempat dan vantage sama"; semua kombinasi lain berujung
`fail`. Jadi melebarkan pita dari 6 ke 18 tidak cuma menyalakan penandaan, dia
juga membuat dua kelas kontribusi sah jadi ditolak: kontributor yang sama
memotret pintu yang sama dua kali — menyumbang ulang setelah renovasi, misalnya —
jatuh di sekitar 14 dan langsung `fail`; dan tempat berbeda yang kebetulan di
bawah 18 juga `fail`, padahal sisa ruang ke lantai pintu-berbeda cuma 6 dan itu
baru dari 66 pasangan. Menukar satu penandaan di audit dengan dua kelas penolakan
salah adalah pertukaran yang merugikan.

Lagipula penguatan sebagai fitur produk tidak bergantung pada penandaan itu.
`corroboration_count` menghitung `contributor_id` berbeda yang nilainya sama —
lebih tepat daripada kemiripan citra, karena yang menguatkan sebuah fakta adalah
dua orang menyatakan hal yang sama, bukan dua foto yang mirip. Pita pHash itu
sedari awal jalur kedua untuk sesuatu yang sudah punya jalur pertama yang lebih
baik. Yang hilang karena ia tidak terjangkau, karena itu, kecil.

Keutuhan jalur tulis sekarang bisa dibuktikan kapan saja, bukan cuma saat
menyemai. `npm run periksa:keutuhan` menguji sebelas hal atas basis data yang
sedang hidup dan keluar dengan kode 1 kalau ada yang gagal. Yang penting dari cara
kerjanya: append-only tidak diperiksa dengan membaca daftar kebijakan RLS,
melainkan dengan benar-benar menjalankan UPDATE dan DELETE di dalam transaksi
lalu me-rollback-nya, dan menghitung baris yang terpengaruh. Membaca kebijakan
tidak membuktikan apa pun kalau peran koneksinya ternyata ber-BYPASSRLS — dan
kegagalan itu diam: tidak ada galat, barisnya cuma tidak berubah. Peran koneksi
karena itu ikut diperiksa lebih dulu.

Hasil atas produksi: 11 dari 11 lolos, nol atribut terverifikasi tanpa jejak
audit. Sempat terbaca 12 cacat, tapi itu kueri pemeriksanya yang salah alamat —
kode atribut ada di `payload_snapshot->'after'`, bukan di akar payload. Diperiksa
dulu sebelum dilaporkan sebagai cacat; datanya memang bersih.

Uji penolakan tidak dijalankan ulang malam ini, dan itu disengaja. Suite-nya uji
kotak-hitam lewat HTTP, jadi dia menulis ke basis data mana pun yang dipakai
aplikasi. Produksi baru punya 8 baris bukti; menjalankan 55 kasus ke sana akan
menambahkan puluhan baris uji yang PERMANEN, karena tabelnya append-only, tepat
di basis data yang mungkin dibuka juri. Keutuhannya diperiksa statis: 55 kasus,
dan keempat kelas yang diminta docs-10 §5 masing-masing 11, 11, 14, dan 10.
Untuk menjalankannya sungguhan, pakai Postgres lokal dan `next dev` — bukan
`next start`, yang memaksa NODE_ENV=production sehingga cookie Secure tidak
pernah kembali lewat http.

Skrip kalibrasinya sendiri sempat menutupi ini: dia hanya menganggap hasil `fail`
sebagai masalah, sehingga pasangan yang terlewat (`none`) dilaporkan sebagai
"semua masuk pita penguatan" sambil memperlihatkan sisa ruang negatif. Sudah
diperbaiki — untuk pasangan pintu-sama, hasil yang benar adalah `flag`, dan
`none` kini dilaporkan sebagai kegagalan.

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
