#!/usr/bin/env bash
#
# setup_db.sh — migrasi dan penyemaian basis data jalur tulis.
#
# Dipakai untuk setup lokal maupun Cloud SQL. Satu perintah, urutan yang sama,
# supaya tidak ada langkah yang terlewat waktu capek.
#
#   export DATABASE_URL='postgres://user:pass@localhost:5432/ifest'
#   ./scripts/setup_db.sh                # migrasi + seed
#   ./scripts/setup_db.sh --init-role    # + buat role login app_rw (setup lokal)
#
# Variabel lingkungan:
#   DATABASE_URL             wajib. String koneksi yang dipakai skrip ini.
#   DATABASE_URL_CONTAINER   opsional. Dipakai HANYA pada mode docker, ketika
#                            host dan port dilihat berbeda dari dalam kontainer.
#                            Default: sama dengan DATABASE_URL.
#   PG_CONTAINER             opsional. Nama kontainer Postgres. Default ifest-pg.
#   APP_RW_PASSWORD          wajib bila --init-role dipakai. Tidak ada default,
#                            dan itu disengaja: kata sandi bawaan di skrip
#                            adalah kata sandi yang lupa diganti.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/db/migrations"
SEED_FILE="$REPO_ROOT/db/seed/seed_demo.sql"
PG_CONTAINER="${PG_CONTAINER:-ifest-pg}"

INIT_ROLE=0
USE_DOCKER=0

# ---------------------------------------------------------------------------
# Keluaran
# ---------------------------------------------------------------------------
langkah() { printf '\n==> %s\n' "$*"; }
info()    { printf '    %s\n' "$*"; }
awas()    { printf '    !!  %s\n' "$*" >&2; }
mati()    { printf '\n!!  %s\n\n' "$*" >&2; exit 1; }

bantuan() {
  cat <<'USAGE'
Pemakaian: scripts/setup_db.sh [--init-role]

  --init-role   Buat atau perbarui role login app_rw sebelum migrasi.
                Membutuhkan APP_RW_PASSWORD. Dipakai saat setup lokal;
                di Cloud SQL role biasanya sudah disiapkan lebih dulu.
  -h, --help    Tampilkan bantuan ini.

Urutan yang dijalankan:
  1. Uji koneksi
  2. Periksa apakah peran koneksi seorang superuser
  3. (opsional) Buat role app_rw
  4. db/migrations/00*.sql berurutan, ON_ERROR_STOP=1
  5. db/seed/seed_demo.sql, ON_ERROR_STOP=1
  6. Ringkasan status dan pemeriksaan keterlacakan
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --init-role) INIT_ROLE=1; shift ;;
    -h|--help)   bantuan; exit 0 ;;
    *)           bantuan >&2; mati "Argumen tidak dikenal: $1" ;;
  esac
done

# ---------------------------------------------------------------------------
# Prasyarat
# ---------------------------------------------------------------------------
langkah "Memeriksa prasyarat"

[ -n "${DATABASE_URL:-}" ] || mati \
  "DATABASE_URL belum diisi. Contoh:
    export DATABASE_URL='postgres://ifest:rahasia@localhost:5432/ifest'"

[ -d "$MIGRATIONS_DIR" ] || mati "Direktori migrasi tidak ditemukan: $MIGRATIONS_DIR"
[ -f "$SEED_FILE" ]      || mati "Berkas seed tidak ditemukan: $SEED_FILE"

DB_URL_EFFECTIVE="$DATABASE_URL"

if command -v psql >/dev/null 2>&1; then
  info "psql ditemukan di $(command -v psql)"
  info "Mode: psql lokal"
else
  info "psql tidak ada di PATH, beralih ke kontainer Docker"
  command -v docker >/dev/null 2>&1 \
    || mati "psql tidak ada dan docker juga tidak ada. Pasang salah satunya."
  docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER" \
    || mati "Kontainer '$PG_CONTAINER' tidak sedang berjalan.
    Nyalakan dulu, atau set PG_CONTAINER ke nama yang benar.
    Kontainer yang aktif sekarang:
$(docker ps --format '      - {{.Names}}' || true)"

  USE_DOCKER=1
  DB_URL_EFFECTIVE="${DATABASE_URL_CONTAINER:-$DATABASE_URL}"
  info "Mode: docker exec -i $PG_CONTAINER psql"
  if [ "$DB_URL_EFFECTIVE" = "$DATABASE_URL" ]; then
    info "Memakai DATABASE_URL apa adanya dari dalam kontainer."
    info "Kalau gagal tersambung, set DATABASE_URL_CONTAINER — host dan port"
    info "sering terlihat berbeda dari dalam kontainer dibanding dari host."
  else
    info "Memakai DATABASE_URL_CONTAINER untuk koneksi dari dalam kontainer."
  fi
