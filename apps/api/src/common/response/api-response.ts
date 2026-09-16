import type { Response } from "express";

export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StandardErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface StandardErrorResponse {
  success: false;
  error: StandardErrorPayload;
  message: string;
  [key: string]: unknown;
}

export class ApiResponse {
  /**
   * Generates and sends a standard success response.
   * Spreads plain object data to maintain backwards-compatibility with Phase 1 clients.
   */
  static success<T = unknown>(
    res: Response,
    data: T,
    statusCode = 200,
    message?: string,
    meta?: Record<string, unknown>,
    legacyExtra?: Record<string, unknown>
  ): Response {
    const payload: StandardSuccessResponse<T> = {
      success: true,
      data,
      ...(message ? { message } : {}),
      ...(meta ? { meta } : {}),
      ...(typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}),
      ...(legacyExtra || {}),
    };

    return res.status(statusCode).json(payload);
  }

  /**
   * Generates and sends a standard error response.
   */
  static error(
    res: Response,
    error: StandardErrorPayload,
    statusCode = 500,
    legacyExtra?: Record<string, unknown>
  ): Response {
    const payload: StandardErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      message: error.message,
      ...(legacyExtra || {}),
    };

    return res.status(statusCode).json(payload);
  }
}
