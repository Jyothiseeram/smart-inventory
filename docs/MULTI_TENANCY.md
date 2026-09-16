# Multi-Tenant Architecture & Data Access Discipline

Smart Inventory is a strictly isolated multi-tenant system. No tenant may ever read, modify, or infer the existence of another tenant's resources.

---

## 1. The Multi-Tenant Access Chain

For every organization-owned entity, access strictly flows down the authorization chain:

```
Authenticated User (Session)
       ↓
Membership (User + Organization)
       ↓
Role & Permissions (Scoped to Organization)
       ↓
Organization-Owned Entity (e.g., Roles, Employees, Inventory, Sales)
```

No request may access or modify a resource solely by supplying its ID.

---

## 2. Database Discipline & Composite Foreign Keys

Cross-tenant data mixing is strictly prohibited at both the application and database engine layers:

### Composite Foreign Keys
Roles are scoped to organizations. When referencing roles in memberships or invitations, Prisma enforces composite foreign keys:

```prisma
model Membership {
  role OrganizationRole @relation(fields: [roleId, organizationId], references: [id, organizationId], onDelete: Restrict)
}
```

If an attacker attempts to assign a role from Organization B to a membership in Organization A, PostgreSQL rejects the statement at the database engine level (`P2003 Foreign Key Violation`).

### Organization-Scoped Query Helpers

When querying any tenant-scoped resource in future modules:

❌ **NEVER write unscoped queries:**
```ts
// FORBIDDEN: Vulnerable to cross-tenant ID tampering
const product = await prisma.product.findUnique({
  where: { id: productId },
});
```

✅ **ALWAYS enforce organization context:**
```ts
import { forOrganization, assertTenantAccess } from "../common/database/tenant-scope.js";

// Safe: organizationId is guaranteed in the filter
const product = await prisma.product.findFirst({
  where: forOrganization(req.organizationId!, { id: productId }),
});

// Or assert access explicitly after retrieval:
assertTenantAccess(product.organizationId, req.organizationId!, "Product");
```

---

## 3. Database Transactions Convention

Multi-step modifications must execute atomically using `runTransaction`:

```ts
import { runTransaction } from "../common/database/transaction.js";

const result = await runTransaction(async (tx) => {
  // Step 1: Create sale
  const sale = await tx.sale.create({ ... });

  // Step 2: Deduct inventory stock
  await tx.stock.update({ ... });

  // Step 3: Record audit log
  await tx.auditLog.create({ ... });

  return sale;
});
```

If any step throws an error, the entire transaction is automatically rolled back, and a structured failure log is recorded.
