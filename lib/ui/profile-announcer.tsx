"use client";

import { useEffect, useRef } from "react";
import { useAnnounce } from "./announcer";

/**
 * Mengumumkan hasil pergantian profil setelah data baru tampil. Tidak
 * mengumumkan apa pun saat halaman pertama dibuka — hanya saat profil berubah.
 */
export function ProfileAnnouncer({ profile, message }: { profile: string; message: string }) {
  const announce = useAnnounce();
  const previous = useRef(profile);
  useEffect(() => {
    if (previous.current === profile) return;
    previous.current = profile;
    announce(message);
  }, [profile, message, announce]);
  return null;
}
