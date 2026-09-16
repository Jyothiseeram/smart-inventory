import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { prisma } from "../infrastructure/prisma.js";
import { UserStatus } from "../generated/prisma/enums.js";
import config from "../config/index.js";

declare global {
  namespace Express {
    interface Request {
      sessionTokenHash?: string;
      rawSessionToken?: string;
    }
  }
}

/**
 * Middleware that extracts user context from:
 * 1. Authorization: Bearer <session-token>
 * 2. x-session-token: <session-token>
 * 3. x-user-id: <user-id> (dev convenience, strictly gated behind ALLOW_DEV_HEADER_AUTH=true)
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const tokenHeader =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : typeof req.headers["x-session-token"] === "string"
        ? req.headers["x-session-token"]
        : undefined;

    if (tokenHeader) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(tokenHeader)
        .digest("hex");

      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (session && session.expiresAt > new Date()) {
        // Enforce active user status
        if (session.user.status !== UserStatus.ACTIVE) {
          res.status(403).json({
            error: "Forbidden",
            message: `User account is ${session.user.status.toLowerCase()}. Access denied.`,
          });
          return;
        }

        req.user = {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          status: session.user.status,
        };
        req.sessionTokenHash = tokenHash;
        req.rawSessionToken = tokenHeader;
        return next();
      }
    }

    // Fallback: gated x-user-id header strictly for testing/dev environments
    const allowDevHeader = Boolean(config.ALLOW_DEV_HEADER_AUTH);
    const userIdHeader = req.headers["x-user-id"];
    const devUserId =
      allowDevHeader && typeof userIdHeader === "string"
        ? userIdHeader
        : allowDevHeader && Array.isArray(userIdHeader)
        ? userIdHeader[0]
        : undefined;

    if (devUserId) {
      const user = await prisma.user.findUnique({
        where: { id: devUserId },
      });
      if (user && user.status === UserStatus.ACTIVE) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
        };
        return next();
      }
    }

    // Unauthenticated request (caller routes can reject if required)
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Guard middleware requiring authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication is required to access this endpoint",
    });
    return;
  }
  next();
}
