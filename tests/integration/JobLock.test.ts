import { Pool } from 'pg';
import { JobLock } from '../../src/infrastructure/services/JobLock';


describe('JobLock (real PostgreSQL advisory locks)', () => {
  const podA = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const podB = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const lockA = new JobLock({ pool: podA });
  const lockB = new JobLock({ pool: podB });

  afterAll(async () => {
    await podA.end();
    await podB.end();
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('lets only one pod run a tick when both fire at the same moment', async () => {
    let running = 0;
    let maxConcurrent = 0;
    const executions: string[] = [];
    const job = (who: string) => async () => {
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      executions.push(who);
      await sleep(300);
      running -= 1;
    };

    const [ranA, ranB] = await Promise.all([
      lockA.runExclusive('it-report-tick', job('A')),
      lockB.runExclusive('it-report-tick', job('B')),
    ]);

    expect([ranA, ranB].filter(Boolean)).toHaveLength(1);
    expect(executions).toHaveLength(1);
    expect(maxConcurrent).toBe(1);
  });

  it('releases the lock afterwards, so the next tick can run on either pod', async () => {
    expect(await lockA.runExclusive('it-release', async () => undefined)).toBe(true);
    expect(await lockB.runExclusive('it-release', async () => undefined)).toBe(true);
    expect(await lockA.runExclusive('it-release', async () => undefined)).toBe(true);
  });

  it('releases the lock when the job throws', async () => {
    await expect(lockA.runExclusive('it-throws', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await lockB.runExclusive('it-throws', async () => undefined)).toBe(true);
  });

  it('does not block different jobs from running at the same time', async () => {
    const results = await Promise.all([
      lockA.runExclusive('it-job-one', async () => sleep(150)),
      lockB.runExclusive('it-job-two', async () => sleep(150)),
    ]);
    expect(results).toEqual([true, true]);
  });

  it('drops the lock with the connection: a pod that dies mid-job cannot leave the job locked forever', async () => {
    const dying = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const started = new Promise<void>((resolve) => {
      void new JobLock({ pool: dying }).runExclusive('it-crash', async () => {
        resolve();
        await sleep(10_000);
      }).catch(() => undefined);
    });
    await started;

    expect(await lockB.runExclusive('it-crash', async () => undefined)).toBe(false);

    await dying.end().catch(() => undefined);
    await sleep(300);
    expect(await lockB.runExclusive('it-crash', async () => undefined)).toBe(true);
  }, 20_000);
});
