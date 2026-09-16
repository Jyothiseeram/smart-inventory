import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { ApiResponse } from "../common/response/api-response.js";
import { forOrganization, assertTenantAccess } from "../common/database/tenant-scope.js";
import { runTransaction } from "../common/database/transaction.js";
import { prisma } from "../infrastructure/prisma.js";

const router = Router();

const sampleSchema = {
  body: z.object({
    name: z.string().min(2, "Name must have at least 2 characters"),
    sku: z.string().regex(/^[A-Z0-9-]+$/, "SKU must contain only uppercase alphanumeric characters and hyphens"),
    price: z.number().positive("Price must be positive"),
  }),
};

/**
 * POST /api/foundation-test/validate
 * Tests request validation middleware.
 */
router.post("/validate", validate(sampleSchema), (req: Request, res: Response): void => {
  ApiResponse.success(res, req.body, 200, "Validation successful");
});

/**
 * GET /api/foundation-test/internal-error
 * Tests that raw errors and stack traces are masked into a safe 500 response.
 */
router.get("/internal-error", (): void => {
  throw new Error("Simulated critical DB failure: postgresql://inventory_user:SUPER_SECRET_PW@db:5432/smart_inventory");
});

/**
 * GET /api/foundation-test/scoped-access
 * Tests organization-scoped access helpers.
 */
router.get("/scoped-access", (req: Request, res: Response): void => {
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
  const callerOrgId = typeof req.query.callerOrgId === "string" ? req.query.callerOrgId : "";

  const scoped = forOrganization(orgId, { status: "ACTIVE" });
  assertTenantAccess(orgId, callerOrgId, "TestEntity");

  ApiResponse.success(res, { scoped, allowed: true });
});

/**
 * POST /api/foundation-test/transaction-test
 * Demonstrates atomic transaction with rollback on failure.
 */
router.post("/transaction-test", async (_req: Request, res: Response, next): Promise<void> => {
  try {
    const testOrgName = `TxTestOrg-${Date.now()}`;

    try {
      await runTransaction(async (tx) => {
        // Step 1: Create organization
        await tx.organization.create({
          data: { name: testOrgName },
        });

        // Step 2: Intentionally throw to trigger rollback
        throw new Error("Simulated business rule failure after step 1");
      });
    } catch {
      // Expected to fail
    }

    // Verify rollback: organization should NOT exist
    const found = await prisma.organization.findFirst({
      where: { name: testOrgName },
    });

    ApiResponse.success(res, {
      rolledBack: found === null,
      message: "Transaction rollback confirmed",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
