"use client";

// Keadaan "galat jaringan" untuk semua layar: server tidak menjawab atau
// menjawab galat.
// Tidak ada permintaan maaf, tidak ada nada riang — sebutkan yang terjadi dan
// apa yang bisa dilakukan.

import { useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/lib/ui/button";

export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div role="alert" className="space-y-4">
      <h1 ref={heading} tabIndex={-1} className="text-screen">
        Data tidak dapat dimuat
      </h1>
      <p>Server tidak memberi jawaban yang bisa dipakai. Periksa koneksi, lalu coba lagi.</p>
      {error.digest ? <p className="text-meta text-ink-muted">Kode galat: <code className="font-mono">{error.digest}</code></p> : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => retry()}>Coba lagi</Button>
        <ButtonLink href="/" variant="sekunder">
          Ke beranda
        </ButtonLink>
      </div>
    </div>
  );
}
