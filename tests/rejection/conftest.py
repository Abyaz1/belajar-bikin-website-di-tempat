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


def _grid(seed: int, geser: int = 0, terang: int = 0) -> list[list[int]]:
    """
    Grid 32x32 yang disintesis dari koefisien frekuensi rendah acak.

    Ini versi ketiga, dan dua versi sebelumnya salah dengan cara yang sama:
    entropinya menumpuk di tempat yang tidak dibaca pHash.

      v1 - struktur konstan, hanya derau yang berubah per seed. pHash memperkecil
           citra ke 8x8 sebelum DCT, dan penyusutan itu menghapus derau. Seluruh
           citra uji berjarak Hamming 0-2 satu sama lain.
      v2 - struktur diambil dari seed, tapi dari ruang pilihan yang kecil
           (6x6 ukuran blok, dua gradien). Rata-rata jaraknya sehat (31,4) tapi
           EKORNYA tidak: 0,1 persen pasangan berjarak <= 6. Dengan ratusan baris
           evidence yang menumpuk dan ~45 unggahan per jalan, itu belasan
           tabrakan per jalan, dan tes gagal di tempat yang berpindah-pindah.
      v3 - yang sekarang. Grid dibangun dengan menjumlahkan basis kosinus 8x8
           beramplitudo acak, yaitu persis blok yang dibaca pHash. Bit hash-nya
           jadi nyaris seragam: pada 1770 pasangan, jarak minimumnya 18 dan tidak
           ada satu pun pasangan di bawah 7.

    Citranya dikirim pada 32x32, ukuran kerja pHash itu sendiri, sehingga
    `resize(32,32)` di server menjadi operasi kosong dan perhitungan Python
    identik dengan perhitungan server sampai bit terakhir.

    `geser` dan `terang` membuat pasangan yang mirip tapi tidak identik.
    """
    rng = random.Random(f"{RUN_SALT}:{seed}")
    A = [[rng.gauss(0, 1) for _ in range(_PH_K)] for _ in range(_PH_K)]
    A[0][0] = 0.0                      # DC diatur terpisah lewat `terang`

    # Dipisahkan supaya biayanya 32x32x8, bukan 32x32x64.
    antara = [
        [sum(A[w][u] * _PH_COS[u][x] for u in range(_PH_K)) for x in range(_PH_N)]
        for w in range(_PH_K)
    ]

    grid = []
    for y in range(_PH_N):
        yy = (y + geser) % _PH_N
        baris = []
        for x in range(_PH_N):
            xx = (x + geser) % _PH_N
            v = 128.0 + terang + 3.2 * sum(
                antara[w][xx] * _PH_COS[w][yy] for w in range(_PH_K)
            )
            baris.append(max(0, min(255, int(round(v)))))
        grid.append(baris)
    return grid


def jpeg_bersih(seed: int = 1, geser: int = 0, terang: int = 0) -> bytes:
    """JPEG tanpa EXIF - meniru keluaran canvas.toBlob() dari getUserMedia."""
    return _jpeg_32(_grid(seed, geser, terang))


def jpeg_galeri_diencode_ulang(seed: int = 1) -> bytes:
    """
    Foto galeri yang di-encode ulang sehingga EXIF-nya hilang.

    Ini serangan yang disebut docs/10-trust.md §5 dengan kata-katanya sendiri:
    "curl dengan JPEG hasil re-encode". Penyerang tidak perlu membobol HP, cukup
    membuka foto galeri, menyimpannya ulang, lalu memanggil API langsung.

    Berkasnya lolos C3, dan memang dirancang begitu. Yang diuji kelas 2 bukan
    apakah kita menangkapnya — kita tidak — melainkan apakah kita melaporkannya
    apa adanya.
    """
    galeri = jpeg_galeri(seed)
    im = Image.open(io.BytesIO(galeri))
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=100, subsampling=0)   # EXIF tidak ikut
    return buf.getvalue()


def jpeg_galeri(seed: int = 1, *, gps: bool = True, tag_lain: bool = True) -> bytes:
    """JPEG ber-EXIF - meniru berkas yang dipilih dari galeri HP."""
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
    return _jpeg_32(_grid(seed), exif=exif_bytes)


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


# ==========================================================================
# Pasangan penguatan deterministik untuk C8
#
# Kasus "dua orang memotret pintu yang sama" adalah satu-satunya kotak pada
# matriks §2.2 yang bukan fail, dan justru itu yang terjadi kalau juri ikut
# berkontribusi di atas panggung. Tesnya karena itu tidak boleh berakhir skip.
#
# Menebak pergeseran piksel tidak bisa diandalkan: jarak Hamming hasilnya
# melompat-lompat dan sering berhenti di 0-2. Jadi pasangannya DICARI, bukan
# ditebak — dengan menghitung pHash di sisi Python memakai algoritma yang sama
# persis dengan lib/trust/image.ts.
#
# Satu syarat membuat itu bisa dipercaya: citranya dikirim pada resolusi
# 32x32, ukuran kerja pHash itu sendiri. Dengan begitu `resize(32,32)` di
# server menjadi operasi kosong, dan satu-satunya sumber perbedaan antara
# perhitungan Python dan perhitungan server — kernel resize sharp vs Pillow —
# hilang sama sekali. Sudah diukur: lokal dan server melaporkan angka yang
# identik, dan roundtrip JPEG q100 tidak menggeser satu bit pun.
# ==========================================================================

