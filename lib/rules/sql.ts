/**
 * Pembangkit INSERT data acuan dari reference.ts. Hasilnya ditempel di migrasi
 * db/migrations/*_verifikasi_referensi.sql, dan tes sql.test.ts memastikan
 * migrasi itu tidak pernah bergeser dari reference.ts.
 */

import { ATTRIBUTE_TYPES, MINIMUM_ATTRIBUTES, RULE_GROUPS } from "./reference";

function lit(v: string | null): string {
  return v === null ? "null" : `'${v.replace(/'/g, "''")}'`;
}

function arr(values: string[]): string {
  return `array[${values.map(lit).join(", ")}]::text[]`;
}

export function referenceInsertSql(): string {
  const baris: string[] = [];

  baris.push("insert into attribute_type (code, value_type, allowed_values, vantage, is_required_at_vantage, review_interval_days, ai_suggestable, label_id) values");
  baris.push(
    ATTRIBUTE_TYPES.map(
      (a) =>
        `  (${lit(a.code)}, ${lit(a.value_type)}, ${arr(a.allowed_values)}, ${lit(a.vantage)}, ${a.is_required_at_vantage}, ${a.review_interval_days}, ${a.ai_suggestable}, ${lit(a.label_id)})`,
    ).join(",\n") + ";",
  );

  baris.push("", "insert into profile_rule_group (id, profile_code, verdict, message_id, priority) values");
  baris.push(
    RULE_GROUPS.map((g) => `  (${lit(g.id)}, ${lit(g.profile_code)}, ${lit(g.verdict)}, ${lit(g.message_id)}, ${g.priority})`).join(",\n") + ";",
  );

  baris.push("", "insert into profile_rule_condition (id, group_id, subject_type, subject_code, operator, value) values");
  baris.push(
    RULE_GROUPS.flatMap((g) =>
      g.conditions.map(
        (c, i) =>
          `  (${lit(`${g.id}__${i + 1}`)}, ${lit(g.id)}, ${lit(c.subject_type)}, ${lit(c.subject_code)}, ${lit(c.operator)}, ${lit(c.value)})`,
      ),
    ).join(",\n") + ";",
  );

  baris.push("", "insert into profile_minimum_attribute (profile_code, attribute_code, required_when_property, required_when_value) values");
  baris.push(
    MINIMUM_ATTRIBUTES.map(
      (m) => `  (${lit(m.profile_code)}, ${lit(m.attribute_code)}, ${lit(m.required_when_property)}, ${lit(m.required_when_value)})`,
    ).join(",\n") + ";",
  );

  return baris.join("\n");
}
