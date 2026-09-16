# Development Workflow & Operations

This document guides developers through setting up, running, testing, and building the Smart Inventory project locally.

---

## 1. Prerequisites

- **Node.js**: `v20+` or `v24+`
- **pnpm**: `v11.25.0+`
- **Docker & Docker Compose**: for local PostgreSQL and Redis

---

## 2. Starting Infrastructure Services

Start the PostgreSQL database and Redis cache containers:

```bash
docker compose up -d
```

Verify that both containers are running and healthy:

```bash
docker ps
```

- PostgreSQL runs on `localhost:5432` (`smart-inventory-postgres`)
- Redis runs on `localhost:6379` (`smart-inventory-redis`)

---

## 3. Database Migrations & Seeding

Navigate to `apps/api` or run from repository root:

```bash
# Apply migrations
pnpm --filter api exec prisma migrate deploy

# Seed global system permissions (23 permissions)
pnpm --filter api exec prisma db seed
```

---

## 4. Starting Applications

### Start the Backend API (Development Mode)
```bash
pnpm --filter api dev
```
The API server starts on `http://localhost:4000`.

### Start the Frontend Web Application (Development Mode)
```bash
pnpm --filter web dev
```
The Vite development server starts on `http://localhost:5173` and proxies `/api` requests to `http://localhost:4000`.

---

## 5. Running Tests

Run the full automated test suite (Phase 2 Foundation, Phase 1 RBAC, and Phase 1 API tests):

```bash
pnpm --filter api test
```

Run specific test suites:

```bash
# Phase 2 Foundation Verification (44 tests)
pnpm --filter api test:foundation

# Phase 1 Foundation RBAC Verification (16 tests)
pnpm --filter api test:rbac

# Phase 1 End-to-End API Suite (36 tests)
pnpm --filter api test:api
```

---

## 6. Type Checking & Production Build

```bash
# Run TypeScript type check across API and Web
pnpm typecheck

# Build both applications for production
pnpm build
```
