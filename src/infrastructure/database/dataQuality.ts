import type { Pool } from 'pg';

export interface Finding {
  code: string;
  severity: 'info' | 'review' | 'problem';
  description: string;
  count: number;
  exampleIds: number[];
}

interface Check {
  code: string;
  severity: Finding['severity'];
  description: string;
  sql: string;
}

const CHECKS: Check[] = [
  {
    code: 'approved-user-without-approval-date',
    severity: 'review',
    description: 'Users with status approved but no approved_at (legacy). Tolerated by the constraints; consider back-filling.',
    sql: `SELECT id FROM users WHERE status = 'approved' AND approved_at IS NULL`,
  },
  {
    code: 'training-duration-without-unit',
    severity: 'review',
    description: 'Trainings with a duration but no duration_unit (legacy). Tolerated; the unit is ambiguous for these rows.',
    sql: `SELECT id FROM trainings WHERE duration IS NOT NULL AND duration_unit IS NULL`,
  },
  {
    code: 'instructor-overlapping-sessions',
    severity: 'info',
    description: 'Non-cancelled sessions of one instructor whose time ranges overlap at different start times (allowed by design: only an identical start time is blocked).',
    sql: `SELECT DISTINCT a.id FROM training_sessions a JOIN training_sessions b
            ON a.instructor_id = b.instructor_id AND a.id < b.id
           AND a.session_status <> 'cancelled' AND b.session_status <> 'cancelled'
           AND a.start_date < b.end_date AND b.start_date < a.end_date`,
  },
  {
    code: 'blank-attendee-email',
    severity: 'info',
    description: "Attendees whose email is the empty string rather than NULL (legacy). Tolerated; excluded from the per-session email uniqueness rule.",
    sql: `SELECT id FROM session_attendees WHERE email = ''`,
  },
  {
    code: 'blank-client-email',
    severity: 'info',
    description: 'Clients whose email is the empty string rather than NULL (legacy). Tolerated.',
    sql: `SELECT id FROM clients WHERE email = ''`,
  },
  {
    code: 'mixed-case-user-email',
    severity: 'info',
    description: 'Users whose stored email is not lower-case. Lookups are case-insensitive, so nothing is wrong; new signups are stored lower-cased.',
    sql: `SELECT id FROM users WHERE email <> lower(email)`,
  },
  {
    code: 'legacy-pending-assignment',
    severity: 'review',
    description: "Sessions with assignment_status 'pending'. The application no longer creates this state (assignment is immediate), so these are pre-change leftovers.",
    sql: `SELECT id FROM training_sessions WHERE assignment_status = 'pending'`,
  },
  {
    code: 'announcement-roles-out-of-sync',
    severity: 'problem',
    description: 'Announcements whose target_roles JSON disagrees with the feature_announcement_target_roles table. Should always be zero.',
    sql: `SELECT a.id FROM feature_announcements a
           WHERE (SELECT coalesce(array_agg(t.name::text ORDER BY t.name), '{}'::text[]) FROM jsonb_array_elements_text(a.target_roles) t(name))
              IS DISTINCT FROM
                 (SELECT coalesce(array_agg(r.name::text ORDER BY r.name), '{}'::text[]) FROM feature_announcement_target_roles tr
                   JOIN roles r ON r.id = tr.role_id WHERE tr.announcement_id = a.id)`,
  },
  {
    code: 'unvalidated-constraint',
    severity: 'problem',
    description: 'Constraints still marked NOT VALID (a validation migration did not complete). Ids are pg_constraint oids.',
    sql: `SELECT oid::int AS id FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated`,
  },
  {
    code: 'invalid-index',
    severity: 'problem',
    description: 'Indexes left INVALID by a failed CREATE INDEX CONCURRENTLY. Ids are pg_class oids.',
    sql: `SELECT i.indexrelid::int AS id FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
           WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace`,
  },
];

export async function collectDataQualityFindings(pool: Pool): Promise<Finding[]> {
  const findings: Finding[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    for (const check of CHECKS) {
      const { rows } = await client.query(check.sql);
      const ids = rows.map((row) => Number(row.id));
      findings.push({
        code: check.code,
        severity: check.severity,
        description: check.description,
        count: ids.length,
        exampleIds: ids.slice(0, 10),
      });
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
  return findings;
}
