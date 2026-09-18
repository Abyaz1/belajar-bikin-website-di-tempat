"""
Uji penolakan jalur tulis — dijalankan dari luar proses, lewat HTTP.

Dijalankan terhadap tempat latihan terpisah (lihat db/seed/seed_demo.sql §3.5),
supaya jejak audit tempat demo tidak kotor oleh percobaan yang gagal. Ini bukan
kerapian: jejak audit tempat demo akan dibuka di depan juri.

    export TRUST_BASE_URL=https://<deploy>
    pytest tests/rejection -v
"""
from __future__ import annotations

import io
import math
import os
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import piexif
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("TRUST_BASE_URL", "http://localhost:3000").rstrip("/")

# Tempat LATIHAN, bukan tempat demo. Ditanam db/seed/seed_demo.sql §3.5.
UJI_PLACE_ID = os.environ.get(
    "TRUST_UJI_PLACE_ID", "11111111-1111-4111-8111-000000000005"
)
UJI_LAT = float(os.environ.get("TRUST_UJI_LAT", "-6.926000"))
UJI_LON = float(os.environ.get("TRUST_UJI_LON", "107.769000"))

# Nilai kontrak. Sengaja ditulis ulang di sini, TIDAK dibaca dari env yang sama
# dengan server: kalau server dan tes membaca env yang sama, tes akan ikut
# bergeser diam-diam ketika ambangnya diubah, dan tidak ada yang kelihatan.
RADIUS_DASAR_M = 75
BATAS_GAGAL_M = 120
AKURASI_MAKS_M = 150
UMUR_FIX_MAKS_S = 60
SKEW_BELAKANG_S = 180
SKEW_DEPAN_S = 60
RATE_LIMIT = 10
HAMMING_IDENTIK = 2
HAMMING_MIRIP = 6

MEASURED_WAJIB = {
    "GEO_TOO_FAR",
    "TIMESTAMP_SKEW",
    "DUPLICATE_IMAGE",
    "GEO_ACCURACY_LOW",
}


# --------------------------------------------------------------------------
# Pembuat berkas uji
# --------------------------------------------------------------------------
# Garam per jalan uji.
#
# evidence bersifat append-only dan memang TIDAK BOLEH dibersihkan — itu inti
# tesisnya. Konsekuensinya, foto yang dikirim jalan uji sebelumnya tetap ada di
# basis data selamanya, dan mengirim citra dengan seed yang sama pada jalan
# berikutnya akan ditolak C8 sebagai duplikat. Itu perilaku yang benar.
#
# Jadi yang harus berubah adalah citranya, bukan basis datanya. Garam ini
# membuat tiap jalan uji memakai berkas yang belum pernah ada, sementara di
# DALAM satu jalan seed yang sama tetap menghasilkan citra yang sama — yang
# dibutuhkan kelas 4 untuk menguji duplikat dan penguatan.
#
# Set TRUST_RUN_SALT untuk mengulang persis satu jalan uji yang gagal.
RUN_SALT = os.environ.get("TRUST_RUN_SALT") or str(time.time_ns())


