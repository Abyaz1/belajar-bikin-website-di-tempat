# Draf entri `PERUBAHAN.md` — jalur baca dan model (Verification engineer)

Status: **draf**. Empat entri di bawah disusun untuk dipindahkan problem owner ke
`PERUBAHAN.md`, dengan format empat bagian yang sama. Penomorannya menyesuaikan
saat digabung.

Entri 2 punya satu bagian yang **sengaja masih kosong**: hasil gerbang precision.
Bagian itu diisi setelah label himpunan uji ditetapkan manusia dan pengukurannya
dijalankan. Jangan diisi perkiraan.

---

## Entri 1 — Tag `highway=elevator` dari OpenStreetMap tidak dipetakan ke status lift

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

## Entri 2 — Himpunan uji precision 12 citra, tanpa bagian penyetelan

**Kondisi di proposal:** Gerbang precision 0,85 diukur pada 60–90 citra berlabel
(docs-20 §5). Sebagian citra disisihkan khusus untuk menyetel prompt. Prompt
dibekukan, lalu precision diukur pada sisanya.

**Yang diubah:**
- Himpunan uji berisi 12 foto koridor Dipatiukur, semuanya bagian `ukur`.
- Tidak ada bagian penyetelan. Prompt dibekukan di versi `2026-09-18.v1`
  **sebelum** foto-foto ini ada, jadi tidak ada citra yang pernah dipakai untuk
  menyetelnya.
- Pemisahan dan pelabelnya tercatat di `tools/metrics/testset/labels.json`.

**Alasan perubahan:** Foto koridor yang terkumpul sampai tenggat hanya 12.
Menyisihkan sebagian untuk penyetelan akan menyisakan terlalu sedikit untuk
diukur. Karena prompt dibekukan lebih dulu, syarat intinya tetap terpenuhi:
model tidak pernah disetel pada citra yang dipakai mengukurnya.

**Hasil gerbang:** *[diisi setelah pengukuran: per atribut jumlah usulan, jumlah
salah, precision, interval Wilson 95 persen, cakupan `not_visible`, ukuran
sampel, dan atribut mana yang `ai_suggestable`-nya dimatikan]*

**Dampak terhadap masalah inti:** Dengan 12 citra, intervalnya lebar. Angkanya
cukup untuk menyatakan sebuah atribut **jelas gagal**, tapi belum cukup untuk
menyatakan sebuah atribut lolos dengan yakin. Karena itu keputusan gerbang
condong ke mematikan usulan. Mematikan usulan tidak mengurangi apa pun yang bisa
dicatat: kontributor tetap mengisi atribut itu sendiri, dan konfirmasi manusia
tetap wajib untuk setiap nilai. Yang kami hindari adalah angka precision yang
terlihat meyakinkan tetapi tidak didukung sampelnya.

---

## Entri 3 — Uji ambang pHash dengan hash peramban dinyatakan tidak berlaku untuk C8

**Kondisi di proposal:** Ambang pHash (identik ≤ 2, mirip 3–6) diputuskan lewat
tes dua orang memotret pintu yang sama di jam 0. Hasilnya menentukan ambang C8.

**Yang diubah:**
- Tes jam 0 dijalankan di halaman uji kamera, yang menghitung hash **di peramban**.
  Hasilnya: jarak Hamming 16 dari satu pasang foto.
- Hasil itu dinyatakan tidak berlaku untuk C8. Ambang tetap 6 **sementara**.
- Kalibrasi ulang dijalankan dengan hash yang dihitung server
  (`npm run phash:kalibrasi`), memakai modul yang sama dengan yang menegakkan C8
  di E4.

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

## Entri 4 — Pembacaan suara laporan kesiapan untuk pengguna netra

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
