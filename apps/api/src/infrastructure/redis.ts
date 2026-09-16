import { createClient, type RedisClientType } from "redis";
import config from "../config/index.js";
import { logger } from "../common/logger/logger.js";

let redisClient: RedisClientType | null = null;
let isConnecting = false;

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    redisClient = createClient({
      url: config.REDIS_URL,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error("Redis reconnect failed: max retries reached", { retries });
            return new Error("Max retries reached");
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on("error", (err) => {
      logger.error(`Redis connection error: ${err.message}`, {
        errorStack: err.stack,
      });
    });

    redisClient.on("ready", () => {
      logger.info("Redis client connected and ready");
    });
  }

  return redisClient;
}

export async function initRedis(): Promise<boolean> {
  const client = getRedisClient();
  if (client.isOpen) {
    return true;
  }

  if (isConnecting) {
    return false;
  }

  try {
    isConnecting = true;
    await client.connect();
    isConnecting = false;
    return true;
  } catch (error: any) {
    isConnecting = false;
    logger.warn(`Could not connect to Redis: ${error.message}`, {
      redisUrl: config.REDIS_URL.replace(/:\/\/.*@/, "://***@"), // Mask credentials if present
    });
    return false;
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client.isOpen) {
      const connected = await initRedis();
      if (!connected) return false;
    }
    const pong = await client.ping();
    return pong === "PONG";
  } catch (error: any) {
    logger.warn(`Redis health check failed: ${error.message}`);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      logger.info("Redis client disconnected gracefully");
    } catch (error: any) {
      logger.error(`Error during Redis disconnect: ${error.message}`);
    }
  }
}

export default getRedisClient;
