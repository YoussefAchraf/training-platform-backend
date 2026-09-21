import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { pool } from './connection';
import { isRoutineDbError, translateDbError } from './dbErrors';




const adapter = new PrismaPg(pool);
const basePrismaClient = new PrismaClient({ adapter });

const prismaClient = basePrismaClient.$extends({
  query: {
    async $allOperations({ args, query }) {
      try {
        return await query(args);
      } catch (err) {
        const translated = translateDbError(err);
        if (!translated) throw err;
        if (!isRoutineDbError(translated)) {
          console.error('[db] unmapped database error', {
            code: translated.code,
            pgCode: translated.pgCode,
            constraint: translated.constraint,
          });
        }
        throw translated;
      }
    },
  },
});

export { prismaClient };
