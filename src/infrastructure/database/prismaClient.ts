import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { pool } from './connection';





const adapter = new PrismaPg(pool);
const prismaClient = new PrismaClient({ adapter });

export { prismaClient };
