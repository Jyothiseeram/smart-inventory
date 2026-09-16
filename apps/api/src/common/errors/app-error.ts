export interface ErrorDetails {
  field?: string;
  message: string;
  code?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required to access this resource") {
    super(message, 401, "UNAUTHORIZED", true);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = "You do not have permission to perform this action",
    details?: unknown
  ) {
    super(message, 403, "FORBIDDEN", true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Requested resource was not found") {
    super(message, 404, "RESOURCE_NOT_FOUND", true);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict occurred", details?: unknown) {
    super(message, 409, "CONFLICT", true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true);
  }
}

export class DatabaseError extends AppError {
  constructor(
    message = "A database error occurred",
    details?: unknown,
    code = "DATABASE_ERROR"
  ) {
    super(message, 500, code, true, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected error occurred") {
    super(message, 500, "INTERNAL_SERVER_ERROR", false);
  }
}
