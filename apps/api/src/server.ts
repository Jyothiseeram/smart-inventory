import app from "./app.js";
import config from "./config/index.js";
import { logger } from "./common/logger/logger.js";
import { initRedis, disconnectRedis } from "./infrastructure/redis.js";
import { checkDatabaseHealth, disconnectPrisma } from "./infrastructure/prisma.js";
import type { Server } from "node:http";

let server: Server | null = null;
let isShuttingDown = false;

async function startServer(): Promise<void> {
  try {
    logger.info("Starting Smart Inventory API server...", {
      environment: config.NODE_ENV,
      port: config.PORT,
    });

    // 1. Verify Database connectivity at startup
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new Error("Failed to connect to PostgreSQL database during startup");
    }
    logger.info("PostgreSQL database connection verified");

    // 2. Initialize Redis
    const redisConnected = await initRedis();
    if (!redisConnected) {
      logger.warn("Redis connection could not be established; starting with degraded cache/session performance");
    }

    // 3. Start HTTP server
    server = app.listen(config.PORT, () => {
      logger.info(`Smart Inventory API running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
    });
  } catch (error: any) {
    logger.error(`Failed to start API server: ${error.message}`, {
      errorStack: error.stack,
    });
    process.exit(1);
  }
}

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  // Force exit after configured timeout
  const forceTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing process exit.");
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    // 1. Stop accepting new HTTP requests
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) return reject(err);
          logger.info("HTTP server closed to new connections");
          resolve();
        });
      });
    }

    // 2. Disconnect Redis
    await disconnectRedis();

    // 3. Disconnect PostgreSQL/Prisma
    await disconnectPrisma();

    logger.info("Graceful shutdown completed successfully");
    process.exit(0);
  } catch (error: any) {
    logger.error(`Error during graceful shutdown: ${error.message}`, {
      errorStack: error.stack,
    });
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, {
    errorStack: error.stack,
  });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: any) => {
  logger.error(`Unhandled Rejection: ${reason?.message || reason}`, {
    errorStack: reason?.stack,
  });
});

if (config.NODE_ENV !== "test") {
  startServer();
}

export { server, startServer };