import { Router, type Request, type Response } from "express";
import { checkDatabaseHealth } from "../infrastructure/prisma.js";
import { checkRedisHealth } from "../infrastructure/redis.js";
import { ApiResponse } from "../common/response/api-response.js";

const router = Router();

/**
 * GET /health
 * Basic liveness check confirming the API process is alive.
 * Retains exact backwards compatibility with Phase 1 Test 1.
 */
router.get("/", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    service: "smart-inventory-api",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/live
 * Kubernetes / process liveness probe.
 */
router.get("/live", (_req: Request, res: Response): void => {
  ApiResponse.success(res, {
    status: "live",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Readiness probe verifying connectivity to PostgreSQL and Redis.
 */
router.get("/ready", async (_req: Request, res: Response): Promise<void> => {
  const [dbHealthy, redisHealthy] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const allHealthy = dbHealthy && redisHealthy;
  const dependencies = {
    database: dbHealthy ? "healthy" : "unhealthy",
    redis: redisHealthy ? "healthy" : "unhealthy",
  };

  if (!allHealthy) {
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "One or more infrastructure dependencies are unavailable",
        details: dependencies,
      },
      data: {
        status: "not_ready",
        dependencies,
      },
    });
    return;
  }

  ApiResponse.success(res, {
    status: "ready",
    dependencies,
  });
});

export default router;
