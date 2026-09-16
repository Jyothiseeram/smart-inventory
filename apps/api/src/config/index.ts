import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL must not be empty"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  CORS_ORIGIN: z.string().default("*"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  ALLOW_DEV_HEADER_AUTH: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error("❌ CRITICAL: Configuration validation failed at application startup:");
    console.error(JSON.stringify(formatted, null, 2));
    throw new Error(
      `Invalid application configuration: ${result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ")}`
    );
  }

  return Object.freeze(result.data);
}

export const config: AppConfig = loadConfig();
export default config;
