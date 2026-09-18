import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/ui/brand";

// Sementara: beranda lengkap (L1) menyusul di commit berikutnya.
export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-screen">{PRODUCT_NAME}</h1>
      <p>Antarmuka sedang dibangun.</p>
      <p>
        <Link href="/uji-kamera">Uji kamera dan lokasi</Link> (perkakas tim jam 0)
      </p>
    </div>
  );
}
