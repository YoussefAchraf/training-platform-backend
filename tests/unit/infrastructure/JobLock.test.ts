import { JobLock, noJobLock } from '../../../src/infrastructure/services/JobLock';

function makePool(lockResult: boolean | Error, unlockError?: Error) {
  const client = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) {
        if (lockResult instanceof Error) throw lockResult;
        return { rows: [{ locked: lockResult }] };
      }
      if (sql.includes('pg_advisory_unlock')) {
        if (unlockError) throw unlockError;
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client) };
  return { pool, client };
}

describe('JobLock', () => {
  it('runs the job, then unlocks and returns the connection to the pool', async () => {
    const { pool, client } = makePool(true);
    const job = jest.fn(async () => undefined);

    const ran = await new JobLock({ pool }).runExclusive('demo', job);

    expect(ran).toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
    const sqls = client.query.mock.calls.map((c) => c[0]);
    expect(sqls[0]).toContain('pg_try_advisory_lock');
    expect(sqls[1]).toContain('pg_advisory_unlock');
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it('skips the job when another instance holds the lock, and never unlocks a lock it does not own', async () => {
    const { pool, client } = makePool(false);
    const job = jest.fn(async () => undefined);

    const ran = await new JobLock({ pool }).runExclusive('demo', job);

    expect(ran).toBe(false);
    expect(job).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it('uses a different lock key per job name', async () => {
    const { pool, client } = makePool(true);
    const lock = new JobLock({ pool });

    await lock.runExclusive('report-scheduler', async () => undefined);
    await lock.runExclusive('attachment-upload-gc', async () => undefined);

    const keys = client.query.mock.calls.filter((c) => c[0].includes('pg_try_advisory_lock')).map((c) => c[1][0]);
    expect(keys).toEqual(['training-platform:job:report-scheduler', 'training-platform:job:attachment-upload-gc']);
  });

  it('still unlocks when the job throws, and rethrows the job error', async () => {
    const { pool, client } = makePool(true);
    const boom = new Error('job failed');

    await expect(new JobLock({ pool }).runExclusive('demo', async () => Promise.reject(boom))).rejects.toBe(boom);

    expect(client.query.mock.calls.map((c) => c[0]).some((s) => s.includes('pg_advisory_unlock'))).toBe(true);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it('destroys the connection instead of pooling it if the unlock fails (a locked connection must never be reused)', async () => {
    const unlockError = new Error('connection lost');
    const { pool, client } = makePool(true, unlockError);

    const ran = await new JobLock({ pool }).runExclusive('demo', async () => undefined);

    expect(ran).toBe(true);
    expect(client.release).toHaveBeenCalledWith(unlockError);
  });

  it('destroys the connection and rethrows when the lock query itself fails', async () => {
    const dbDown = new Error('database unavailable');
    const { pool, client } = makePool(dbDown);
    const job = jest.fn();

    await expect(new JobLock({ pool }).runExclusive('demo', job)).rejects.toBe(dbDown);

    expect(job).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(dbDown);
  });
});

describe('noJobLock', () => {
  it('just runs the job (used where no lock is wired)', async () => {
    const job = jest.fn(async () => undefined);
    expect(await noJobLock.runExclusive('anything', job)).toBe(true);
    expect(job).toHaveBeenCalledTimes(1);
  });
});
