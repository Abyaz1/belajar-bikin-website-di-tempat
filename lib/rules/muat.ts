import "server-only";

/**
 * Memuat aturan profil dari tabel. Satu-satunya berkas di lib/rules yang
 * menyentuh basis data — engine.ts tetap murni dan menerima hasilnya sebagai
 * masukan. Dipakai E6, dan nanti E1/E2 sebelum memanggil evaluate().
 */

import { db } from "@/lib/db";
import { SQL_ATURAN, SQL_MINIMUM, rakitAturan, type BarisAturan } from "./profil";
import type { MinimumAttribute, RuleGroup } from "./types";

export async function muatAturan(): Promise<{ rules: RuleGroup[]; minimum: MinimumAttribute[] }> {
  const pool = await db();
  const [aturan, minimum] = await Promise.all([pool.query<BarisAturan>(SQL_ATURAN), pool.query<MinimumAttribute>(SQL_MINIMUM)]);
  return { rules: rakitAturan(aturan.rows), minimum: minimum.rows };
}
