"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true setelah hidrasi di peramban, false saat render server. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
