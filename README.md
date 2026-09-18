# Astara

Astara adalah sistem verifikasi atribut aksesibilitas tempat publik. Yang disimpan
adalah fakta fisik yang bisa diamati, bukan penilaian, dan setiap atribut wajib
disertai foto, hasil pemeriksaan keaslian, dan timestamp. Penilaian aksesibilitas
dihitung saat request dengan menerapkan profil kebutuhan pengguna ke fakta tersebut.

Dibuat untuk Hackathon IFEST UNPAD 2026, 18–19 September 2026.

## Verifikasi oleh panitia

- Aplikasi: https://ifest-760278352894.asia-southeast2.run.app
- Panel uji penolakan: https://ifest-760278352894.asia-southeast2.run.app/uji-penolakan

Alur kontribusi memakai kamera dan lokasi, jadi **buka di ponsel** (Chrome di
Android atau Safari di iOS) lalu izinkan akses kamera dan lokasi. Di laptop tanpa
kamera, alur kontribusi tidak bisa dijalankan, tetapi daftar tempat, laporan, dan
jejak audit tetap bisa diperiksa. Tidak perlu akun.

Langkah demo singkat:

1. Buka aplikasi, lalu pilih profil kebutuhan: kursi roda manual, alat bantu jalan,
   atau netra.
2. Pilih satu tempat dari daftar untuk membuka laporan kesiapannya. Ganti profil
   dan perhatikan penilaiannya ikut berubah.
3. Di laporan tempat, pilih **Perbarui data ini**, pilih titik pandang pintu masuk,
   ambil foto, periksa usulan sistem, konfirmasi nilainya, lalu kirim.
4. Buka jejak audit salah satu atribut untuk melihat bukti dan hasil setiap
   pemeriksaan keaslian.
5. Di panel uji penolakan, jalankan tiga serangan: unggah dari galeri, kirim foto
   lokasi lain, dan kirim ulang foto lama. Setiap penolakan menampilkan alasan dan
   nilai terukurnya.

## Prerequisite Project

### Perangkat lunak

| Kebutuhan | Versi | Dipakai untuk |
|---|---|---|
| Node.js | 24 LTS (minimal 20.9) | build dan run lokal |
| npm | 11 (bawaan Node.js 24) | instal dependency dari `package-lock.json` |
| Git | terbaru | clone repo |
| Docker | terbaru | build dan run image container secara lokal (opsional) |
| Google Cloud CLI (`gcloud`) | terbaru | deploy ke Cloud Run, dan kredensial lokal ke Google Cloud |

Stack: Next.js 16.3 (App Router), React 19.2, TypeScript 5.9, Tailwind CSS 4.3.
Data di PostgreSQL 18 (Cloud SQL), foto bukti di Cloud Storage, usulan atribut dari
Vertex AI. Tidak memakai component library; komponen UI ditulis sendiri di `lib/ui/`.

### Google Cloud

- Project dengan billing aktif, dan akun `gcloud` berperan Owner di project itu
  (dibutuhkan untuk memberi izin IAM).