fi

# ---------------------------------------------------------------------------
# Pembungkus psql. Dalam mode docker berkas dialirkan lewat stdin, karena
# berkasnya ada di host dan tidak terlihat dari dalam kontainer.
# ---------------------------------------------------------------------------
jalankan_berkas() {          # $1 = path, $2 = "senyap" (default) atau "tampil"
  local berkas="$1" mode="${2:-senyap}"
  if [ "$mode" = "senyap" ]; then
    if [ "$USE_DOCKER" -eq 1 ]; then
      docker exec -i "$PG_CONTAINER" psql "$DB_URL_EFFECTIVE" -v ON_ERROR_STOP=1 -q < "$berkas"
    else
      psql "$DB_URL_EFFECTIVE" -v ON_ERROR_STOP=1 -q -f "$berkas"
    fi
  else
    if [ "$USE_DOCKER" -eq 1 ]; then
      docker exec -i "$PG_CONTAINER" psql "$DB_URL_EFFECTIVE" -v ON_ERROR_STOP=1 < "$berkas"
    else
      psql "$DB_URL_EFFECTIVE" -v ON_ERROR_STOP=1 -f "$berkas"
    fi
  fi
}

jalankan_stdin() {           # SQL dibaca dari stdin — kata sandi tidak lewat argv
  if [ "$USE_DOCKER" -eq 1 ]; then
    docker exec -i "$PG_CONTAINER" psql "$DB_URL_EFFECTIVE" -v ON_ERROR_STOP=1 -q
  else
    psql "$DB_URL_EFFECTIVE" -v ON_ERROR_STOP=1 -q
  fi
}

tanya() {                    # satu nilai, tanpa header dan tanpa bingkai
  if [ "$USE_DOCKER" -eq 1 ]; then
    docker exec -i "$PG_CONTAINER" psql "$DB_URL_EFFECTIVE" -tAc "$1"
  else
    psql "$DB_URL_EFFECTIVE" -tAc "$1"
  fi
}

tabel() {                    # keluaran bertabel, untuk ringkasan
  if [ "$USE_DOCKER" -eq 1 ]; then
    docker exec -i "$PG_CONTAINER" psql "$DB_URL_EFFECTIVE" -c "$1"
  else
    psql "$DB_URL_EFFECTIVE" -c "$1"
  fi
}

# ---------------------------------------------------------------------------
# 1. Uji koneksi
# ---------------------------------------------------------------------------
langkah "Menguji koneksi"
tanya 'SELECT 1' >/dev/null || mati "Tidak bisa tersambung ke basis data."
info "Tersambung sebagai : $(tanya 'SELECT current_user')"
info "Basis data         : $(tanya 'SELECT current_database()')"
info "Versi server       : $(tanya 'SHOW server_version')"

# ---------------------------------------------------------------------------
# 2. Peringatan superuser
#
# Ini bukan kerapian. Seluruh penegakan append-only di 001 §10 bersandar pada
# Row Level Security, dan RLS TIDAK BERLAKU untuk superuser maupun peran
# ber-BYPASSRLS. Kalau aplikasi tersambung sebagai superuser, klaim "jejak
# audit tidak bisa diubah" jadi tidak benar, dan itu klaim yang akan kita
# ucapkan di depan juri.
# ---------------------------------------------------------------------------
langkah "Memeriksa hak peran koneksi"
SUPER="$(tanya "SELECT rolsuper FROM pg_roles WHERE rolname = current_user")"
if [ "$SUPER" = "t" ]; then
  awas "Peran koneksi ini SUPERUSER."
  awas "Untuk migrasi dan seeding itu wajar dan memang dibutuhkan."
  awas "Tapi APLIKASI tidak boleh memakai peran ini: RLS tidak berlaku untuk"
  awas "superuser, sehingga seluruh jaminan append-only pada audit_event,"
  awas "provenance_check, dan observation batal. Pakai app_rw untuk aplikasi."
else
  info "Bukan superuser. RLS akan berlaku penuh untuk peran ini."
fi

