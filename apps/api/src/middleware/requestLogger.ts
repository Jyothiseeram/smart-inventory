import type { Request, Response, NextFunction } from "express";
import { logger } from "../common/logger/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const statusCode = res.statusCode;
    const logContext = {
      requestId: req.id,
      method: req.method,
      route: req.originalUrl || req.url,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.id,
      organizationId: req.organizationId,
    };

    const message = `HTTP ${req.method} ${req.originalUrl || req.url} ${statusCode}`;

    if (statusCode >= 500) {
      logger.error(message, logContext);
    } else if (statusCode >= 400) {
      logger.warn(message, logContext);
    } else {
      logger.info(message, logContext);
    }
  });

  next();
}

export default requestLogger;
