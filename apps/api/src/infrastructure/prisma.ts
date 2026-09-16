import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import config from "../config/index.js";
import { logger } from "../common/logger/logger.js";

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error: any) {
    logger.warn(`Database health check failed: ${error.message}`);
    return false;
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
    logger.info("Database connections disconnected gracefully");
  } catch (error: any) {
    logger.error(`Error disconnecting database: ${error.message}`);
  }
}

export default prisma;
