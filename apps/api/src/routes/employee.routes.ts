import { Router, type Request, type Response } from "express";
import { prisma } from "../infrastructure/prisma.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireOrgMembership, requirePermission } from "../middleware/authorization.js";
import { OrganizationService } from "../modules/organization/organization.service.js";
import { MembershipStatus, UserStatus } from "../generated/prisma/enums.js";
import { hashPassword } from "../common/password.js";

const router = Router({ mergeParams: true });

// All employee routes require valid caller membership in the target organization
router.use(requireAuth, requireOrgMembership);

/**
 * GET /api/organizations/:orgId/employees
 * Lists all members and pending invitations for the organization.
 * Guarded by EMPLOYEE_VIEW.
 */
router.get("/", requirePermission("EMPLOYEE_VIEW"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;

    const members = await prisma.membership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const invitations = await prisma.employeeInvitation.findMany({
      where: { organizationId: orgId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        roleId: m.role.id,
        roleName: m.role.name,
        isSystemRole: m.role.isSystem,
        status: m.status,
        joinedAt: m.createdAt,
      })),
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        roleId: inv.role.id,
        roleName: inv.role.name,
        status: inv.status,
        expiresAt: inv.expiresAt,
        invitedBy: inv.invitedBy ? inv.invitedBy.name : null,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to list organization employees",
    });
  }
});

/**
 * POST /api/organizations/:orgId/employees
 * Directly registers/onboards an employee into the organization.
 * Guarded by EMPLOYEE_CREATE.
 */
router.post("/", requirePermission("EMPLOYEE_CREATE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const { name, email, password, roleId } = req.body;

    if (!name || !email || !password || !roleId) {
      res.status(400).json({
        error: "Bad Request",
        message: "name, email, password, and roleId are required",
      });
      return;
    }

    // Verify role belongs to this organization
    const role = await prisma.role.findFirst({
      where: { id: roleId.trim(), organizationId: orgId },
    });

    if (!role) {
      res.status(400).json({
        error: "Cross-Tenant Violation Blocked",
        crossTenantBlocked: true,
        message: `Role '${roleId}' does not belong to organization '${orgId}'`,
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already has membership in this organization
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          user_organization_unique: {
            userId: user.id,
            organizationId: orgId,
          },
        },
      });

      if (existingMembership) {
        res.status(409).json({
          error: "Conflict",
          message: `User '${normalizedEmail}' is already a member of this organization`,
        });
        return;
      }
    } else {
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          status: UserStatus.ACTIVE,
        },
      });
    }

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        roleId: role.id,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        user: true,
        role: true,
      },
    });

    res.status(201).json({
      message: `Employee '${user.name}' onboarded successfully`,
      member: {
        id: membership.id,
        userId: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        roleId: membership.role.id,
        roleName: membership.role.name,
        isSystemRole: membership.role.isSystem,
        status: membership.status,
        joinedAt: membership.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to create employee",
    });
  }
});

/**
 * POST /api/organizations/:orgId/employees/invitations
 * Creates an employee invitation, enforcing organization-scoped role isolation.
 * Guarded by EMPLOYEE_INVITE.
 */
router.post("/invitations", requirePermission("EMPLOYEE_INVITE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const { email, roleId } = req.body;

    if (!email || !roleId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Email and roleId are required",
      });
      return;
    }

    try {
      const result = await OrganizationService.createEmployeeInvitation({
        organizationId: orgId,
        email: email.trim(),
        roleId: roleId.trim(),
        invitedById: req.user!.id,
      });

      const role = await prisma.role.findUnique({
        where: { id: roleId },
      });

      res.status(201).json({
        message: `Invitation sent to ${email}`,
        invitation: {
          id: result.invitation.id,
          email: result.invitation.email,
          roleId: result.invitation.roleId,
          roleName: role ? role.name : "Unknown",
          status: result.invitation.status,
          expiresAt: result.invitation.expiresAt,
          rawToken: result.rawToken,
        },
      });
    } catch (inviteError: any) {
      // Catch cross-tenant role validation failure (app-level or Prisma foreign key P2003)
      if (
        inviteError.message?.includes("does not belong to organization") ||
        inviteError.code === "P2003"
      ) {
        res.status(400).json({
          error: "Cross-Tenant Violation Blocked",
          crossTenantBlocked: true,
          message: `Security rejection: Role '${roleId}' does not belong to organization '${orgId}'. Cross-tenant role assignment is forbidden.`,
        });
        return;
      }
      throw inviteError;
    }
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to create invitation",
    });
  }
});

/**
 * PUT /api/organizations/:orgId/employees/:memberId/role
 * Updates an organization member's assigned role.
 * Guarded by EMPLOYEE_UPDATE.
 */
