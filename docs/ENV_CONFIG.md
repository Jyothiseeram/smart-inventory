# Environment Configuration & Management

Configuration is centralized and validated using Zod at application boot (`apps/api/src/config/index.ts`). Missing or invalid configuration causes the server to fail fast immediately.

---

## 1. Environment Variables Specification

| Variable | Type | Default | Required | Description |
|:---|:---|:---|:---:|:---|
| `NODE_ENV` | `string` (`development` \| `production` \| `test`) | `development` | No | Controls error verbosity, logger output, and route mounting. |
| `PORT` | `number` | `4000` | No | Port on which the Express HTTP server listens. |
| `DATABASE_URL` | `string` | - | **Yes** | PostgreSQL connection string including credentials and database name. |
| `REDIS_URL` | `string` | `redis://localhost:6379` | No | Connection URL for Redis client. |
| `CORS_ORIGIN` | `string` | `*` | No | Comma-separated list of allowed origins or `*` in development. |
| `RATE_LIMIT_WINDOW_MS` | `number` | `60000` | No | Window size in milliseconds for IP-based rate limiting (1 minute). |
| `RATE_LIMIT_MAX` | `number` | `100` | No | Maximum requests permitted per window. |
| `LOG_LEVEL` | `string` (`debug` \| `info` \| `warn` \| `error`) | `info` | No | Minimum severity level emitted to logs. |
| `FRONTEND_URL` | `string` | `http://localhost:5173` | No | URL of the frontend web application. |
| `ALLOW_DEV_HEADER_AUTH`| `string` (`true` \| `false`) | `false` | No | Strictly development-only flag allowing `x-user-id` header authentication. |
| `SHUTDOWN_TIMEOUT_MS` | `number` | `10000` | No | Maximum time in milliseconds to wait for graceful shutdown before force exit. |

---

## 2. Local Development Configuration (`apps/api/.env`)

Example `.env` configuration for local development:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://inventory_user:inventory_password@localhost:5432/smart_inventory"
REDIS_URL="redis://localhost:6379"
CORS_ORIGIN="http://localhost:5173"
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
FRONTEND_URL="http://localhost:5173"
ALLOW_DEV_HEADER_AUTH="false"
```

---

## 3. Secret Hygiene Principles

1. **Never Commit Secrets**: The `.env` file is gitignored across all workspaces.
2. **Never Log Secrets**: The structured logger recursively redacts fields named `password`, `token`, `authorization`, `secret`, `cookie`, and `tokenHash`.
3. **Never Leak in Responses**: Error handling middleware strips all raw connection strings, query parameters, and stack traces before sending responses to clients.
