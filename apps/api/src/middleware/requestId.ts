import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-\.:]{1,128}$/;

/**
 * Assigns or safely reuses a unique Request ID (X-Request-ID) for every incoming request.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingHeader = req.headers["x-request-id"];
  const incomingId =
    typeof incomingHeader === "string"
      ? incomingHeader.trim()
      : Array.isArray(incomingHeader) && incomingHeader[0]
      ? incomingHeader[0].trim()
      : undefined;

  let assignedId: string;
  if (incomingId && SAFE_REQUEST_ID_REGEX.test(incomingId)) {
    assignedId = incomingId;
  } else {
    assignedId = `req_${crypto.randomUUID()}`;
  }

  req.id = assignedId;
  res.setHeader("X-Request-ID", assignedId);
  next();
}

export default requestId;
