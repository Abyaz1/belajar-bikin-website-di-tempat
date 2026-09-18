# Astara

Astara adalah sistem verifikasi atribut aksesibilitas tempat publik. Yang disimpan
adalah fakta fisik yang bisa diamati, bukan penilaian, dan setiap atribut wajib
disertai foto, hasil pemeriksaan keaslian, dan timestamp. Penilaian aksesibilitas
dihitung saat request dengan menerapkan profil kebutuhan pengguna ke fakta tersebut.

Dibuat untuk Hackathon IFEST UNPAD 2026, 18–19 September 2026.

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
Tidak memakai component library; komponen UI ditulis sendiri di `lib/ui/`.

### Google Cloud

- Project dengan billing aktif, dan akun `gcloud` berperan Owner di project itu
  (dibutuhkan untuk memberi izin IAM).
- Layanan yang dipakai: Cloud Run, Cloud Build, Artifact Registry, Vertex AI,
  Cloud SQL, Cloud Storage, dan Secret Manager. Perintah untuk mengaktifkannya ada
  di [How to deploy](#how-to-deploy).
- Instance Cloud SQL beserta database dan user-nya, serta satu bucket Cloud Storage.

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
| `GCS_BUCKET` | nama bucket Cloud Storage untuk foto bukti |

`.env` dan semua turunannya diabaikan git. Hanya `.env.example` yang di-commit.

## How to build/run

Semua perintah dijalankan dari root repo memakai bash (di Windows: Git Bash).

### Mode pengembangan

```bash
npm ci
cp .env.example .env.local   # lalu isi nilainya
npm run dev
```

Buka http://localhost:3000.

Akses ke Vertex AI dan Cloud Storage dari lokal memakai Application Default
Credentials (ADC), jadi tidak perlu file kunci JSON. Login sekali:

```bash
gcloud auth application-default login
```

Untuk Cloud SQL: kalau aplikasi memakai library Cloud SQL Connector, ADC saja
cukup; kalau terhubung lewat socket atau TCP biasa, jalankan Cloud SQL Auth Proxy
di laptop.

### Build produksi

```bash
npm run lint
npm run build
```

Build menghasilkan server mandiri (`output: "standalone"`) di `.next/standalone/`.
Untuk menjalankannya tanpa Docker, salin aset statis ke sana, lalu jalankan
`server.js`. Env dibaca dari shell.

```bash
mkdir -p public
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

**2. Simpan password database di Secret Manager** (sekali per project)

Password diketik tanpa tampil di layar dan langsung dikirim ke Secret Manager, tanpa
lewat file:

```bash
read -rsp "DB password: " P && printf '%s' "$P" | gcloud secrets create db-password --data-file=- && unset P
gcloud secrets add-iam-policy-binding db-password \
  --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
```

**3. Build dan deploy** (ulangi setiap kali rilis)

```bash
gcloud builds submit --tag "$IMAGE"
gcloud run deploy ifest \
  --image "$IMAGE" \
  --region "$GCP_REGION" \
  --service-account "$SA" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CLOUD_SQL_CONNECTION_NAME" \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GCP_REGION=$GCP_REGION,VERTEX_LOCATION=$VERTEX_LOCATION,VERTEX_MODEL=$VERTEX_MODEL,CLOUD_SQL_CONNECTION_NAME=$CLOUD_SQL_CONNECTION_NAME,DB_NAME=$DB_NAME,DB_USER=$DB_USER,GCS_BUCKET=$GCS_BUCKET" \
  --set-secrets "DB_PASSWORD=db-password:latest"
```

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