# ---------------------------------------------------------------------------
# 3. Role app_rw (opsional)
# ---------------------------------------------------------------------------
if [ "$INIT_ROLE" -eq 1 ]; then
  langkah "Menyiapkan role login app_rw"

  [ -n "${APP_RW_PASSWORD:-}" ] || mati \
    "--init-role membutuhkan APP_RW_PASSWORD, dan skrip ini sengaja tidak punya
    nilai bawaan. Kata sandi bawaan adalah kata sandi yang lupa diganti.
      export APP_RW_PASSWORD='...'"

  if [ "${#APP_RW_PASSWORD}" -lt 16 ]; then
    awas "APP_RW_PASSWORD kurang dari 16 karakter. Cukup untuk lokal, jangan dibawa ke Cloud SQL."
  fi

  # Kutip tunggal digandakan supaya aman jadi literal SQL, dan SQL-nya dialirkan
  # lewat stdin — bukan lewat argumen — supaya kata sandinya tidak muncul di
  # daftar proses mesin ini.
  PW_ESCAPED="${APP_RW_PASSWORD//\'/\'\'}"

  ADA_ROLE="$(tanya "SELECT 1 FROM pg_roles WHERE rolname = 'app_rw'")"
  if [ "$ADA_ROLE" = "1" ]; then
    info "Role app_rw sudah ada, kata sandinya diperbarui."
    printf "ALTER ROLE app_rw LOGIN PASSWORD '%s';\n" "$PW_ESCAPED" | jalankan_stdin
  else
    info "Role app_rw dibuat."
    printf "CREATE ROLE app_rw LOGIN PASSWORD '%s';\n" "$PW_ESCAPED" | jalankan_stdin
  fi
  unset PW_ESCAPED

  # Dipaksa eksplisit, bukan diasumsikan dari bawaan Postgres.
  printf '%s\n' \
    'ALTER ROLE app_rw NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;' \
    | jalankan_stdin
  info "app_rw dipaksa NOSUPERUSER dan NOBYPASSRLS — RLS wajib berlaku untuknya."
  info "Hak SELECT/INSERT/UPDATE per kolom diberikan oleh migrasi 001 §11."
else
  info "(--init-role tidak dipakai; migrasi 001 akan membuat app_rw sebagai peran grup NOLOGIN)"
fi

# ---------------------------------------------------------------------------
# 4. Migrasi
# ---------------------------------------------------------------------------
langkah "Menjalankan migrasi"

shopt -s nullglob
MIGRASI=("$MIGRATIONS_DIR"/00*.sql)
shopt -u nullglob

[ "${#MIGRASI[@]}" -gt 0 ] || mati "Tidak ada berkas 00*.sql di $MIGRATIONS_DIR"
info "Ditemukan ${#MIGRASI[@]} berkas migrasi. Urutan glob sudah leksikal, 001 lebih dulu."

for berkas in "${MIGRASI[@]}"; do
  nama="$(basename "$berkas")"
  printf '    -> %-34s ' "$nama"
  if jalankan_berkas "$berkas" senyap; then
    printf 'ok\n'
  else
    printf 'GAGAL\n'
    mati "Migrasi berhenti di $nama. Tidak ada yang dilanjutkan.
    ON_ERROR_STOP=1 aktif, jadi transaksi berkas itu sudah di-rollback."
  fi
done

# ---------------------------------------------------------------------------
# 5. Seeding
# ---------------------------------------------------------------------------
langkah "Menanam data benih demo"
info "Seluruh baris berlabel is_demo_seed = true."
info "Skrip ini idempoten: semua id dipatok dan memakai ON CONFLICT DO NOTHING."
echo

jalankan_berkas "$SEED_FILE" tampil \
  || mati "Seeding gagal. Basis data tidak berubah — seed dibungkus satu transaksi."

# ---------------------------------------------------------------------------
# 6. Ringkasan
# ---------------------------------------------------------------------------
langkah "Ringkasan status atribut (diturunkan saat baca, tidak disimpan)"
tabel "SELECT trust_derive_status(last_verified_at, next_review_at) AS status,
              count(*) AS jumlah
         FROM attribute_state
        GROUP BY 1
        ORDER BY 1;"

langkah "Pemeriksaan keterlacakan"
TANPA_JEJAK="$(tanya "
  SELECT count(*) FROM attribute_state s
   WHERE s.source = 'contribution'
     AND NOT EXISTS (SELECT 1 FROM observation o
                      WHERE o.place_id = s.place_id
                        AND o.attribute_code = s.attribute_code)")"

if [ "$TANPA_JEJAK" = "0" ]; then
  info "Nol atribut terverifikasi tanpa jejak bukti. Ini yang harus selalu nol."
else
  awas "$TANPA_JEJAK atribut bersumber kontribusi TANPA observation."
  awas "Ini cacat, bukan kekurangan. Hentikan pekerjaan lain sampai beres."
  exit 1
fi

info "Bukti tersimpan   : $(tanya 'SELECT count(*) FROM evidence')"
info "Hasil pemeriksaan : $(tanya 'SELECT count(*) FROM provenance_check')"
info "Observasi         : $(tanya 'SELECT count(*) FROM observation')"
info "Peristiwa audit   : $(tanya 'SELECT count(*) FROM audit_event')"

langkah "Selesai"
info "Aplikasi harus tersambung sebagai app_rw, bukan sebagai peran yang dipakai skrip ini."
echo