def _citra(
    seed: int,
    ukuran: int = 192,
    noise: float = 1.0,
    geser: int = 0,
    terang: int = 0,
) -> Image.Image:
    """
    Citra uji dengan STRUKTUR yang diambil dari seed.

    Versi pertama fungsi ini memakai struktur konstan (`(x//16)*13 + (y//16)*7`)
    dan hanya mengubah derau per seed. Itu keliru, dan kelirunya baru terlihat
    saat suite dijalankan sungguhan: pHash memperkecil citra ke 8x8 sebelum DCT,
    dan penyusutan itu merata-ratakan derau sampai habis. Akibatnya seluruh
    citra uji berjarak Hamming 0-6 satu sama lain, dan C8 menolak citra yang
    dimaksudkan berbeda — bukan karena C8 salah, tapi karena citranya memang
    kembar di mata pHash.

    Yang harus berbeda antar seed adalah strukturnya, karena struktur itulah
    yang bertahan sampai blok frekuensi rendah DCT.

    `geser` dan `terang` dipakai untuk membuat pasangan yang MIRIP tapi tidak
    identik — model dari dua orang memotret pintu yang sama dari sudut dan
    pencahayaan yang sedikit berbeda. Itu kasus yang C8 harus tandai sebagai
    penguatan, bukan tolak.
    """
    rng = random.Random(f"{RUN_SALT}:{seed}")

    blok_x = rng.choice([8, 12, 16, 24, 32, 48])
    blok_y = rng.choice([8, 12, 16, 24, 32, 48])
    ax = rng.randint(-28, 28)
    ay = rng.randint(-28, 28)
    dasar0 = rng.randint(30, 150)
    kotak = [
        (
            rng.randrange(ukuran), rng.randrange(ukuran),
            rng.randint(30, 110), rng.randint(30, 110),
            rng.randint(-75, 75),
        )
        for _ in range(6)
    ]

    # Aliran acak terpisah untuk derau, supaya mengubah `noise` tidak ikut
    # mengubah struktur.
    derau = random.Random(f"{RUN_SALT}:{seed}:derau")

    img = Image.new("RGB", (ukuran, ukuran))
    px = img.load()
    for y in range(ukuran):
        yy = y + geser
        for x in range(ukuran):
            xx = x + geser
            v = dasar0 + (xx // blok_x) * ax + (yy // blok_y) * ay + terang
            for kx, ky, kw, kh, kd in kotak:
                if kx <= xx < kx + kw and ky <= yy < ky + kh:
                    v += kd
            v += derau.randint(-25, 25) * noise
            px[x, y] = (max(0, min(255, int(v))),) * 3
    return img


def jpeg_bersih(
    seed: int = 1, noise: float = 1.0, geser: int = 0, terang: int = 0
) -> bytes:
    """JPEG tanpa EXIF — meniru keluaran canvas.toBlob() dari getUserMedia."""
    buf = io.BytesIO()
    _citra(seed, noise=noise, geser=geser, terang=terang).save(buf, "JPEG", quality=85)
    return buf.getvalue()


def jpeg_galeri(seed: int = 1, *, gps: bool = True, tag_lain: bool = True) -> bytes:
    """JPEG ber-EXIF — meniru berkas yang dipilih dari galeri HP."""
    zeroth: dict[int, Any] = {}
    gps_ifd: dict[int, Any] = {}

    if tag_lain:
        zeroth[piexif.ImageIFD.Make] = b"DemoPhone"
        zeroth[piexif.ImageIFD.Model] = b"Uji Penolakan"
        zeroth[piexif.ImageIFD.Software] = b"Galeri"
    if gps:
        gps_ifd[piexif.GPSIFD.GPSLatitudeRef] = b"S"
        gps_ifd[piexif.GPSIFD.GPSLatitude] = ((6, 1), (55, 1), (34, 1))
        gps_ifd[piexif.GPSIFD.GPSLongitudeRef] = b"E"
        gps_ifd[piexif.GPSIFD.GPSLongitude] = ((107, 1), (46, 1), (8, 1))

    exif_bytes = piexif.dump(
        {"0th": zeroth, "GPS": gps_ifd, "Exif": {}, "1st": {}, "thumbnail": None}
    )
    buf = io.BytesIO()
    _citra(seed).save(buf, "JPEG", quality=85, exif=exif_bytes)
    return buf.getvalue()


# --------------------------------------------------------------------------
# Geometri
# --------------------------------------------------------------------------
def geser_meter(lat: float, lon: float, utara_m: float, timur_m: float) -> tuple[float, float]:
    d_lat = utara_m / 111_320.0
    d_lon = timur_m / (111_320.0 * math.cos(math.radians(lat)))
    return lat + d_lat, lon + d_lon


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------
# Klien
# --------------------------------------------------------------------------
@dataclass
class Balasan:
    status: int
    body: dict

    @property
    def kode_galat(self) -> list[str]:
        return [e["code"] for e in self.body.get("errors", [])]

    def galat(self, code: str) -> dict | None:
        for e in self.body.get("errors", []):
            if e["code"] == code:
                return e
        return None

    def cek(self, code: str) -> dict | None:
        for k in self.body.get("checks", []):
            if k["code"] == code:
                return k
        return None


class Kontributor:
    """Satu sesi anonim. Setiap tes memakai sesi sendiri, karena C1 menghitung
    per kontributor dan tanpa itu suite ini akan menabrak rate limit sendiri."""

    def __init__(self) -> None:
        self.http = requests.Session()
        r = self.http.post(f"{BASE_URL}/api/session", timeout=20)
        r.raise_for_status()
        self.id = r.json()["contributor_id"]
        self.handle = r.json()["display_handle"]

    def token(self, place_id: str = UJI_PLACE_ID, vantage: str = "entrance") -> str:
        r = self.http.post(
            f"{BASE_URL}/api/capture-sessions",
            json={"place_id": place_id, "vantage": vantage},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def kirim(
        self,
        berkas: bytes,
        *,
        place_id: str = UJI_PLACE_ID,
        vantage: str = "entrance",
        lat: float | None = UJI_LAT,
        lon: float | None = UJI_LON,
        akurasi: float | None = 12.0,
        captured_at: datetime | None = None,
        fix_at: datetime | None = None,
        capture_method: str = "getusermedia",
        token: str | None = None,
    ) -> Balasan:
        sekarang = datetime.now(timezone.utc)
        data: dict[str, str] = {
            "capture_token": token if token is not None else self.token(place_id, vantage),
            "place_id": place_id,
            "vantage": vantage,
            "capture_method": capture_method,
            "client_captured_at": iso(captured_at or sekarang - timedelta(seconds=3)),
        }
        if lat is not None and lon is not None:
            data["client_lat"] = f"{lat:.6f}"
            data["client_lon"] = f"{lon:.6f}"
        if akurasi is not None:
            data["client_accuracy_m"] = str(akurasi)
        if fix_at is not None or (lat is not None):
            data["client_fix_at"] = iso(fix_at or sekarang - timedelta(seconds=5))

        r = self.http.post(
            f"{BASE_URL}/api/contributions/draft",
            data=data,
            files={"file": ("tangkapan.jpg", berkas, "image/jpeg")},
            timeout=40,
        )
        try:
            body = r.json()
        except ValueError:
            body = {"_raw": r.text}
        return Balasan(r.status_code, body)


@pytest.fixture
def kontributor() -> Kontributor:
    return Kontributor()


@pytest.fixture
def kontributor_lain() -> Kontributor:
    return Kontributor()


@pytest.fixture(scope="session", autouse=True)
def server_hidup() -> None:
    try:
        requests.get(f"{BASE_URL}/api/profiles", timeout=10)
    except requests.RequestException as e:
        pytest.exit(f"Server tidak bisa dihubungi di {BASE_URL}: {e}", returncode=2)


# --------------------------------------------------------------------------
# Oracle C8 — matriks docs/10-trust.md §2.2
# --------------------------------------------------------------------------
def oracle_c8(hamming: int, *, kontributor_sama: bool, tempat_vantage_sama: bool) -> str:
    if hamming <= HAMMING_IDENTIK:
        return "fail"
    if hamming > HAMMING_MIRIP:
        return "pass"
    if tempat_vantage_sama and not kontributor_sama:
        return "flag"
    return "fail"


def hamming_terlapor(b: Balasan) -> int | None:
    """Ambil jarak Hamming dari balasan, baik 200 (checks) maupun 422 (errors)."""
    sumber = b.cek("C8") or b.galat("DUPLICATE_IMAGE")
    if not sumber or not sumber.get("measured"):
        return None
    teks = sumber["measured"]
    return int(teks.replace("hamming", "").strip()) if "hamming" in teks else None


def pytest_report_header(config) -> str:
    return f"garam jalan uji (TRUST_RUN_SALT untuk mengulang): {RUN_SALT}"
