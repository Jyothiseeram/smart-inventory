import express from "express";
import helmet from "helmet";
import cors from "cors";
import config from "./config/index.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { standardRateLimiter } from "./middleware/rateLimiter.js";
import { authenticate } from "./middleware/authenticate.js";
import healthRouter from "./routes/health.routes.js";
import apiRouter from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// 1. Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 2. CORS configuration
const allowedOrigins =
  config.CORS_ORIGIN === "*"
    ? "*"
    : config.CORS_ORIGIN.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "x-organization-id",
      "x-user-id",
      "x-session-token",
      "x-request-id",
    ],
    exposedHeaders: ["X-Request-ID"],
    credentials: true,
  })
);

// 3. Request identification & correlation
app.use(requestId);

// 4. Structured request logging
app.use(requestLogger);

// 5. Body parsers with size limit
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 6. Global rate limiting
app.use(standardRateLimiter);

// 7. Authentication middleware (session token extraction)
app.use(authenticate);

// 8. Health check system (liveness & readiness)
app.use("/health", healthRouter);

// 9. API routes (/api and /api/v1)
app.use("/api", apiRouter);
app.use("/api/v1", apiRouter);

// 10. 404 Handler for unmapped routes
app.use(notFoundHandler);

// 11. Centralized Error Handler
app.use(errorHandler);

export default app;
