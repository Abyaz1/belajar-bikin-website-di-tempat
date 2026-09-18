"use client";

import { useEffect, useState } from "react";

/** Jam yang berdetak, untuk menampilkan umur fix GPS atau sisa masa token. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