- Layanan yang dipakai: Cloud Run, Cloud Build, Artifact Registry, Vertex AI,
  Cloud SQL, Cloud Storage, dan Secret Manager. Perintah untuk mengaktifkannya ada
  di [How to deploy](#how-to-deploy).
- Instance Cloud SQL beserta database dan user-nya, serta satu bucket Cloud Storage.

### Dependency opsional

`@google-cloud/storage` **tidak** ada di `package.json` dan tidak terpasang oleh
`npm ci`. Paket itu hanya dibutuhkan ketika penyimpanan bukti dipindah ke Cloud
Storage. Impornya dinamis, jadi selama `STORAGE_DRIVER=local` aplikasi berjalan
normal tanpanya; `npm run build` hanya memunculkan satu peringatan
`Module not found`, bukan galat.

**Sebelum mengubah `STORAGE_DRIVER` menjadi `gcs`, paket itu wajib dipasang:**

```bash
npm install @google-cloud/storage
```

Tanpa itu, setiap unggahan bukti membalas HTTP 500 dengan pesan
`STORAGE_DRIVER=gcs tetapi paket @google-cloud/storage belum terpasang`.
Tidak ada baris `evidence` yang tertulis saat itu terjadi, jadi basis data tidak
meninggalkan bukti separuh jadi.

### Variabel lingkungan

Daftarnya ada di `.env.example`. Salin menjadi `.env.local`, lalu isi **tanpa tanda
kutip** supaya terbaca sama oleh Next.js, Docker, dan bash.

| Variabel | Isi |
|---|---|
| `GCP_PROJECT_ID` | ID project Google Cloud |
| `GCP_REGION` | region Cloud Run, misalnya `asia-southeast2` (Jakarta) |
| `VERTEX_LOCATION` | lokasi endpoint Vertex AI, misalnya `global` |
| `VERTEX_MODEL` | nama model Vertex AI; tidak di-hardcode di kode |
| `CLOUD_SQL_CONNECTION_NAME` | nama koneksi instance Cloud SQL, format `PROJECT:REGION:INSTANCE` |
| `DB_NAME` | nama database |
| `DB_USER` | user database |
| `DB_PASSWORD` | password user database; di Cloud Run diambil dari Secret Manager |
| `GCS_BUCKET` | nama bucket Cloud Storage untuk foto bukti; wajib saat `STORAGE_DRIVER=gcs` |
| `GOOGLE_APPLICATION_CREDENTIALS` | path file kunci service account; kosongkan kalau memakai ADC atau berjalan di Cloud Run |
| `DATABASE_URL` | string koneksi Postgres. **Seluruh jalur tulis membaca ini**, bukan `DB_NAME`/`DB_USER`/`DB_PASSWORD` |
| `SESSION_SECRET` | kunci penandatangan cookie sesi anonim, **minimal 32 karakter** |
| `STORAGE_DRIVER` | `local` (bawaan) atau `gcs` |
| `STORAGE_LOCAL_ROOT` | direktori penyimpanan saat `STORAGE_DRIVER=local`; bawaan `.storage` |

`.env` dan semua turunannya diabaikan git. Hanya `.env.example` yang di-commit.

#### Dua variabel yang tidak punya nilai bawaan

Keduanya akan mematikan fitur, bukan menurunkan kualitasnya, jadi periksa dua kali
sebelum menyerahkan `.env` ke panitia.

- **`SESSION_SECRET` wajib diisi, minimal 32 karakter.** Kalau kosong atau lebih
  pendek, `lib/trust/session.ts` melempar galat, endpoint sesi (E7) mati, dan
  seluruh alur kontribusi berkamera ikut mati karena tidak ada sesi yang bisa
  dipakai meminta token penangkapan. Bangkitkan dengan:

  ```bash
  openssl rand -base64 48
  ```

- **`DATABASE_URL` wajib diisi.** Peran koneksinya harus **bukan superuser**:
  penegakan append-only pada `audit_event`, `provenance_check`, dan `observation`
  bersandar pada Row Level Security, dan RLS tidak berlaku untuk superuser maupun
  peran ber-`BYPASSRLS`. Pakai `app_rw` yang dibuat `scripts/setup_db.sh --init-role`.

## How to build/run

Semua perintah dijalankan dari root repo memakai bash (di Windows: Git Bash).

### Mode pengembangan

```bash
npm ci
npm run build                # WAJIB sekali, lihat catatan di bawah
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

Buka http://localhost:3000.

**`npm run build` wajib dijalankan setidaknya sekali setelah `npm ci`,** bahkan
kalau yang dituju cuma mode pengembangan. Next.js membangkitkan tipe rute
(`PageProps`, `LayoutProps`) ke `.next/types/`, dan `tsconfig.json` memasukkan
direktori itu. Di clone yang bersih direktori itu belum ada, sehingga
`npx tsc --noEmit` gagal dengan belasan galat `Cannot find name 'PageProps'`
yang terlihat seperti kode rusak padahal cuma tipe yang belum dibangkitkan.
`npm run dev` juga membangkitkannya, tapi baru setelah server menyala.

Akses ke Vertex AI, Cloud Storage, dan Cloud SQL dari lokal memakai Application
Default Credentials (ADC), jadi tidak perlu file kunci JSON. Login sekali:

```bash
gcloud auth application-default login
```

### Database dan tes

Aplikasi terhubung ke Cloud SQL lewat library Cloud SQL Connector dengan ADC tadi,
jadi tidak perlu Cloud SQL Auth Proxy. Akun Google-mu butuh peran Cloud SQL Client
di project, dan `DB_PASSWORD` di `.env.local` harus terisi.

Skema database ditulis sebagai berkas SQL di `db/migrations/` dengan nama
`YYYYMMDDHHMM_deskripsi.sql`, supaya urutannya tidak bentrok antar-branch. Terapkan
migrasi yang belum dijalankan:

```bash
npm run db:migrate
```

Tes unit memakai Vitest:

```bash
npm test
```

### Build produksi

```bash
npm run lint
npm run build
```

Build menghasilkan server mandiri (`output: "standalone"`) di `.next/standalone/`.
Untuk menjalankannya tanpa Docker, salin aset statis ke sana, lalu jalankan
`server.js`. Env dibaca dari shell.

```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
set -a && . ./.env.local && set +a
PORT=3000 node .next/standalone/server.js
```

Buka http://localhost:3000.

### Docker

Image ini sama dengan yang dijalankan Cloud Run:

```bash
docker build -t astara .
docker run --rm -p 8080:8080 --env-file .env.local astara
```

Buka http://localhost:8080. Container membaca port dari env `PORT` (bawaan `8080`)
dan berjalan sebagai user non-root.

### Uji penolakan (pytest)

Himpunan uji penolakan menembak API lewat HTTP dari luar proses, jadi butuh
server yang hidup dan basis data yang sudah dimigrasi serta di-seed.

```bash
./scripts/setup_db.sh                        # migrasi + data benih demo

python3 -m venv .venv && . .venv/bin/activate
pip install -r tests/rejection/requirements.txt

TRUST_BASE_URL=http://localhost:3000 pytest tests/rejection -v
```

Seluruh uji menembak tempat latihan terpisah (`Gedung Latihan Uji Penolakan`),
supaya jejak audit empat tempat demo tidak kotor oleh percobaan yang gagal.

#### Arahkan ke `next dev` atau ke deployment HTTPS — jangan ke `next start` di http

`next start` memaksa `NODE_ENV=production`, dan pada mode itu cookie sesi
kontributor dikirim dengan flag `Secure`. Lewat `http://` cookie ber-flag `Secure`
disimpan klien tapi tidak pernah dikirim balik, sehingga endpoint sesi (E7)
berhasil tetapi setiap permintaan sesudahnya membalas `SESSION_REQUIRED` dan
**seluruh** uji gagal.

Itu perilaku cookie yang benar, bukan bug. Yang salah adalah menjalankan produksi
di atas http. Dua sasaran yang sah:

| Sasaran | Perintah | Kenapa jalan |
|---|---|---|
| `next dev` lokal | `npm run dev` lalu `TRUST_BASE_URL=http://localhost:3000` | `NODE_ENV=development`, cookie tanpa flag `Secure` |
| Deployment Cloud Run | `TRUST_BASE_URL=https://<url-cloud-run>` | HTTPS, jadi cookie `Secure` terkirim normal |

### Kalibrasi ambang pHash

Ambang duplikat **harus diputuskan dari hash yang dihitung server**, bukan dari
angka yang muncul di peramban. Keduanya berbeda karena dua hal: basis median
(`app/uji-kamera/phash.ts` menyertakan koefisien DC, `lib/trust/image.ts`
membuangnya) dan cara mengecilkan gambar (canvas vs `sharp`). Selisihnya terukur
satu bit pada 200 dari 200 citra yang sama — cukup untuk membalik verdict di
batas 2 dan 6.

Skrip di bawah memanggil modul pHash yang persis sama dengan yang dijalankan C8:

```bash
npm run phash:kalibrasi -- --sama pintuA-orang1.jpg pintuA-orang2.jpg \
                          --beda pintuB.jpg pintuC.jpg
```

`--sama` adalah foto pintu yang sama oleh orang berbeda; semua pasangannya harus
masuk pita penguatan. `--beda` adalah foto pintu berbeda; tidak satu pun boleh
dianggap cocok. Keluarannya menyebut jarak terjauh pada kelompok pertama, jarak
terdekat pada kelompok kedua, dan rentang ambang yang memisahkan keduanya.

Kalau celahnya sempit, sebut apa adanya sebagai batasan. Memilih satu angka di
celah yang tidak memisahkan apa pun bukan kalibrasi.

#### Kalau batas laju menyala saat latihan demo

Satu sesi hanya boleh sepuluh kontribusi per jam, dan kontribusi yang ditolak
ikut dihitung — jadi batas itu bisa menyala di tengah latihan. Jalan keluarnya
satu, dan bukan membuka sesi anonim baru:

```bash
curl -X POST -b cookie.txt -H "x-demo-reset-token: $DEMO_RESET_TOKEN" \
  http://localhost:3000/api/contributions/reset-rate-limit
```

Rute ini **membalas 404 selama `DEMO_RESET_TOKEN` kosong**, termasuk di
deployment. Itu disengaja: endpoint reset yang terbuka membuat pembatas laju
kehilangan artinya. Isi env-nya hanya selama latihan, lalu kosongkan lagi.

Resetnya tidak menghapus apa pun. Satu `audit_event` bertindakan
`rate_limit_reset` ditulis beserta jumlah kontribusi sebelum reset, dan
pemeriksaan C1 menghitung sejak reset terakhir itu. Jejaknya permanen dan
terbaca publik di layar jejak audit — itu memang maksudnya.

#### Mengulang satu jalan uji yang gagal

Tabel `evidence` bersifat append-only dan memang tidak boleh dibersihkan, jadi
foto dari jalan uji sebelumnya tetap tersimpan selamanya dan akan ditolak C8
sebagai duplikat kalau dikirim ulang. Karena itu citra ujinya dibangkitkan dengan
garam per jalan. Untuk mengulang satu jalan persis seperti sebelumnya, set
garamnya — nilainya dicetak di kepala keluaran pytest:

```bash
TRUST_RUN_SALT=1758170000000000000 pytest tests/rejection -v
```

## How to deploy

Aplikasi berjalan di Cloud Run sebagai layanan `ifest`. Cloud Build membangun image
dari `Dockerfile` dan menyimpannya di repository Artifact Registry `ifest`. Layanan
memakai service account Compute Engine bawaan project, jadi tidak ada file kunci
JSON. Semua perintah dijalankan dari root repo memakai bash.

**1. Muat konfigurasi**

```bash
set -a && . ./.env.local && set +a
gcloud auth login
gcloud config set project "$GCP_PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/ifest/ifest"
```

**2. Simpan rahasia di Secret Manager** (sekali per project)

Dua rahasia wajib ada sebelum deploy pertama. Keduanya tidak lewat file dan tidak
tercetak di layar:

- `db-password`: password `DB_USER`. `DB_USER` harus peran aplikasi (`app_rw`),
  bukan superuser, karena penegakan append-only jejak audit bersandar pada RLS.
- `session-secret`: kunci penandatangan cookie sesi anonim, minimal 32 karakter.
  Tanpa ini E7 melempar galat di request pertama dan seluruh alur kontribusi mati.

```bash
read -rsp "DB password: " P && printf '%s' "$P" | gcloud secrets create db-password --data-file=- && unset P
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create session-secret --data-file=-
for s in db-password session-secret; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
done
```

**3. Build dan deploy** (ulangi setiap kali rilis)

```bash
gcloud builds submit --tag "$IMAGE"
gcloud run deploy ifest \
  --image "$IMAGE" \
  --region "$GCP_REGION" \
  --service-account "$SA" \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GCP_REGION=$GCP_REGION,VERTEX_LOCATION=$VERTEX_LOCATION,VERTEX_MODEL=$VERTEX_MODEL,CLOUD_SQL_CONNECTION_NAME=$CLOUD_SQL_CONNECTION_NAME,DB_NAME=$DB_NAME,DB_USER=$DB_USER,STORAGE_DRIVER=gcs,GCS_BUCKET=$GCS_BUCKET" \
  --set-secrets "DB_PASSWORD=db-password:latest,SESSION_SECRET=session-secret:latest"
```

`STORAGE_DRIVER=gcs` wajib. Nilai bawaannya `local`, yang di Cloud Run menulis foto
bukti ke disk container dan hilang begitu container berhenti. `DATABASE_URL`
sengaja tidak dikirim: tanpa variabel itu seluruh aplikasi memakai satu pool lewat
Cloud SQL Connector.

Deploy pertama membuat layanan `ifest`. Setelah selesai, `gcloud` menampilkan URL
HTTPS layanan.

### Menyiapkan project baru

Di project tim, langkah ini sudah dikerjakan. Untuk project lain, jalankan setelah
langkah 1 dan sebelum langkah 2:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com \
  sqladmin.googleapis.com storage.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create ifest \
  --repository-format=docker --location "$GCP_REGION"

# Akses service account bawaan ke Vertex AI, Cloud SQL, dan bucket
for role in roles/aiplatform.user roles/cloudsql.client; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member "serviceAccount:$SA" --role "$role"
done
gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member "serviceAccount:$SA" --role roles/storage.objectAdmin
```

Kalau `gcloud builds submit` ditolak karena izin, beri service account yang sama
peran `roles/cloudbuild.builds.builder`.

Catatan:

- `PORT` diisi otomatis oleh Cloud Run. Jangan dimasukkan ke `--set-env-vars`.
- File `.env*` tidak ikut ter-upload ke Cloud Build dan tidak masuk image
  (`.gitignore` dan `.dockerignore`), jadi nilai env di Cloud Run hanya berasal dari
  flag di atas.
- Variabel `NEXT_PUBLIC_*`, kalau nanti ada, dibaca saat build, bukan saat runtime,
  sehingga harus tersedia di tahap build image.