_PH_N = 32          # ukuran kerja pHash, sama dengan lib/trust/image.ts
_PH_K = 8           # blok frekuensi rendah yang dipakai -> 64 bit
_PH_COS = [
    [math.cos((2 * x + 1) * u * math.pi / (2 * _PH_N)) for x in range(_PH_N)]
    for u in range(_PH_N)
]


def phash_lokal(grid: list[list[int]]) -> str:
    """Cerminan lib/trust/image.ts. Kalau salah satunya diubah, ubah keduanya."""
    rows = [
        [sum(grid[y][x] * _PH_COS[u][x] for x in range(_PH_N)) for u in range(_PH_K)]
        for y in range(_PH_N)
    ]
    blok = [
        [sum(rows[y][u] * _PH_COS[v][y] for y in range(_PH_N)) for u in range(_PH_K)]
        for v in range(_PH_K)
    ]
    datar = [blok[v][u] for v in range(_PH_K) for u in range(_PH_K)]
    urut = sorted(datar[1:])                      # koefisien DC dikeluarkan
    median = (urut[30] + urut[31]) / 2
    return "%016x" % int("".join("1" if c > median else "0" for c in datar), 2)


def hamming_lokal(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def _jpeg_32(grid: list[list[int]], exif: bytes | None = None) -> bytes:
    """JPEG 32x32 tanpa penskalaan, kualitas 100, tanpa subsampling kroma."""
    im = Image.new("L", (_PH_N, _PH_N))
    im.putdata([grid[y][x] for y in range(_PH_N) for x in range(_PH_N)])
    buf = io.BytesIO()
    opsi: dict[str, Any] = {"quality": 100, "subsampling": 0}
    if exif is not None:
        opsi["exif"] = exif
    im.convert("RGB").save(buf, "JPEG", **opsi)
    return buf.getvalue()


def _grid_dari_jpeg(b: bytes) -> list[list[int]]:
    px = list(Image.open(io.BytesIO(b)).convert("L").getdata())
    return [[px[y * _PH_N + x] for x in range(_PH_N)] for y in range(_PH_N)]


# Keluarga usikan: beberapa pola piksel kali beberapa amplitudo. Dicari, bukan
# ditebak, dan pencariannya deterministik untuk satu (RUN_SALT, seed).
_POLA = [(7, 3, 5), (1, 1, 2), (3, 5, 4), (5, 2, 3), (2, 9, 7), (11, 4, 6), (1, 0, 3), (0, 1, 3)]


def pasangan_penguatan(
    seed: int, pita: tuple[int, int] = (3, 6)
) -> tuple[bytes, bytes, int]:
    """
    Kembalikan (dasar, varian, hamming) dengan hamming DIJAMIN di dalam `pita`.

    Melempar RuntimeError kalau tidak ketemu — itu kegagalan yang harus
    terlihat, bukan di-skip.
    """
    lo, hi = pita
    tengah = (lo + hi) // 2
    for percobaan in range(12):
        dasar = _grid(seed + percobaan * 1009)
        h0 = phash_lokal(_grid_dari_jpeg(_jpeg_32(dasar)))
        kandidat: dict[int, list[list[int]]] = {}
        for pa, pb, pm in _POLA:
            for delta in range(1, 160):
                varian = [
                    [
                        max(0, min(255, dasar[y][x] + (delta if (x * pa + y * pb) % pm == 0 else 0)))
                        for x in range(_PH_N)
                    ]
                    for y in range(_PH_N)
                ]
                h = hamming_lokal(h0, phash_lokal(_grid_dari_jpeg(_jpeg_32(varian))))
                if lo <= h <= hi:
                    kandidat.setdefault(h, varian)
                    if h == tengah:      # ambil tengah pita, paling jauh dari kedua batas
                        return _jpeg_32(dasar), _jpeg_32(varian), h
        if kandidat:
            h = min(kandidat, key=lambda k: abs(k - tengah))
            return _jpeg_32(dasar), _jpeg_32(kandidat[h]), h
    raise RuntimeError(
        f"Tidak ada pasangan dengan Hamming di {pita} untuk seed {seed} "
        f"(garam {RUN_SALT}). Keluarga usikan perlu diperluas."
    )


def pasangan_hamming(seed: int, target: int) -> tuple[bytes, bytes, int]:
    """
    Pasangan dengan jarak Hamming tepat `target`.

    CATATAN: hanya target GENAP yang bisa dicapai, dan itu sifat pHash-nya,
    bukan keterbatasan pencarian. Tiap koefisien dibandingkan terhadap MEDIAN
    dari 63 koefisien non-DC, jadi mendorong satu koefisien melewati median ikut
    menggeser mediannya sendiri — satu bit naik selalu ditemani satu bit turun.
    Jarak ganjil karena itu tidak pernah muncul.

    Untuk menguji batas keputusan C8 itu justru cukup: 0 dan 2 di sisi fail,
    4 dan 6 di sisi flag, 8 di sisi tanpa kecocokan.
    """
    return pasangan_penguatan(seed, pita=(target, target))
