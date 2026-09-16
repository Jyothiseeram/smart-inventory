import { Router, type Request, type Response } from "express";
import { prisma } from "../infrastructure/prisma.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership } from "../middleware/authorization.js";
import { BusinessType } from "../generated/prisma/enums.js";

const router = Router({ mergeParams: true });

/**
 * GET /api/organizations/:orgId
 * Returns organization details with member and role counts.
 * Requires active organization membership (multi-tenant boundary).
 */
router.get("/:orgId", requireAuth, requireOrgMembership, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            roles: true,
            invitations: true,
          },
        },
      },
    });

    if (!org) {
      res.status(404).json({ error: "Not Found", message: `Organization ${orgId} not found` });
      return;
    }

    res.status(200).json({
      organization: {
        id: org.id,
        name: org.name,
        businessType: org.businessType,
        status: org.status,
        createdAt: org.createdAt,
        counts: {
          members: org._count.memberships,
          roles: org._count.roles,
          invitations: org._count.invitations,
        },
      },
      callerMembership: req.membership
        ? {
            roleId: req.membership.roleId,
            roleName: req.membership.roleName,
            status: req.membership.status,
            isSystemRole: req.membership.isSystemRole,
          }
        : null,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to retrieve organization",
    });
  }
});

/**
 * PATCH /api/organizations/:orgId
 * Updates organization profile and settings.
 * Requires SETTINGS_UPDATE or ORGANIZATION_MANAGE permission.
 */
router.patch("/:orgId", requireAuth, requireOrgMembership, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const { name, businessType } = req.body;

    // Check permission
    const perms = req.membership?.permissions || [];
    if (!perms.includes("SETTINGS_UPDATE") && !perms.includes("ORGANIZATION_MANAGE")) {
      res.status(403).json({
        error: "Forbidden",
        message: "User does not have permission to update organization settings",
      });
      return;
    }

    const updateData: any = {};
    if (name && typeof name === "string") {
      updateData.name = name.trim();
    }
    if (businessType && Object.values(BusinessType).includes(businessType)) {
      updateData.businessType = businessType as BusinessType;
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    res.status(200).json({
      message: "Organization settings updated successfully",
      organization: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to update organization",
    });
  }
});

/**
 * GET /api/organizations/:orgId/access-test
 * Explicit cross-tenant isolation test endpoint.
 * Returns 200 OK if caller is an active member of this organization,
 * or 403 Forbidden if caller does not belong to this tenant.
 */
router.get("/:orgId/access-test", requireAuth, requireOrgMembership, async (req: Request, res: Response): Promise<void> => {
  try {
    const membership = req.membership!;

    const org = await prisma.organization.findUnique({
      where: { id: membership.organizationId },
    });

    res.status(200).json({
      status: "ok",
      tenantAllowed: true,
      message: `Multi-Tenant Access Granted: User ${req.user!.email} is a verified member of ${org?.name} (${membership.roleName}).`,
      organization: {
        id: org?.id,
        name: org?.name,
        businessType: org?.businessType,
      },
      role: membership.roleName,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to test organization access",
    });
  }
});

export default router;
