import { Router, type Request, type Response } from "express";
import { prisma } from "../infrastructure/prisma.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, requirePermission } from "../middleware/authorization.js";
import { OrganizationService } from "../modules/organization/organization.service.js";

const router = Router({ mergeParams: true });

// All role routes require valid caller membership in the target organization
router.use(requireAuth, requireOrgMembership);

/**
 * GET /api/organizations/:orgId/roles
 * Lists all organization-scoped roles with assigned permissions and member counts.
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
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
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    res.status(200).json({
      roles: roles.map((role) => ({
        id: role.id,
        organizationId: role.organizationId,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        status: role.status,
        memberCount: role._count.memberships,
        permissionCount: role.rolePermissions.length,
        permissions: role.rolePermissions.map((rp) => rp.permission.name),
        createdAt: role.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to list organization roles",
    });
  }
});

/**
 * GET /api/organizations/:orgId/roles/:roleId
 * Returns single role details with associated permissions.
 */
router.get("/:roleId", async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const roleId = typeof req.params.roleId === "string" ? req.params.roleId : req.params.roleId?.[0];

    if (!roleId) {
      res.status(400).json({ error: "Bad Request", message: "Missing roleId parameter" });
      return;
    }

    const role = await prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!role) {
      res.status(404).json({
        error: "Not Found",
        message: `Role ${roleId} not found in organization ${orgId}`,
      });
      return;
    }

    res.status(200).json({
      role: {
        id: role.id,
        organizationId: role.organizationId,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        status: role.status,
        memberCount: role._count.memberships,
        permissions: role.rolePermissions.map((rp) => rp.permission.name),
        createdAt: role.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to get role details",
    });
  }
});

/**
 * POST /api/organizations/:orgId/roles
 * Creates an organization-specific custom role with customizable permissions.
 * Guarded by ORGANIZATION_MANAGE.
 */
router.post("/", requirePermission("ORGANIZATION_MANAGE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const { name, description, permissions } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({
        error: "Bad Request",
        message: "Role name is required",
      });
      return;
    }

    // Check if role name already exists in this organization
    const existing = await prisma.role.findFirst({
      where: { organizationId: orgId, name: name.trim() },
    });

    if (existing) {
      res.status(409).json({
        error: "Conflict",
        message: `A role named '${name.trim()}' already exists in this organization`,
      });
      return;
    }

    const role = await OrganizationService.createCustomRole({
      organizationId: orgId,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      permissions: Array.isArray(permissions) ? permissions : [],
    });

    // Re-fetch with permissions for full response
    const createdWithPerms = await prisma.role.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    res.status(201).json({
      message: `Custom role '${name}' created successfully`,
      role: {
        id: createdWithPerms!.id,
        name: createdWithPerms!.name,
        description: createdWithPerms!.description,
        isSystem: createdWithPerms!.isSystem,
        permissions: createdWithPerms!.rolePermissions.map((rp) => rp.permission.name),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to create custom role",
    });
  }
});

/**
 * PUT /api/organizations/:orgId/roles/:roleId/permissions
 * Updates the permission assignments for an organization role.
 * Guarded by ORGANIZATION_MANAGE.
 */
router.put("/:roleId/permissions", requirePermission("ORGANIZATION_MANAGE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const roleId = typeof req.params.roleId === "string" ? req.params.roleId : req.params.roleId?.[0];
    const { permissions } = req.body;

    if (!roleId || !Array.isArray(permissions)) {
      res.status(400).json({
        error: "Bad Request",
        message: "Valid permissions array is required",
      });
      return;
    }

    const result = await OrganizationService.updateRolePermissions(
      orgId,
      roleId,
      permissions
    );

    res.status(200).json({
      message: "Role permissions updated successfully",
      roleId: result.roleId,
      permissions: result.updatedPermissions,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to update role permissions",
    });
  }
});

/**
 * DELETE /api/organizations/:orgId/roles/:roleId
 * Deletes a custom role from the organization.
 * System default roles and roles with active assigned members cannot be deleted.
 * Guarded by ORGANIZATION_MANAGE.
 */
router.delete("/:roleId", requirePermission("ORGANIZATION_MANAGE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const roleId = typeof req.params.roleId === "string" ? req.params.roleId : req.params.roleId?.[0];

    if (!roleId) {
      res.status(400).json({ error: "Bad Request", message: "Missing roleId parameter" });
      return;
    }

    const role = await prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
      include: {
        _count: {
          select: { memberships: true, invitations: true },
        },
      },
    });

    if (!role) {
      res.status(404).json({
        error: "Not Found",
        message: `Role ${roleId} not found in this organization`,
      });
      return;
    }

    if (role.isSystem) {
      res.status(400).json({
        error: "Bad Request",
        message: `System default role '${role.name}' cannot be deleted`,
      });
      return;
    }

    if (role._count.memberships > 0) {
      res.status(400).json({
        error: "Bad Request",
        message: `Cannot delete role '${role.name}' because ${role._count.memberships} active member(s) are assigned to it. Reassign members first.`,
      });
      return;
    }

    await prisma.role.delete({
      where: { id: role.id },
    });

    res.status(200).json({
      message: `Role '${role.name}' deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to delete role",
    });
  }
});

export default router;
