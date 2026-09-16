import type { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error.js";
import { ApiResponse } from "../common/response/api-response.js";
import { logger } from "../common/logger/logger.js";
import config from "../config/index.js";

interface PrismaLikeError extends Error {
  code?: string;
  meta?: Record<string, unknown>;
}

/**
 * Production-grade centralized error-handling middleware.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";
  let details: unknown = undefined;

  // 1. Operational AppErrors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }
  // 2. JSON Body Parser SyntaxError
  else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    code = "INVALID_JSON_BODY";
    message = "Malformed JSON payload in request body";
  }
  // 3. Known Prisma Errors
  else if ("code" in err && typeof (err as PrismaLikeError).code === "string") {
    const prismaErr = err as PrismaLikeError;
    switch (prismaErr.code) {
      case "P2002":
        statusCode = 409;
        code = "RESOURCE_ALREADY_EXISTS";
        message = "A resource with these unique attributes already exists";
        details = prismaErr.meta;
        break;
      case "P2003":
        statusCode = 400;
        code = "FOREIGN_KEY_VIOLATION";
        message = "Database constraint violation: referenced resource does not exist or cross-tenant relation forbidden";
        details = prismaErr.meta;
        break;
      case "P2025":
        statusCode = 404;
        code = "RESOURCE_NOT_FOUND";
        message = "The requested database record was not found";
        break;
      default:
        statusCode = 500;
        code = "DATABASE_ERROR";
        message = "A database operation failed";
    }
  }
  // 4. Other unhandled errors
  else {
    statusCode = 500;
    code = "INTERNAL_SERVER_ERROR";
    message = "An unexpected error occurred";
  }

  // Always log technical error details on the server with correlation ID
  logger.error(`Error occurred during ${req.method} ${req.originalUrl || req.url}: ${err.message}`, {
    requestId: req.id,
    method: req.method,
    route: req.originalUrl || req.url,
    statusCode,
    errorCode: code,
    errorStack: err.stack,
  });

  ApiResponse.error(
    res,
    {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    statusCode
  );
}

export default errorHandler;