router.put("/:memberId/role", requirePermission("EMPLOYEE_UPDATE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const memberId = typeof req.params.memberId === "string" ? req.params.memberId : req.params.memberId?.[0];
    const { roleId } = req.body;

    if (!memberId || !roleId) {
      res.status(400).json({
        error: "Bad Request",
        message: "memberId and roleId are required",
      });
      return;
    }

    // Verify member belongs to this organization
    const member = await prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { role: true },
    });

    if (!member) {
      res.status(404).json({
        error: "Not Found",
        message: `Member ${memberId} not found in this organization`,
      });
      return;
    }

    // Verify new role belongs to this organization
    const targetRole = await prisma.role.findFirst({
      where: { id: roleId.trim(), organizationId: orgId },
    });

    if (!targetRole) {
      res.status(400).json({
        error: "Cross-Tenant Violation Blocked",
        crossTenantBlocked: true,
        message: `Role '${roleId}' does not belong to organization '${orgId}'`,
      });
      return;
    }

    // Safeguard: Ensure at least one active Owner remains
    if (member.role.name === "Owner" && targetRole.name !== "Owner") {
      const activeOwnerCount = await prisma.membership.count({
        where: {
          organizationId: orgId,
          role: { name: "Owner" },
          status: MembershipStatus.ACTIVE,
        },
      });

      if (activeOwnerCount <= 1) {
        res.status(400).json({
          error: "Bad Request",
          message: "Cannot change role: Organization must retain at least one active Owner",
        });
        return;
      }
    }

    const updated = await prisma.membership.update({
      where: { id: memberId },
      data: { roleId: targetRole.id },
      include: {
        user: true,
        role: true,
      },
    });

    res.status(200).json({
      message: `Role updated to '${targetRole.name}' for ${updated.user.name}`,
      member: {
        id: updated.id,
        userId: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        roleId: updated.role.id,
        roleName: updated.role.name,
        isSystemRole: updated.role.isSystem,
        status: updated.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to update member role",
    });
  }
});

/**
 * PATCH /api/organizations/:orgId/employees/:memberId/status
 * Updates an organization member's membership status (ACTIVE, INACTIVE, SUSPENDED).
 * Guarded by EMPLOYEE_UPDATE.
 */
router.patch("/:memberId/status", requirePermission("EMPLOYEE_UPDATE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const memberId = typeof req.params.memberId === "string" ? req.params.memberId : req.params.memberId?.[0];
    const { status } = req.body;

    if (!memberId || !status || !Object.values(MembershipStatus).includes(status)) {
      res.status(400).json({
        error: "Bad Request",
        message: "Valid memberId and status (ACTIVE, INACTIVE, SUSPENDED) are required",
      });
      return;
    }

    const member = await prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { role: true },
    });

    if (!member) {
      res.status(404).json({
        error: "Not Found",
        message: `Member ${memberId} not found in this organization`,
      });
      return;
    }

    // Safeguard: Do not deactivate the sole remaining Owner
    if (member.role.name === "Owner" && status !== MembershipStatus.ACTIVE) {
      const activeOwnerCount = await prisma.membership.count({
        where: {
          organizationId: orgId,
          role: { name: "Owner" },
          status: MembershipStatus.ACTIVE,
        },
      });

      if (activeOwnerCount <= 1) {
        res.status(400).json({
          error: "Bad Request",
          message: "Cannot deactivate sole remaining Owner of the organization",
        });
        return;
      }
    }

    const updated = await prisma.membership.update({
      where: { id: memberId },
      data: { status },
      include: { user: true, role: true },
    });

    res.status(200).json({
      message: `Member status updated to ${status}`,
      member: {
        id: updated.id,
        userId: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        status: updated.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to update member status",
    });
  }
});

/**
 * DELETE /api/organizations/:orgId/employees/:memberId
 * Removes an employee membership from the organization.
 * Guarded by EMPLOYEE_REMOVE.
 */
router.delete("/:memberId", requirePermission("EMPLOYEE_REMOVE"), async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId!;
    const memberId = typeof req.params.memberId === "string" ? req.params.memberId : req.params.memberId?.[0];

    if (!memberId) {
      res.status(400).json({ error: "Bad Request", message: "Missing memberId parameter" });
      return;
    }

    const member = await prisma.membership.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { role: true, user: true },
    });

    if (!member) {
      res.status(404).json({
        error: "Not Found",
        message: `Member ${memberId} not found in this organization`,
      });
      return;
    }

    // Safeguard: Cannot remove the sole remaining Owner
    if (member.role.name === "Owner") {
      const activeOwnerCount = await prisma.membership.count({
        where: {
          organizationId: orgId,
          role: { name: "Owner" },
          status: MembershipStatus.ACTIVE,
        },
      });

      if (activeOwnerCount <= 1) {
        res.status(400).json({
          error: "Bad Request",
          message: "Cannot remove sole remaining Owner from the organization",
        });
        return;
      }
    }

    await prisma.membership.delete({
      where: { id: memberId },
    });

    res.status(200).json({
      message: `Member '${member.user.name}' removed from organization`,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to remove member",
    });
  }
});

export default router;
