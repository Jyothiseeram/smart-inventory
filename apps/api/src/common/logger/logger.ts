import config from "../../config/index.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "rawtoken",
  "sessiontoken",
  "authorization",
  "cookie",
  "secret",
  "refreshtoken",
  "accesstoken",
  "tokenhash",
]);

/**
 * Recursively redacts sensitive keys from log metadata.
 */
export function sanitizeLogData(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface LogContext {
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string;
  organizationId?: string;
  errorCode?: string;
  errorStack?: string;
  [key: string]: unknown;
}

export class Logger {
  private currentLevelPriority: number;

  constructor() {
    this.currentLevelPriority = LOG_LEVEL_PRIORITY[config.LOG_LEVEL] ?? 1;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.currentLevelPriority;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const cleanContext = context ? (sanitizeLogData(context) as LogContext) : {};

    if (config.NODE_ENV === "production") {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...cleanContext,
      });
    }

    // Human-readable format for development & test
    const reqStr = cleanContext.requestId ? ` [${cleanContext.requestId}]` : "";
    const routeStr = cleanContext.method && cleanContext.route ? ` ${cleanContext.method} ${cleanContext.route}` : "";
    const statusStr = cleanContext.statusCode ? ` -> ${cleanContext.statusCode}` : "";
    const durationStr = cleanContext.durationMs !== undefined ? ` (${cleanContext.durationMs}ms)` : "";
    const metaRest = { ...cleanContext };
    delete metaRest.requestId;
    delete metaRest.method;
    delete metaRest.route;
    delete metaRest.statusCode;
    delete metaRest.durationMs;

    const extraStr = Object.keys(metaRest).length > 0 ? ` ${JSON.stringify(metaRest)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}]${reqStr}${routeStr}${statusStr}${durationStr}: ${message}${extraStr}`;
  }

  public debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatLog("debug", message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.info(this.formatLog("info", message, context));
    }
  }

  public warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatLog("warn", message, context));
    }
  }

  public error(message: string, context?: LogContext): void {
    if (this.shouldLog("error")) {
      console.error(this.formatLog("error", message, context));
    }
  }
}

export const logger = new Logger();
export default logger;
