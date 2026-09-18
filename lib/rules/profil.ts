/**
 * Dari baris tabel ke aturan, dan dari aturan ke respons E6 (docs-20 §6).
 * Murni: query-nya ada di sini sebagai teks, eksekusinya di muat.ts.
 * Dipakai E6 sekarang, dan nanti E1/E2 untuk memberi makan engine.ts.
 */

import { PROFILES, type ProfileInfo } from "@/lib/ui/api/types";
import { ATTRIBUTE_TYPES, PROFILE_LABELS, RULE_MESSAGES } from "./reference";
import type { MinimumAttribute, Operator, ProfileCode, RuleGroup, RuleVerdict } from "./types";

/** Grup beserta kondisinya. LEFT JOIN supaya grup tanpa kondisi tetap terlihat. */
export const SQL_ATURAN = `
  select g.id as group_id, g.profile_code, g.verdict, g.message_id, g.priority,
         c.id as condition_id, c.subject_type, c.subject_code, c.operator, c.value
  from profile_rule_group g
  left join profile_rule_condition c on c.group_id = g.id
  order by g.profile_code, g.priority, g.id, c.id`;

export const SQL_MINIMUM = `
  select profile_code, attribute_code, required_when_property, required_when_value
  from profile_minimum_attribute`;

export interface BarisAturan {
  group_id: string;
  profile_code: ProfileCode;
  verdict: RuleVerdict;
  message_id: string;
  priority: number;
  condition_id: string | null;
  subject_type: "attribute" | "place_property" | null;
  subject_code: string | null;
  operator: Operator | null;
  value: string | null;
}

export function rakitAturan(baris: BarisAturan[]): RuleGroup[] {
  const grup = new Map<string, RuleGroup & { _kondisi: { id: string; c: RuleGroup["conditions"][number] }[] }>();
  for (const b of baris) {
    let g = grup.get(b.group_id);
    if (!g) {
      g = {
        id: b.group_id,
        profile_code: b.profile_code,
        verdict: b.verdict,
        message_id: b.message_id,
        priority: Number(b.priority),
        conditions: [],
        _kondisi: [],
      };
      grup.set(b.group_id, g);
    }
    if (b.condition_id !== null && b.subject_type && b.subject_code && b.operator && b.value !== null) {
      g._kondisi.push({
        id: b.condition_id,
        c: { subject_type: b.subject_type, subject_code: b.subject_code, operator: b.operator, value: b.value },
      });
    }
  }
  return [...grup.values()].map(({ _kondisi, ...g }) => ({
    ...g,
    conditions: _kondisi.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })).map((k) => k.c),
  }));
}

const URUTAN_ATRIBUT = ATTRIBUTE_TYPES.map((a) => a.code);
const posisi = (code: string) => {
  const i = URUTAN_ATRIBUT.indexOf(code);
  return i === -1 ? URUTAN_ATRIBUT.length : i;
};

/** Respons E6: tiga profil, aturan dalam kalimat manusia, himpunan minimum. */
export function profilPublik(rules: RuleGroup[], minimum: MinimumAttribute[]): ProfileInfo[] {
  return PROFILES.map((code) => ({
    code,
    label: PROFILE_LABELS[code],
    rule_groups: rules
      .filter((g) => g.profile_code === code)
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .map((g) => ({
        id: g.id,
        verdict: g.verdict,
        message: RULE_MESSAGES[g.message_id] ?? g.message_id,
        conditions: g.conditions,
      })),
    minimum_attributes: minimum
      .filter((m) => m.profile_code === code)
      .sort((a, b) => posisi(a.attribute_code) - posisi(b.attribute_code))
      .map(({ attribute_code, required_when_property, required_when_value }) => ({
        attribute_code,
        required_when_property,
        required_when_value,
      })),
  }));
}
