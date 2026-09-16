import type { Request, Response, NextFunction } from "express";
import { prisma } from "../infrastructure/prisma.js";
import { MembershipStatus, RoleStatus, OrganizationStatus, UserStatus } from "../generated/prisma/enums.js";

export interface AuthenticatedUserContext {
  id: string;
  name?: string;
  email?: string;
  status?: UserStatus;
}

export interface ActiveMembershipContext {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
  status: MembershipStatus;
  permissions: string[];
}

// Extend Express Request type to carry tenant and user context
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserContext;
      organizationId?: string;
      membership?: ActiveMembershipContext;
    }
  }
}

/**
 * Extracts organizationId from route parameters (:orgId or :organizationId)
 * or HTTP header (x-organization-id).
 */
export function resolveOrganizationId(req: Request): string | undefined {
  const paramOrg = req.params.orgId || req.params.organizationId;
  const paramOrgId =
    typeof paramOrg === "string"
      ? paramOrg
      : Array.isArray(paramOrg)
      ? paramOrg[0]
      : undefined;

  const headerOrg = req.headers["x-organization-id"];
  const headerOrgId =
    typeof headerOrg === "string"
      ? headerOrg
      : Array.isArray(headerOrg)
      ? headerOrg[0]
      : undefined;

  return req.organizationId || paramOrgId || headerOrgId;
}

/**
 * Resolves the active permissions for a user within a specific organization.
 * Strictly scoped to the organization to enforce multi-tenant isolation.
 */
export async function getUserPermissions(
  userId: string,
  organizationId: string
): Promise<string[]> {
  if (!userId || !organizationId) {
    return [];
  }

  const membership = await prisma.membership.findUnique({
    where: {
      user_organization_unique: {
        userId,
        organizationId,
      },
    },
    include: {
      organization: true,
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // Verify membership is active, organization is active, and role is active
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    membership.organization.status !== OrganizationStatus.ACTIVE ||
    membership.role.status !== RoleStatus.ACTIVE
  ) {
    return [];
  }

  return membership.role.rolePermissions.map((rp) => rp.permission.name);
}

/**
 * Checks whether a user possesses a specific permission within an organization.
 * Authorization is permission-based (e.g. hasPermission("STOCK_UPDATE")), NOT role-name based.
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permissionName: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, organizationId);
  return permissions.includes(permissionName);
}

/**
 * Checks if user has at least one of the listed permissions.
 */
export async function hasAnyPermission(
  userId: string,
  organizationId: string,
  permissionNames: string[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, organizationId);
  return permissionNames.some((p) => permissions.includes(p));
}

/**
 * Middleware ensuring the authenticated user has an active membership in the target organization.
 * Rejects with 403 Forbidden on any cross-tenant attempt or inactive membership.
 */
export async function requireOrgMembership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication is required",
    });
    return;
  }

  const organizationId = resolveOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({
      error: "Bad Request",
      message: "Organization context ('x-organization-id' or route parameter) is required",
    });
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      user_organization_unique: {
        userId,
        organizationId,
      },
    },
    include: {
      organization: true,
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    res.status(403).json({
      error: "Forbidden",
      tenantAllowed: false,
      message: `Multi-Tenant Isolation Enforced: User ${req.user?.email || userId} has no active membership in organization ${organizationId}. Access denied.`,
    });
    return;
  }

  if (membership.organization.status !== OrganizationStatus.ACTIVE) {
    res.status(403).json({
      error: "Forbidden",
      message: `Organization account is ${membership.organization.status.toLowerCase()}. Access denied.`,
    });
    return;
  }

  req.organizationId = organizationId;
  req.membership = {
    id: membership.id,
    userId: membership.userId,
    organizationId: membership.organizationId,
    roleId: membership.roleId,
    roleName: membership.role.name,
    isSystemRole: membership.role.isSystem,
    status: membership.status,
    permissions: membership.role.rolePermissions.map((rp) => rp.permission.name),
  };

  next();
}

/**
 * Express middleware factory enforcing permission-based access control.
 * Derives organizationId and validates that the user possesses the required permission.
 */
export function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication is required to access this resource",
      });
      return;
    }

    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Organization context ('x-organization-id' or route parameter) is required",
      });
      return;
    }

    // Use cached membership permissions if already evaluated in the request lifecycle
    let permitted = false;
    if (req.membership && req.membership.organizationId === organizationId) {
      permitted = req.membership.permissions.includes(permissionName);
    } else {
      permitted = await hasPermission(userId, organizationId, permissionName);
    }

    if (!permitted) {
      res.status(403).json({
        error: "Forbidden",
        message: `User does not have permission '${permissionName}' in this organization`,
      });
      return;
    }

    req.organizationId = organizationId;
    next();
  };
}
