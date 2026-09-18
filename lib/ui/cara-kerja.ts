/**
 * Isi "Cara kerja": dipakai bersama oleh panduan kunjungan pertama di beranda
 * dan tab /cara-kerja, supaya kalimatnya tidak bercabang.
 */

export const LANGKAH_CARA_KERJA: { judul: string; isi: string }[] = [
  {
    judul: "Foto diambil di tempat",
    isi: "Kontributor memotret pintu masuk, lift, atau toilet lewat kamera di aplikasi ini, dari depan tempatnya. Tanggal dan jam foto ikut tercatat.",
  },
  {
    judul: "Keaslian foto diperiksa",
    isi: "Server memeriksa lokasi, waktu, asal berkas, dan foto berulang sebelum apa pun disimpan. Kiriman yang tidak lolos ditolak, dan alasannya beserta angkanya tercatat terbuka.",
  },
  {
    judul: "Manusia yang mengonfirmasi",
    isi: "Kontributor memilih sendiri apa yang terlihat di foto. Usulan sistem hanya usulan dan tidak pernah terpilih otomatis.",
  },
  {
    judul: "Dinilai menurut kebutuhan Anda",
    isi: "Anda memilih profil. Fakta yang sama dinilai menurut aturan profil itu, dan kalau buktinya belum ada, kami tulis belum tahu.",
  },
];

/** Cookie penanda panduan sudah dilihat. Satu-satunya yang diingat peramban. */
export const COOKIE_PANDUAN = "astara_panduan";
