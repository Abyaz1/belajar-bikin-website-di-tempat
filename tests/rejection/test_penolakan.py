"""
Empat kelas uji penolakan (docs/10-trust.md §5), plus dua pagar aturan.

Kelas 2 sengaja MENGHARAPKAN sistem gagal menangkap. Itu tes yang jujur, dan
angkanya dilaporkan apa adanya di deck. Tim yang menyebut angka rendah dengan
metode jelas lebih kuat daripada tim yang menyebut angka tinggi tanpa metode.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import (
    AKURASI_MAKS_M,
    MEASURED_WAJIB,
    RATE_LIMIT,
    SKEW_BELAKANG_S,
    SKEW_DEPAN_S,
    UJI_LAT,
    UJI_LON,
    UMUR_FIX_MAKS_S,
    BATAS_GAGAL_M,
    Kontributor,
    geser_meter,
    hamming_terlapor,
    jpeg_bersih,
    jpeg_galeri,
    oracle_c8,
    pasangan_hamming,
    pasangan_penguatan,
)


def SEKARANG() -> datetime:
    return datetime.now(timezone.utc)


# ==========================================================================
# KELAS 1 — Unggahan galeri ber-EXIF
# Akan ditolak 100 persen menurut konstruksi. Angka ini tidak berarti sendirian.
# ==========================================================================
class TestKelas1UnggahanGaleri:

    @pytest.mark.parametrize(
        "gps,tag_lain,nama",
        [
            (True, True, "EXIF lengkap dengan GPS"),
            (True, False, "hanya blok GPS"),
            (False, True, "EXIF tanpa GPS"),
        ],
    )
    def test_ditolak_karena_metadata(self, kontributor: Kontributor, gps, tag_lain, nama):
        b = kontributor.kirim(jpeg_galeri(seed=hash(nama) % 9999, gps=gps, tag_lain=tag_lain))
        assert b.status == 422, f"{nama}: {b.body}"
        assert "FILE_METADATA_PRESENT" in b.kode_galat, nama

    def test_capture_method_palsu_tidak_menolong(self, kontributor: Kontributor):
        """capture_method dikirim klien dan BUKAN gerbang. Menulis 'getusermedia'
        pada berkas galeri tidak mengubah apa pun — yang menolak adalah C3."""
        b = kontributor.kirim(jpeg_galeri(seed=11), capture_method="getusermedia")
        assert b.status == 422
        assert "FILE_METADATA_PRESENT" in b.kode_galat

    def test_capture_method_jujur_juga_tidak_menolak(self, kontributor: Kontributor):
        """Kebalikannya: mengaku 'galeri' pada berkas bersih TIDAK ditolak.
        Kalau tes ini gagal, berarti ada yang menjadikan capture_method gerbang."""
        b = kontributor.kirim(jpeg_bersih(seed=12), capture_method="galeri")
        assert "FILE_METADATA_PRESENT" not in b.kode_galat

    def test_bukan_jpeg_ditolak_400_bukan_422(self, kontributor: Kontributor):
        """Bentuk permintaan yang cacat bukan kontribusi yang ditolak."""
        b = kontributor.kirim(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
        assert b.status == 400
        assert b.kode_galat == ["FILE_TYPE_INVALID"]

    def test_penolakan_tetap_masuk_jejak_audit(self, kontributor: Kontributor):
        """Aturan 4. Dicek lewat C1: kontribusi yang ditolak tetap dihitung,
        yang hanya mungkin kalau barisnya benar-benar ditulis."""
        kontributor.kirim(jpeg_galeri(seed=13))
        b = kontributor.kirim(jpeg_galeri(seed=14))
        c1 = b.cek("C1") or {}
        terpakai = int((c1.get("measured") or "0").split()[0]) if c1 else None
        if terpakai is not None:
            assert terpakai >= 1, "kontribusi yang ditolak tidak ikut terhitung di C1"


# ==========================================================================
# KELAS 2 — Unggahan bersih tanpa EXIF lewat API langsung
# INI YANG JUJUR. Laporkan apa adanya meski buruk.
# ==========================================================================
class TestKelas2UnggahanBersihLangsung:

    @pytest.mark.batasan
    def test_jpeg_re_encode_lolos_pemeriksaan_metadata(self, kontributor: Kontributor):
        """
        BATASAN YANG DIDOKUMENTASIKAN, BUKAN BUG.

        Penyerang tidak perlu membobol HP. Cukup me-re-encode foto galeri
        sehingga EXIF-nya hilang, lalu memanggil API langsung. C3 tidak
        menangkapnya, dan memang tidak dirancang untuk itu.

        Yang tersisa sebagai penahan: C0 (token dari sesi yang dimulai server,
        terikat tempat sebelum foto diambil, sekali pakai) plus C4, C6b, C7
        yang harus konsisten satu sama lain. Itu menaikkan biaya, bukan
        menutup celah. Tes ini ADA supaya kalimat itu punya bukti.
        """
        b = kontributor.kirim(jpeg_bersih(seed=21))
        c3 = b.cek("C3")
        assert c3 is not None, f"C3 tidak dilaporkan: {b.body}"
        assert c3["result"] == "pass", (
            "C3 menolak berkas bersih — berarti aturannya berubah, "
            "dan klaim di deck soal batasan ini perlu ditulis ulang"
        )
        print(f"\n[BATASAN TERUKUR] unggahan bersih lewat API langsung: C3 = {c3['result']}")

    @pytest.mark.batasan
    def test_koordinat_dinyatakan_klien_bisa_dikarang(self, kontributor: Kontributor):
        """Koordinat, akurasi, dan timestamp semuanya dinyatakan klien.
        Mengirim koordinat tepat di titik tempat akan lolos C7, tanpa ada
        yang pernah datang ke sana."""
        b = kontributor.kirim(jpeg_bersih(seed=22), lat=UJI_LAT, lon=UJI_LON, akurasi=5.0)
        c7 = b.cek("C7")
        assert c7 is not None and c7["result"] == "pass"
        print(f"\n[BATASAN TERUKUR] koordinat karangan lolos C7: measured={c7['measured']}")


# ==========================================================================
# KELAS 3 — Foto lokasi lain / di luar radius
# ==========================================================================
class TestKelas3LokasiLuarRadius:

    @pytest.mark.parametrize(
        "jarak_m,akurasi_m,harapan",
        [
            (0,    10.0, "pass"),   # tepat di titik
            (50,   10.0, "pass"),   # radius efektif 85
            (84,   10.0, "pass"),   # tepat di bawah radius efektif
            (100,  10.0, "flag"),   # antara radius efektif dan batas gagal
            (119,  10.0, "flag"),
            (130,  10.0, "fail"),
            (200,  10.0, "fail"),
            (119, 100.0, "pass"),   # penjepit min(175,120) -> 120, jadi pass
            (121, 100.0, "fail"),   # penjepit itulah yang bikin ini fail
            (95,   45.0, "pass"),   # radius efektif tepat 120
        ],
    )
    def test_jarak_bertingkat(self, kontributor: Kontributor, jarak_m, akurasi_m, harapan):
        lat, lon = geser_meter(UJI_LAT, UJI_LON, utara_m=jarak_m, timur_m=0)
        # Seed WAJIB unik per pasangan (jarak, akurasi): dua kasus memakai jarak
        # 119 m, dan seed yang sama akan menghasilkan citra identik sehingga C8
        # menolaknya sebagai duplikat -- benar menurut sistem, salah menurut niat tes.
        seed = 3000 + jarak_m * 1000 + int(akurasi_m)
        b = kontributor.kirim(jpeg_bersih(seed=seed), lat=lat, lon=lon, akurasi=akurasi_m)

        if harapan == "fail":
            assert b.status == 422, b.body
            e = b.galat("GEO_TOO_FAR")
            assert e is not None, f"jarak {jarak_m} m tidak ditolak: {b.body}"
            assert e["threshold"] == f"{BATAS_GAGAL_M} m"
        else:
            assert b.status == 200, b.body
            c7 = b.cek("C7")
            assert c7 is not None and c7["result"] == harapan, (
                f"jarak {jarak_m} m akurasi {akurasi_m} m: "
                f"dapat {c7['result'] if c7 else None}, harap {harapan}"
            )

    def test_penjepit_radius_efektif_tidak_pernah_lewat_batas_gagal(self, kontributor: Kontributor):
        """Tanpa min(..., 120), akurasi 150 m akan bikin radius efektif 225 m
        dan dua aturan saling bertabrakan."""
        lat, lon = geser_meter(UJI_LAT, UJI_LON, utara_m=160, timur_m=0)
        b = kontributor.kirim(jpeg_bersih(seed=3900), lat=lat, lon=lon, akurasi=AKURASI_MAKS_M)
        assert b.status == 422
        assert "GEO_TOO_FAR" in b.kode_galat

    def test_koordinat_kosong(self, kontributor: Kontributor):
        b = kontributor.kirim(jpeg_bersih(seed=3901), lat=None, lon=None, akurasi=None)
        assert b.status == 422
        assert "GEO_MISSING" in b.kode_galat

    def test_akurasi_terlalu_rendah(self, kontributor: Kontributor):
        b = kontributor.kirim(jpeg_bersih(seed=3902), akurasi=AKURASI_MAKS_M + 1)
        assert b.status == 422
        e = b.galat("GEO_ACCURACY_LOW")
        assert e and e["measured"] and e["threshold"]

    def test_fix_gps_basi(self, kontributor: Kontributor):
        basi = SEKARANG() - timedelta(seconds=UMUR_FIX_MAKS_S + 30)
        b = kontributor.kirim(jpeg_bersih(seed=3903), fix_at=basi)
        assert b.status == 422
        assert "GEO_FIX_STALE" in b.kode_galat


# ==========================================================================
# KELAS 4 — Berkas daur ulang
# ==========================================================================
class TestKelas4BerkasDaurUlang:

    def test_kirim_ulang_berkas_yang_sama(self, kontributor: Kontributor):
        berkas = jpeg_bersih(seed=41)
        pertama = kontributor.kirim(berkas)
        assert pertama.status == 200, pertama.body

        kedua = kontributor.kirim(berkas)
        assert kedua.status == 422, kedua.body
        e = kedua.galat("DUPLICATE_IMAGE")
        assert e is not None
        assert e["measured"] and e["threshold"]

    def test_berkas_dioper_ke_kontributor_lain(
        self, kontributor: Kontributor, kontributor_lain: Kontributor
    ):
        """Hamming <= 2 tetap fail walau kontributornya berbeda: itu berkas
        yang dioper, bukan dua orang memotret pintu yang sama."""
        berkas = jpeg_bersih(seed=42)
        assert kontributor.kirim(berkas).status == 200
        b = kontributor_lain.kirim(berkas)
        assert b.status == 422
        assert "DUPLICATE_IMAGE" in b.kode_galat

    def test_foto_berbeda_tidak_dianggap_duplikat(self, kontributor: Kontributor):
        assert kontributor.kirim(jpeg_bersih(seed=43)).status == 200
        b = kontributor.kirim(jpeg_bersih(seed=44))
        assert b.status == 200, b.body

    @pytest.mark.parametrize("target", [0, 2, 4, 6, 8])
    def test_oracle_menyusuri_batas_keputusan_c8(
        self,
        kontributor: Kontributor,
        kontributor_lain: Kontributor,
        target,
        record_property,
    ):
        """
        Susuri batas keputusan C8, bukan menebak-nebak di sekitarnya.

        Pasangannya dibangun pada jarak Hamming yang ditentukan, lalu
        klasifikasi server dicocokkan dengan matriks docs/10-trust.md §2.2:

            0, 2  -> fail   (identik, ambang <= 2)
            4, 6  -> flag   (penguatan: kontributor beda, tempat+vantage sama)
            8     -> pass   (di luar ambang mirip, bukan kecocokan sama sekali)

        Hanya target genap yang dipakai; alasannya ada di pasangan_hamming().
        """
        dasar, mirip, h_lokal = pasangan_hamming(seed=4500 + target, target=target)
        assert h_lokal == target, (h_lokal, target)
        record_property("hamming", h_lokal)

        assert kontributor.kirim(dasar).status == 200
        b = kontributor_lain.kirim(mirip)

        harap = oracle_c8(target, kontributor_sama=False, tempat_vantage_sama=True)
        record_property("klasifikasi", harap)

        if harap == "fail":
            assert b.status == 422, b.body
            e = b.galat("DUPLICATE_IMAGE")
            assert e is not None, b.body
            assert e["measured"] == f"hamming {target}", e
        else:
            assert b.status == 200, b.body
            c8 = b.cek("C8")
            assert c8 is not None and c8["result"] == harap, c8
            if harap == "flag":
                assert hamming_terlapor(b) == target, b.body

    def test_pita_penguatan_benar_benar_tercapai(
        self, kontributor: Kontributor, kontributor_lain: Kontributor
    ):
        """
        Kasus yang paling menentukan di atas panggung: dua orang BERBEDA
        memotret pintu yang sama harus ditandai sebagai penguatan, bukan
        ditolak sebagai duplikat.

        Pasangannya DICARI, bukan ditebak. Versi sebelumnya menyapu pergeseran
        piksel dan berakhir skip ketika tidak ada yang mendarat di pita 3-6 —
        jujur, tapi artinya kasus terpenting kita kadang tidak teruji sama
        sekali. Sekarang conftest.pasangan_penguatan() menghitung pHash di sisi
        Python dengan algoritma yang sama persis, lalu memilih pasangan yang
        dijamin berada di pita itu. Tidak ada lagi jalur skip di sini.
        """
        dasar, mirip, h_lokal = pasangan_penguatan(seed=46)
        assert 3 <= h_lokal <= 6, h_lokal

        assert kontributor.kirim(dasar).status == 200

        b = kontributor_lain.kirim(mirip)
        assert b.status == 200, b.body

        c8 = b.cek("C8")
        assert c8 is not None and c8["result"] == "flag", c8

        # Pagar tambahan: kalau angka server dan angka Python berbeda, berarti
        # lib/trust/image.ts dan phash_lokal() sudah tidak menghitung hal yang
        # sama lagi. Itu perlu ketahuan di sini, bukan saat demo.
        h_server = hamming_terlapor(b)
        assert h_server == h_lokal, (
            f"server melaporkan hamming {h_server}, Python menghitung {h_lokal}"
        )


# ==========================================================================
# Pagar C0, C1, C4
# ==========================================================================
class TestGerbangSesiDanWaktu:

    def test_token_palsu(self, kontributor: Kontributor):
        b = kontributor.kirim(jpeg_bersih(seed=51), token="x" * 43)
        assert b.status == 422
        assert "CAPTURE_SESSION_INVALID" in b.kode_galat

    def test_token_sekali_pakai(self, kontributor: Kontributor):
        t = kontributor.token()
        assert kontributor.kirim(jpeg_bersih(seed=52), token=t).status == 200
        b = kontributor.kirim(jpeg_bersih(seed=53), token=t)
        assert b.status == 422
        assert "CAPTURE_SESSION_INVALID" in b.kode_galat

    def test_token_dipakai_untuk_vantage_lain(self, kontributor: Kontributor):
        t = kontributor.token(vantage="entrance")
        b = kontributor.kirim(jpeg_bersih(seed=54), vantage="toilet", token=t)
        assert b.status == 422
        assert "CAPTURE_SESSION_INVALID" in b.kode_galat

    @pytest.mark.parametrize("geser_detik", [SKEW_BELAKANG_S + 60, -(SKEW_DEPAN_S + 30)])
    def test_selisih_waktu(self, kontributor: Kontributor, geser_detik):
        waktu = SEKARANG() - timedelta(seconds=geser_detik)
        b = kontributor.kirim(jpeg_bersih(seed=5500 + abs(geser_detik)), captured_at=waktu)
        assert b.status == 422
        e = b.galat("TIMESTAMP_SKEW")
        assert e and e["measured"] and e["threshold"]

    def test_rate_limit_menghitung_yang_ditolak(self, kontributor: Kontributor):
        """Sepuluh kontribusi galeri yang semuanya ditolak tetap menghabiskan
        jendela. Kalau tidak, rate limit tidak menahan percobaan berulang."""
        for i in range(RATE_LIMIT):
            kontributor.kirim(jpeg_galeri(seed=6000 + i))
        b = kontributor.kirim(jpeg_bersih(seed=6999))
        assert b.status == 422
        e = b.galat("RATE_LIMITED")
        assert e is not None, f"jendela tidak habis walau {RATE_LIMIT} ditolak: {b.body}"


# ==========================================================================
# Pagar aturan 5 dan 6 — dua dari enam yang tidak boleh dilanggar kode
# ==========================================================================
class TestPagarAturan:

    def test_aturan_6_setiap_penolakan_membawa_nilai_terukur(self, kontributor: Kontributor):
        lat, lon = geser_meter(UJI_LAT, UJI_LON, utara_m=300, timur_m=0)
        b = kontributor.kirim(
            jpeg_galeri(seed=71),
            lat=lat, lon=lon, akurasi=AKURASI_MAKS_M + 10,
            captured_at=SEKARANG() - timedelta(seconds=SKEW_BELAKANG_S + 120),
        )
        assert b.status == 422
        assert len(b.body["errors"]) >= 2, "pipa berhenti di kegagalan pertama"

        for e in b.body["errors"]:
            assert set(e.keys()) == {"code", "message", "measured", "threshold"}, e
            assert e["message"], e
            if e["code"] in MEASURED_WAJIB:
                assert e["measured"] is not None, e
                assert e["threshold"] is not None, e

    def test_aturan_5_angka_keyakinan_tidak_pernah_keluar(self, kontributor: Kontributor):
        b = kontributor.kirim(jpeg_bersih(seed=72))
        assert b.status == 200
        mentah = repr(b.body).lower()
        for terlarang in ("confidence", "ai_confidence", "keyakinan"):
            assert terlarang not in mentah, f"'{terlarang}' bocor ke payload: {b.body}"

    def test_penilaian_tidak_pernah_ada_di_jalur_tulis(self, kontributor: Kontributor):
        b = kontributor.kirim(jpeg_bersih(seed=73))
        mentah = repr(b.body).lower()
        for terlarang in ("dapat_diakses", "tidak_dapat_diakses", "dengan_catatan", "skor", "score"):
            assert terlarang not in mentah, f"penilaian muncul di jalur tulis: {b.body}"
