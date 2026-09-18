/**
 * Format tanggal. Zona waktu dikunci ke Asia/Jakarta supaya server (UTC di
 * Vercel) dan peramban menghasilkan teks yang sama — koridornya di Bandung.
 */

const TZ = "Asia/Jakarta";

const DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const DATE_TIME = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Sep 2026" */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? DATE.format(d) : "tanggal tidak diketahui";
}

/** "12 Sep 2026, 10.14 WIB" */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? `${DATE_TIME.format(d)} WIB` : "waktu tidak diketahui";
}

export function formatMeters(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "tidak diketahui";
  if (m >= 1000) return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(m / 1000)} km`;
  return `${Math.round(m)} m`;
}
