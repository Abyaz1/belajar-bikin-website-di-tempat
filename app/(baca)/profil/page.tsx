import type { Metadata } from "next";
import { getProfiles } from "@/lib/ui/api/server";
import type { RuleCondition } from "@/lib/ui/api/types";
import { PROFILE_TITLE, attributeLabel, valueOption } from "@/lib/ui/copy";

export const metadata: Metadata = { title: "Aturan penilaian" };

// Daftar profil dan aturannya (E6). Aturan disimpan sebagai baris data, bukan
// kode — halaman ini membacakannya apa adanya supaya penilaian bisa diperiksa.

const OP: Record<RuleCondition["operator"], string> = {
  eq: "adalah",
  neq: "bukan",
  gte: "paling sedikit",
  lte: "paling banyak",
  in: "salah satu dari",
  not_in: "bukan salah satu dari",
};

function conditionText(c: RuleCondition): string {
  if (c.subject_type === "place_property") {
    if (c.subject_code === "layanan_di_atas_lantai_dasar")
      return c.value === "true" ? "layanan tempat ini ada di atas lantai dasar" : "layanan tempat ini di lantai dasar";
    return `${c.subject_code} ${OP[c.operator]} ${c.value}`;
  }
  const subject = attributeLabel(c.subject_code).toLowerCase();
  if (c.subject_code === "step_count" && c.operator === "gte") return `${subject} ${c.value} atau lebih`;
  const values = c.value
    .split(",")
    .map((v) => valueOption(c.subject_code, v.trim()).toLowerCase())
    .join(" atau ");
  return `${subject} ${OP[c.operator]} “${values}”`;
}

export default async function Page() {
  const profiles = await getProfiles();

  return (
    <div className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="text-screen">Aturan penilaian</h1>
        <p>
          Penilaian tidak disimpan. Ia dihitung saat Anda bertanya, dengan menerapkan aturan di bawah ke kondisi fisik
          yang sudah diperiksa. Kondisi yang belum diperiksa tidak pernah dianggap memenuhi aturan.
        </p>
        <p>
          Kalau ada kondisi yang menentukan tapi belum diperiksa, hasilnya &ldquo;belum dapat dipastikan&rdquo;, bukan
          &ldquo;dapat diakses&rdquo;. Tempat tanpa bukti tidak pernah dinilai dapat diakses untuk profil mana pun.
        </p>
        <p className="text-meta text-ink-muted">
          Ambang ini disusun dari literatur luar negeri dan belum divalidasi bersama komunitas disabilitas lokal. Profil
          netra dan alat bantu jalan belum punya hambatan mutlak, karena kondisi yang dicatat versi ini condong ke
          mobilitas.
        </p>
      </header>

      {profiles.map((p) => {
        const blockers = p.rule_groups.filter((g) => g.verdict === "blocker");
        const cautions = p.rule_groups.filter((g) => g.verdict === "caution");
        return (
          <section key={p.code} aria-labelledby={`profil-${p.code}`} className="space-y-4 border-t border-line pt-6">
            <h2 id={`profil-${p.code}`} className="text-section">
              {PROFILE_TITLE[p.code] ?? p.label}
            </h2>

            <div className="space-y-1">
              <h3 className="text-card">Harus sudah diperiksa sebelum bisa dinilai</h3>
              <ul className="list-disc space-y-1 ps-6">
                {p.minimum_attributes.map((m) => (
                  <li key={m.attribute_code}>
                    {attributeLabel(m.attribute_code)}
                    {m.required_when_property === "layanan_di_atas_lantai_dasar"
                      ? " (hanya bila layanan tempat ini ada di atas lantai dasar)"
                      : ""}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <h3 className="text-card">Tidak dapat diakses bila</h3>
              {blockers.length === 0 ? (
                <p className="text-ink-muted">Tidak ada aturan hambatan mutlak untuk profil ini di versi ini.</p>
              ) : (
                <ul className="list-disc space-y-1 ps-6">
                  {blockers.map((g) => (
                    <li key={g.id}>
                      {g.conditions.map(conditionText).join(", dan ")}.{" "}
                      <code className="font-mono text-label text-ink-muted">{g.id}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-card">Diberi catatan bila</h3>
              {cautions.length === 0 ? (
                <p className="text-ink-muted">Tidak ada.</p>
              ) : (
                <ul className="list-disc space-y-1 ps-6">
                  {cautions.map((g) => (
                    <li key={g.id}>
                      {g.conditions.map(conditionText).join(", dan ")}.{" "}
                      <code className="font-mono text-label text-ink-muted">{g.id}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
