"use client";

/**
 * Bilah pengumuman (A3): hasil proses asinkron diumumkan lewat live region.
 *
 * Wilayahnya dipasang SEKALI di root layout dan hidup terus lintas navigasi.
 * Live region yang baru dipasang bersamaan dengan isinya sering tidak dibacakan
 * screen reader; karena itu komponen tidak membuat live region sendiri, tapi
 * memanggil `useAnnounce()`.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Announce = (message: string, urgency?: "polite" | "assertive") => void;

const AnnounceContext = createContext<Announce>(() => {});

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const announce = useCallback<Announce>((message, urgency = "polite") => {
    const set = urgency === "assertive" ? setAssertive : setPolite;
    // Dikosongkan dulu supaya pesan yang sama persis tetap dibacakan ulang.
    set("");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set(message), 60);
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
