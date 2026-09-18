"use client";

/**
 * Tombol "Bacakan": membacakan naskah halaman dengan mesin suara bawaan
 * perangkat (Web Speech API, `speechSynthesis`). Di Chrome Android mesinnya
 * adalah Google Text-to-Speech dengan suara Bahasa Indonesia; di iPhone suara
 * Indonesia bawaan iOS. Tidak ada panggilan server, kunci API, atau biaya, dan
 * teksnya tidak dikirim ke mana pun oleh halaman ini.
 *
 * Ini PELENGKAP pembaca layar, bukan penggantinya. Pengguna netra yang sudah
 * memakai TalkBack atau VoiceOver tetap memakai itu; tombol ini untuk yang tidak
 * memasang pembaca layar, pengguna low vision, atau yang ingin mendengar
 * laporan utuh tanpa menavigasi elemen satu per satu. Bacaan hanya mulai kalau
 * tombol ditekan, supaya tidak bertabrakan dengan pembaca layar.
 *
 * Naskah diputar kalimat per kalimat. "Jeda" menghentikan antrean dan
 * mengingat posisinya; "Lanjutkan" mengulang dari awal kalimat itu. Sengaja
 * tidak memakai speechSynthesis.pause(): di Chrome Android fungsi itu tidak
 * andal dan ucapan panjang terpotong setelah sekitar 15 detik.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/lib/ui/button";

type Keadaan = "diam" | "membaca" | "jeda";

const KECEPATAN = [
  { nilai: 0.8, label: "Lambat" },
  { nilai: 1, label: "Normal" },
  { nilai: 1.25, label: "Cepat" },
] as const;

const tanpaLangganan = () => () => {};

/** Suara Bahasa Indonesia terbaik yang tersedia; Google didahulukan kalau ada. */
function pilihSuara(): SpeechSynthesisVoice | null {
  const indonesia = window.speechSynthesis.getVoices().filter((v) => /^id([-_]|$)/i.test(v.lang));
  return indonesia.find((v) => /google/i.test(v.name)) ?? indonesia.find((v) => v.localService) ?? indonesia[0] ?? null;
}

export function TombolBacakan({ naskah, judul = "Bacakan laporan ini" }: { naskah: string[]; judul?: string }) {
  const didukung = useSyncExternalStore(
    tanpaLangganan,
    () => "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined",
    () => true,
  );
  const [keadaan, setKeadaan] = useState<Keadaan>("diam");
  const [posisi, setPosisi] = useState(0);
  const [kecepatan, setKecepatan] = useState(1);
  const [suara, setSuara] = useState<SpeechSynthesisVoice | null>(null);
  const [suaraDimuat, setSuaraDimuat] = useState(false);
  // Penanda putaran: ucapan dari putaran lama (sudah dibatalkan) tidak boleh
  // memajukan antrean ketika event onend-nya datang terlambat.
  const putaran = useRef(0);

  // Daftar suara di Chrome dimuat asinkron; tunggu event voiceschanged.
  useEffect(() => {
    if (!didukung) return;
    const muat = () => {
      setSuara(pilihSuara());
      if (window.speechSynthesis.getVoices().length > 0) setSuaraDimuat(true);
    };
    muat();
    window.speechSynthesis.addEventListener("voiceschanged", muat);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", muat);
  }, [didukung]);

  const hentikan = useCallback(() => {
    putaran.current++;
    if (didukung) window.speechSynthesis.cancel();
  }, [didukung]);

  // Naskah berganti (misalnya profil diganti): keadaan kembali ke awal saat render,
  // dan bacaan lama dibatalkan di cleanup efek di bawah. Halaman ditinggal juga
  // membatalkan bacaan.
  const [naskahTerakhir, setNaskahTerakhir] = useState(naskah);
  if (naskahTerakhir !== naskah) {
    setNaskahTerakhir(naskah);
    setKeadaan("diam");
    setPosisi(0);
  }
  useEffect(() => hentikan, [naskah, hentikan]);

  const putar = useCallback(
    (mulai: number) => {
      hentikan();
      const id = putaran.current;
      const ucap = (i: number) => {
        if (id !== putaran.current) return;
        if (i >= naskah.length) {
          setKeadaan("diam");
          setPosisi(0);
          return;
        }
        setPosisi(i);
        const u = new SpeechSynthesisUtterance(naskah[i]);
        u.lang = suara?.lang ?? "id-ID";
        if (suara) u.voice = suara;
        u.rate = kecepatan;
        u.onend = () => ucap(i + 1);
        u.onerror = (e) => {
          // "interrupted"/"canceled" adalah akibat Jeda atau Berhenti, bukan galat.
          if (e.error === "interrupted" || e.error === "canceled") return;
          if (id === putaran.current) ucap(i + 1);
        };
        window.speechSynthesis.speak(u);
      };
      setKeadaan("membaca");
      ucap(mulai);
    },
    [naskah, suara, kecepatan, hentikan],
  );

  if (!didukung) {
    return (
      <p className="text-meta text-ink-muted">
        Peramban ini tidak menyediakan pembacaan suara. Pembaca layar perangkat (TalkBack atau VoiceOver) tetap bisa
        membacakan halaman ini.
      </p>
    );
  }

  return (
    <div role="group" aria-label="Pembacaan suara" className="space-y-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        {keadaan === "diam" ? (
          <Button onClick={() => putar(0)}>{judul}</Button>
        ) : keadaan === "membaca" ? (
          <Button
            onClick={() => {
              hentikan();
              setKeadaan("jeda");
            }}
          >
            Jeda
          </Button>
        ) : (
          <Button onClick={() => putar(posisi)}>Lanjutkan</Button>
        )}
        {keadaan !== "diam" ? (
          <Button
            variant="sekunder"
            onClick={() => {
              hentikan();
              setKeadaan("diam");
              setPosisi(0);
            }}
          >
            Berhenti
          </Button>
        ) : null}
        <label className="inline-flex min-h-11 items-center gap-2 text-meta">
          Kecepatan
          <select
            value={kecepatan}
            onChange={(e) => {
              setKecepatan(Number(e.target.value));
              // Kalau sedang membaca, bacaan dijeda; "Lanjutkan" mengulang
              // kalimat itu dengan kecepatan baru.
              if (keadaan === "membaca") setKeadaan("jeda");
              hentikan();
            }}
            className="min-h-11 rounded-md border-2 border-line-control bg-surface px-2"
          >
            {KECEPATAN.map((k) => (
              <option key={k.nilai} value={k.nilai}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {keadaan !== "diam" ? (
        // Tidak dijadikan live region: suaranya sudah terdengar, pembaca layar
        // yang ikut mengumumkan hanya akan bertabrakan.
        <p className="text-meta">
          <span className="text-ink-muted">
            {keadaan === "jeda" ? "Dijeda di" : "Membacakan"} kalimat {posisi + 1} dari {naskah.length}:
          </span>{" "}
          {naskah[posisi]}
        </p>
      ) : null}
      {suaraDimuat && !suara ? (
        <p className="text-meta text-ink-muted">
          Perangkat ini belum punya suara Bahasa Indonesia, jadi lafalnya bisa terdengar asing. Di Android, pasang
          &ldquo;Bahasa Indonesia&rdquo; di Setelan › Aksesibilitas › Output teks ke ucapan.
        </p>
      ) : null}
    </div>
  );
}
