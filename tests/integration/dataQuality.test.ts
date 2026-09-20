import { Pool } from 'pg';
import { collectDataQualityFindings } from '../../src/infrastructure/database/dataQuality';

describe('data quality report (real database, read-only)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

  afterAll(async () => {
    await pool.end();
  });

  it('runs every check and reports no structural problems on a migrated database', async () => {
    const findings = await collectDataQualityFindings(pool);
    expect(findings.map((f) => f.code)).toEqual(
      expect.arrayContaining([
        'approved-user-without-approval-date',
        'training-duration-without-unit',
        'instructor-overlapping-sessions',
        'announcement-roles-out-of-sync',
        'unvalidated-constraint',
        'invalid-index',
      ])
    );
    for (const finding of findings) {
      expect(finding.count).toBe(finding.exampleIds.length === 0 ? 0 : finding.count);
      expect(finding.exampleIds.length).toBeLessThanOrEqual(10);
    }
    expect(findings.filter((f) => f.severity === 'problem' && f.count > 0)).toEqual([]);
  });

  it('never leaves a transaction open or writes anything', async () => {
    await collectDataQualityFindings(pool);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE state = 'idle in transaction' AND pid <> pg_backend_pid()`);
    expect(rows[0].n).toBe(0);
  });
});
