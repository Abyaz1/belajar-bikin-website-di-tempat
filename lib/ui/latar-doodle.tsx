/**
 * Doodle samar sebagai latar halaman: menempel di layar (fixed) di belakang
 * semua isi, jadi selalu memenuhi ruang kosong di ukuran layar apa pun. Kartu,
 * kepala, dan kaki halaman yang berlatar padat menutupinya. Dekoratif saja.
 * `m-0!` menimpa margin dari `space-y` wadahnya, yang kalau dibiarkan memotong
 * tinggi lapisan ini.
 */
export function LatarDoodle() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 m-0! bg-[url(/doodle-astara.svg)] bg-[length:240px_240px]"
    />
  );
}
