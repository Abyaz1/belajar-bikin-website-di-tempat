/**
 * Pemilih profil: tiga pil, selalu terlihat di L2/L3/L4.
 *
 * Pilnya tautan biasa (`?profil=...`), jadi berganti profil bekerja tanpa
 * JavaScript. Dengan JavaScript, perubahannya diumumkan lewat live region oleh
 * <ProfileAnnouncer> — pergantian di URL yang sama tidak mengubah judul
 * halaman, jadi pengumuman rute bawaan Next.js tidak membacakannya.
 */

import Link from "next/link";
import { PROFILES, type ProfileCode } from "./api/types";
import { PROFILE_TITLE } from "./copy";
import { cx } from "./cx";
import { IconCheck } from "./icons";

export function ProfilePicker({
  current,
  hrefs,
}: {
  current: ProfileCode | null;
  hrefs: Record<ProfileCode, string>;
}) {
  return (
    <nav aria-label="Profil kebutuhan" className="space-y-2">
      <p className="text-meta font-semibold">Nilai tempat untuk profil:</p>
      <ul className="flex flex-wrap gap-2">
        {PROFILES.map((p) => {
          const active = p === current;
          return (
            <li key={p}>
              <Link
                href={hrefs[p]}
                aria-current={active ? "true" : undefined}
                scroll={false}
                className={cx(
                  "inline-flex min-h-12 items-center gap-2 rounded-pill border-2 px-5 font-semibold no-underline",
                  active
                    ? "border-action bg-action text-surface"
                    : "border-line-control bg-surface text-ink hover:border-brand hover:bg-surface-alt",
                )}
              >
                {active ? <IconCheck /> : null}
                {PROFILE_TITLE[p]}
                {active ? <span className="sr-only"> (dipilih)</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
