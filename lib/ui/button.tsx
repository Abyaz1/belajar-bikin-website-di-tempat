"use client";

/**
 * Tombol — varian utama / sekunder / teks.
 * Keadaan: diam, hover, fokus, ditekan, nonaktif, memuat.
 *
 * Saat memuat, TEKSNYA berubah jadi kata kerja ("Memeriksa bukti…"), bukan cuma
 * spinner. Tombol yang sedang memuat memakai `aria-disabled`, bukan `disabled`,
 * supaya fokus papan ketik tidak terlempar ke awal halaman.
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "utama" | "sekunder" | "teks";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-body font-semibold " +
  "min-h-11 text-center no-underline cursor-pointer select-none";

const VARIANT: Record<ButtonVariant, string> = {
  utama:
    "bg-action text-surface border-2 border-action hover:bg-ink hover:border-ink active:translate-y-px",
  sekunder:
    "bg-surface text-action border-2 border-action hover:bg-surface-alt active:translate-y-px",
  teks: "bg-transparent text-action border-2 border-transparent underline underline-offset-2 hover:decoration-2",
};

const INERT = "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 disabled:cursor-not-allowed disabled:opacity-60";

/** 48px (3rem) di alur kontribusi, 44px (2.75rem) di tempat lain. */
function size(large?: boolean) {
  return large ? "min-h-12" : "min-h-11";
}

export function Button({
  variant = "utama",
  loading = false,
  loadingText,
  large,
  className,
  children,
  onClick,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Kata kerja yang tampil selama memuat, misalnya "Menyimpan…". */
  loadingText?: string;
  large?: boolean;
}) {
  return (
    <button
      type={type}
      {...rest}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cx(BASE, VARIANT[variant], INERT, size(large), className)}
    >
      {loading ? (loadingText ?? "Memproses…") : children}
    </button>
  );
}

export function ButtonLink({
  variant = "utama",
  large,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <Link {...rest} className={cx(BASE, VARIANT[variant], size(large), className)}>
      {children}
    </Link>
  );
}
