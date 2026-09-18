/**
 * Ilustrasi profil kebutuhan. Dekoratif: selalu `aria-hidden` dan selalu
 * berdampingan dengan nama profil yang tertulis. Hanya warna palet 1, 4, 5,
 * 6, dan putih, jadi mengikuti setiap perubahan token di globals.css.
 */

import type { ProfileCode } from "./api/types";

const P1 = "var(--color-p1)";
const P2 = "var(--color-p2)";
const P4 = "var(--color-p4)";
const P6 = "var(--color-p6)";
const PUTIH = "#ffffff";

function Bingkai({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" focusable="false" className={className}>
      <rect x="0" y="0" width="160" height="120" rx="16" fill={P4} />
      <circle cx="118" cy="30" r="34" fill={P6} />
      <rect x="0" y="100" width="160" height="20" fill={P6} opacity="0.55" />
      <path d="M0 100h160" stroke={P2} strokeWidth="2" />
      {children}
    </svg>
  );
}

/** Pengguna kursi roda manual di depan pintu tanpa tangga. */
export function IlustrasiKursiRoda({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      {/* pintu */}
      <rect x="112" y="46" width="30" height="54" rx="3" fill={PUTIH} stroke={P1} strokeWidth="3" />
      <circle cx="136" cy="74" r="2.5" fill={P1} />
      {/* kursi roda */}
      <circle cx="64" cy="82" r="17" fill={PUTIH} stroke={P1} strokeWidth="4" />
      <circle cx="64" cy="82" r="3" fill={P1} />
      <circle cx="92" cy="94" r="5" fill={PUTIH} stroke={P1} strokeWidth="3" />
      <path d="M50 52v26h36l6 16" fill="none" stroke={P1} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* orang */}
      <circle cx="60" cy="28" r="8" fill={P1} />
      <path d="M58 38c-3 8-3 16 0 26h20l2 16" fill="none" stroke={P1} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 46l14 8" stroke={P1} strokeWidth="6" strokeLinecap="round" />
    </Bingkai>
  );
}

/** Pengguna walker (alat bantu jalan) berjalan menuju pintu. */
export function IlustrasiAlatBantuJalan({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <rect x="112" y="46" width="30" height="54" rx="3" fill={PUTIH} stroke={P1} strokeWidth="3" />
      <circle cx="136" cy="74" r="2.5" fill={P1} />
      {/* walker */}
      <path d="M70 56h22M72 56l-4 42M90 56l4 42M70 76h22" fill="none" stroke={P1} strokeWidth="4" strokeLinecap="round" />
      <circle cx="68" cy="98" r="3" fill={P1} />
      <circle cx="94" cy="98" r="3" fill={P1} />
      {/* orang */}
      <circle cx="54" cy="24" r="8" fill={P1} />
      <path d="M54 34l2 30" stroke={P1} strokeWidth="9" strokeLinecap="round" />
      <path d="M55 42l16 14" stroke={P1} strokeWidth="6" strokeLinecap="round" />
      <path d="M56 62l-8 36M56 62l10 34" fill="none" stroke={P1} strokeWidth="6" strokeLinecap="round" />
    </Bingkai>
  );
}

/** Pengguna tongkat putih mengikuti jalur pemandu. */
export function IlustrasiNetra({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <rect x="112" y="46" width="30" height="54" rx="3" fill={PUTIH} stroke={P1} strokeWidth="3" />
      <circle cx="136" cy="74" r="2.5" fill={P1} />
      {/* jalur pemandu */}
      {[20, 34, 48, 62, 76, 90, 104].map((x) => (
        <g key={x}>
          <circle cx={x} cy="106" r="2" fill={P1} opacity="0.55" />
          <circle cx={x + 7} cy="112" r="2" fill={P1} opacity="0.55" />
        </g>
      ))}
      {/* orang */}
      <circle cx="46" cy="24" r="8" fill={P1} />
      <rect x="40" y="22" width="12" height="4" rx="2" fill={PUTIH} />
      <path d="M46 34v30" stroke={P1} strokeWidth="9" strokeLinecap="round" />
      <path d="M46 64l-8 34M46 64l10 34" fill="none" stroke={P1} strokeWidth="6" strokeLinecap="round" />
      <path d="M47 42l16 12" stroke={P1} strokeWidth="6" strokeLinecap="round" />
      {/* tongkat putih bergaris */}
      <path d="M63 54l30 46" stroke={P1} strokeWidth="6" strokeLinecap="round" />
      <path d="M63 54l30 46" stroke={PUTIH} strokeWidth="3" strokeLinecap="round" />
    </Bingkai>
  );
}

export const ILUSTRASI_PROFIL: Record<ProfileCode, (p: { className?: string }) => React.ReactElement> = {
  kursi_roda_manual: IlustrasiKursiRoda,
  alat_bantu_jalan: IlustrasiAlatBantuJalan,
  netra: IlustrasiNetra,
};
