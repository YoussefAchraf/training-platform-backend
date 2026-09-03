import 'dotenv/config';
import { pool } from './infrastructure/database/connection';
import { redis } from './infrastructure/cache/RedisClient';
import { buildApp } from './app';

const { app, reportScheduler, sessionReminderScheduler } = buildApp();

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Training platform API listening on port ${PORT}`);
  reportScheduler.start();
  sessionReminderScheduler.start();
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async (err?: Error) => {
    if (err) {
      console.error('Error while closing HTTP server', err);
      process.exitCode = 1;
    }
    try {
      await pool.end();
    } catch (poolErr) {
      console.error('Error while closing database pool', poolErr);
      process.exitCode = 1;
    }
    try {
      await redis.quit();
    } catch (redisErr) {
      console.error('Error while closing Redis connection', redisErr);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
