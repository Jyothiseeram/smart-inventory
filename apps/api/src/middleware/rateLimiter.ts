import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import config from "../config/index.js";
import { RateLimitError } from "../common/errors/app-error.js";

export function createRateLimiter(options?: Partial<Options>) {
  return rateLimit({
    windowMs: options?.windowMs ?? config.RATE_LIMIT_WINDOW_MS,
    limit: options?.limit ?? config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new RateLimitError("Too many requests. Please try again later."));
    },
    ...options,
  });
}

export const standardRateLimiter = createRateLimiter();
export default standardRateLimiter;
