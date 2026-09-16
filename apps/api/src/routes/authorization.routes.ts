import { Router, type Request, type Response } from "express";
import { ALL_PERMISSIONS } from "../common/permissions.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, hasPermission, getUserPermissions } from "../middleware/authorization.js";
import { prisma } from "../infrastructure/prisma.js";

const router = Router({ mergeParams: true });

// All authorization test routes require active membership in the target organization
router.use(requireAuth, requireOrgMembership);

/**
 * GET /api/organizations/:orgId/permissions
 * Returns all system permissions plus the list of permissions granted to the caller.
 */
router.get("/permissions", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;
    const userPermissions = await getUserPermissions(userId, orgId);

    const membership = req.membership;

    res.status(200).json({
      allPermissions: ALL_PERMISSIONS,
      userPermissions,
      roleName: membership ? membership.roleName : "None",
      isOwner: membership?.roleName === "Owner",
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to get permissions",
    });
  }
});

/**
 * POST /api/organizations/:orgId/check-permission
 * Live test of hasPermission(userId, orgId, permission)
 */
router.post("/check-permission", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const { permission } = req.body;

    if (!permission || typeof permission !== "string") {
      res.status(400).json({
        error: "Bad Request",
        message: "permission string is required",
      });
      return;
    }

    const userId = req.user!.id;
    const allowed = await hasPermission(userId, orgId, permission.trim());

    res.status(200).json({
      permission: permission.trim(),
      allowed,
      statusCode: allowed ? 200 : 403,
      message: allowed
        ? `ALLOW: User possesses permission '${permission}' in this organization`
        : `DENY: User lacks permission '${permission}' in this organization`,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to check permission",
    });
  }
});

/**
 * POST /api/organizations/:orgId/check-all
 * Evaluates all 23 permissions for the current user and returns a status map.
 */
router.post("/check-all", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;
    const userPermissions = await getUserPermissions(userId, orgId);
    const userPermSet = new Set(userPermissions);

    const results: Record<string, boolean> = {};
    for (const perm of ALL_PERMISSIONS) {
      results[perm.name] = userPermSet.has(perm.name);
    }

    res.status(200).json({
      results,
      grantedCount: userPermissions.length,
      totalCount: ALL_PERMISSIONS.length,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to check all permissions",
    });
  }
});

/**
 * GET /api/organizations/:orgId/matrix
 * Returns the entire role-vs-permission matrix for this organization.
 */
router.get("/matrix", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;

    const roles = await prisma.role.findMany({
      where: { organizationId: orgId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    const matrixRoles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      permissions: r.rolePermissions.map((rp) => rp.permission.name),
    }));

    res.status(200).json({
      allPermissions: ALL_PERMISSIONS,
      roles: matrixRoles,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to generate permission matrix",
    });
  }
});

export default router;
