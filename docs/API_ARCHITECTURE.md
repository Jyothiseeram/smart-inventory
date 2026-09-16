# API Architecture & Request Lifecycle

Smart Inventory is a multi-tenant business and inventory management platform designed for high reliability, strict multi-tenant isolation, and modular extensibility.

---

## 1. Request Flow Pipeline

Every incoming HTTP request to the Smart Inventory backend traverses through standard layers in a predictable and hardened sequence:

```
Incoming HTTP Request
       ↓
[1] Security Headers (Helmet)
       ↓
[2] CORS Restrictions (Configured Origins)
       ↓
[3] Request Identification (X-Request-ID Generation & Propagation)
       ↓
[4] Structured Request Logger (Duration, Route, User/Tenant context)
       ↓
[5] Body Size Limits (1MB JSON / URL-encoded payload guard)
       ↓
[6] Global Rate Limiter (Configurable IP-based rate limiting)
       ↓
[7] Authentication Middleware (Session Token Extraction & DB validation)
       ↓
[8] Route Dispatcher (/health, /api, /api/v1)
       ↓
[9] Authorization & Multi-Tenant Guard (requireOrgMembership, requirePermission)
       ↓
[10] Request Validation Middleware (Zod schema for body, query, params)
       ↓
[11] Controller Layer (HTTP translation & standard ApiResponse generation)
       ↓
[12] Service Layer (Business logic, domain rules)
       ↓
[13] Data Access & Transaction Layer (Tenant-scoped queries, runTransaction)
       ↓
[14] Persistence (PostgreSQL via Prisma & Redis)
       ↓
Standard API Response / Centralized Error Handler
```

---

## 2. Layer Responsibilities

### Controller
- Extracts inputs from `req.body`, `req.query`, and `req.params`.
- Delegates business logic to the appropriate Service.
- Formats HTTP responses exclusively using `ApiResponse.success` or passes errors to `next(err)`.
- Does NOT contain direct database queries or domain validation rules.

### Service
- Implements core business logic and workflows.
- Throws typed application errors (e.g., `ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`).
- Orchestrates multi-step mutations using `runTransaction`.

### Data Access / Prisma
- Applies tenant scoping (`forOrganization`, `assertTenantAccess`).
- Uses Prisma client connected via PostgreSQL connection pool.
- Guarantees composite foreign key validation on organization boundaries.

---

## 3. API Routing Conventions

API routes are mounted with centralized routing under `/api` and versioned under `/api/v1`:

```
apps/api/src/routes/
├── index.ts                     # Central route aggregation
├── health.routes.ts             # Health check endpoints (/health, /health/live, /health/ready)
├── auth.routes.ts               # Authentication endpoints (/api/auth)
├── organization.routes.ts       # Organization management (/api/organizations)
├── role.routes.ts               # Organization-scoped roles (/api/organizations/:orgId/roles)
├── employee.routes.ts           # Members & invitations (/api/organizations/:orgId/employees)
├── authorization.routes.ts      # Permission matrix & tests (/api/organizations/:orgId/authorization)
└── foundation-test.routes.ts    # Infrastructure validation (non-production only)
```
