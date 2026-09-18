import type { PoolClient } from 'pg';

export type AuditAction =
  | 'session_created'
  | 'evidence_submitted'
  | 'provenance_failed'
  | 'observation_confirmed'
  | 'state_updated'
  | 'rate_limit_reset';

export type AuditEntity =
  | 'evidence' | 'observation' | 'attribute_state' | 'capture_session' | 'contributor';

/**
 * Jejak audit ini TERBUKA UNTUK PUBLIK.
 * Jangan pernah menaruh IP, user agent, header, atau apa pun yang bisa
 * mengidentifikasi orang ke dalam payload. actor adalah display_handle anonim.
 */
export async function writeAudit(
  c: PoolClient,
  e: {
    entityType: AuditEntity;
    entityId: string;
    action: AuditAction;
    actor: string;
    before: unknown;
    after: unknown;
    isDemoSeed?: boolean;
  },
): Promise<void> {
  await c.query(
    `INSERT INTO audit_event
       (entity_type, entity_id, action, actor, payload_snapshot, is_demo_seed)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      e.entityType,
      e.entityId,
      e.action,
      e.actor,
      JSON.stringify({ before: e.before ?? null, after: e.after ?? null }),
      e.isDemoSeed ?? false,
    ],
  );
}
