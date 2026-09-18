/**
 * Ikon. TIDAK PERNAH berdiri sendiri: selalu berdampingan dengan teks, dan
 * selalu `aria-hidden`. Empat ikon penilaian dibedakan BENTUK LUARNYA —
 * segi delapan berpalang, segitiga seru, lingkaran centang, lingkaran tanya —
 * supaya tetap terbedakan tanpa warna (A7) dan dalam cetak hitam putih.
 */

import type { ReactElement, SVGProps } from "react";
import type { Verdict } from "./api/types";

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      {...props}
    />
  );
}

export function IconOctagonBar() {
  return (
    <Svg>
      <path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z" />
      <path d="M7.5 12h9" strokeWidth={3} />
    </Svg>
  );
}

export function IconTriangleBang() {
  return (
    <Svg>
      <path d="M12 3 22 20.5H2z" />
      <path d="M12 9.5v5" />
      <path d="M12 17.6v.1" strokeWidth={3} />
    </Svg>
  );
}

export function IconCircleCheck() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m7.5 12.5 3 3 6-6.5" />
    </Svg>
  );
}

export function IconCircleQuestion() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.5" />
      <path d="M12 17v.1" strokeWidth={3} />
    </Svg>
  );
}

export const VERDICT_ICON: Record<Verdict, () => ReactElement> = {
  tidak_dapat_diakses: IconOctagonBar,
  dengan_catatan: IconTriangleBang,
  dapat_diakses: IconCircleCheck,
  belum_dapat_dipastikan: IconCircleQuestion,
};

export function IconShield() {
  return (
    <Svg>
      <path d="M12 2.5 4.5 5.5v5.8c0 4.7 3.2 8.6 7.5 10.2 4.3-1.6 7.5-5.5 7.5-10.2V5.5z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Svg>
  );
}

export function IconClock() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5.2l3.3 2" />
    </Svg>
  );
}

export function IconArrowsOpposed() {
  return (
    <Svg>
      <path d="M4 8h15m-4-4 4 4-4 4" />
      <path d="M20 16H5m4-4-4 4 4 4" />
    </Svg>
  );
}

export function IconCheck() {
  return (
    <Svg>
      <path d="m5 12.5 4.5 4.5L19 7" strokeWidth={3} />
    </Svg>
  );
}

export function IconFlag() {
  return (
    <Svg>
      <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
    </Svg>
  );
}
