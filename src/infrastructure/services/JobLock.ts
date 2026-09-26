










class JobLock {
  pool: any;

  constructor({ pool }) {
    this.pool = pool;
  }

  
  
  async runExclusive(name: string, fn: () => Promise<any>): Promise<boolean> {
    const key = `training-platform:job:${name}`;
    const client = await this.pool.connect();
    let held = false;
    let destroy: Error | undefined;
    try {
      const { rows } = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key]);
      held = Boolean(rows[0] && rows[0].locked);
      if (!held) return false;
      await fn();
      return true;
    } catch (err) {
      
      if (!held) destroy = err;
      throw err;
    } finally {
      if (held) {
        try {
          await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
        } catch (unlockErr) {
          
          destroy = unlockErr;
        }
      }
      client.release(destroy);
    }
  }
}


const noJobLock = {
  runExclusive: async (_name: string, fn: () => Promise<any>) => {
    await fn();
    return true;
  },
};

export { JobLock, noJobLock };
