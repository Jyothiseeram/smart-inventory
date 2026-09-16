# Health Checks & Observability

Smart Inventory provides distinct liveness and readiness endpoints conforming to modern container orchestration standards (e.g. Kubernetes, Docker Compose, ECS).

---

## 1. Process Liveness (`GET /health` & `GET /health/live`)

Confirms that the Node.js API process is alive and accepting connections.
**Crucial:** These endpoints do **not** depend on database or Redis connections to prevent unnecessary container restarts during transient infrastructure hiccups.

### `GET /health`
Returns process status, service name, and uptime:

```json
{
  "status": "ok",
  "service": "smart-inventory-api",
  "uptime": 3600,
  "timestamp": "2026-09-11T12:00:00.000Z"
}
```

### `GET /health/live`
Standard container liveness probe:

```json
{
  "success": true,
  "data": {
    "status": "live",
    "uptime": 3600,
    "timestamp": "2026-09-11T12:00:00.000Z"
  }
}
```

---

## 2. Infrastructure Readiness (`GET /health/ready`)

Verifies that the API can successfully communicate with required infrastructure dependencies:
- **PostgreSQL**: verified via `SELECT 1` query using Prisma.
- **Redis**: verified via `PING` command using the Redis client.

### Healthy Response (HTTP 200 OK)
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "dependencies": {
      "database": "healthy",
      "redis": "healthy"
    }
  }
}
```

### Unhealthy Response (HTTP 503 Service Unavailable)
If any dependency is unreachable, returns HTTP 503 without leaking credentials or internal hostnames:

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "One or more infrastructure dependencies are unavailable",
    "details": {
      "database": "unhealthy",
      "redis": "healthy"
    }
  },
  "data": {
    "status": "not_ready",
    "dependencies": {
      "database": "unhealthy",
      "redis": "healthy"
    }
  }
}
```
