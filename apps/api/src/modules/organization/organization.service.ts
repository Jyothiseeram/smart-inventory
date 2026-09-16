import { prisma } from "../../infrastructure/prisma.js";
import { BusinessType, MembershipStatus, InvitationStatus } from "../../generated/prisma/enums.js";
import { getRoleTemplatesForBusinessType } from "./role-templates.js";
import crypto from "node:crypto";

export interface CreateOrganizationInput {
  name: string;
  businessType?: BusinessType;
  ownerUserId: string;
}

export interface CreateCustomRoleInput {
  organizationId: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface CreateInvitationInput {
  organizationId: string;
  email: string;
  roleId: string;
  invitedById: string;
  expiresInDays?: number;
}

export class OrganizationService {
  /**
   * Atomically creates an organization, provisions its organization-scoped
   * default roles according to the business type, and assigns the creator to the Owner role.
   */
  static async createOrganizationWithDefaults(input: CreateOrganizationInput) {
    const businessType = input.businessType || BusinessType.GENERAL;
    const templates = getRoleTemplatesForBusinessType(businessType);

    return prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: input.name,
          businessType,
        },
      });

      // 2. Load all available permissions for mapping
      const allPermissions = await tx.permission.findMany();
      const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

      let ownerRoleId: string | null = null;
      const createdRoles = [];

      // 3. Provision organization-specific roles from templates
      for (const tpl of templates) {
        const role = await tx.role.create({
          data: {
            organizationId: org.id,
            name: tpl.name,
            description: tpl.description,
            isSystem: tpl.isSystem || false,
          },
        });

        createdRoles.push(role);
        if (tpl.isSystem && tpl.name === "Owner") {
          ownerRoleId = role.id;
        }

        // Connect permissions for this role
        const validPermissionIds = tpl.permissions
          .map((permName) => permissionMap.get(permName))
          .filter((id): id is string => Boolean(id));

        if (validPermissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: validPermissionIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
            })),
          });
        }
      }

      if (!ownerRoleId) {
        throw new Error("Failed to provision Owner role for organization");
      }

      // 4. Provision organization-scoped default units of measure
      const defaultUnits = [
        { name: "Piece", code: "pc", description: "Individual unit/piece" },
        { name: "Box", code: "box", description: "Box or package container" },
        { name: "Kilogram", code: "kg", description: "Metric weight in kilograms" },
        { name: "Gram", code: "g", description: "Metric weight in grams" },
        { name: "Liter", code: "l", description: "Liquid volume in liters" },
        { name: "Meter", code: "m", description: "Linear length in meters" },
      ];

      for (const unit of defaultUnits) {
        await tx.unit.create({
          data: {
            organizationId: org.id,
            name: unit.name,
            code: unit.code,
            description: unit.description,
          },
        });
      }

      // 5. Assign Owner Membership to the creator User
      const membership = await tx.membership.create({
        data: {
          userId: input.ownerUserId,
          organizationId: org.id,
          roleId: ownerRoleId,
          status: MembershipStatus.ACTIVE,
        },
      });

      return {
        organization: org,
        roles: createdRoles,
        ownerMembership: membership,
      };
    });
  }

  /**
   * Creates an organization-specific custom role with customizable permissions.
   */
  static async createCustomRole(input: CreateCustomRoleInput) {
    return prisma.$transaction(async (tx) => {
      // Ensure organization exists
      const org = await tx.organization.findUnique({
        where: { id: input.organizationId },
      });
      if (!org) {
        throw new Error(`Organization with ID ${input.organizationId} not found`);
      }

      // Create role
      const role = await tx.role.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          isSystem: false,
        },
      });

      // Map permissions
      if (input.permissions.length > 0) {
        const matchedPermissions = await tx.permission.findMany({
          where: { name: { in: input.permissions } },
        });

        await tx.rolePermission.createMany({
          data: matchedPermissions.map((perm) => ({
            roleId: role.id,
            permissionId: perm.id,
          })),
        });
      }

      return role;
    });
  }

  /**
   * Updates permission mappings for an organization's role.
   */
  static async updateRolePermissions(
    organizationId: string,
    roleId: string,
    permissions: string[]
  ) {
    return prisma.$transaction(async (tx) => {
      // Validate role belongs to this organization
      const role = await tx.role.findFirst({
        where: { id: roleId, organizationId },
      });

      if (!role) {
        throw new Error(
          `Role ${roleId} does not exist in organization ${organizationId}`
        );
      }

      // Delete existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Add new permissions
      const matched = await tx.permission.findMany({
        where: { name: { in: permissions } },
      });

      if (matched.length > 0) {
        await tx.rolePermission.createMany({
          data: matched.map((perm) => ({
            roleId,
            permissionId: perm.id,
          })),
        });
      }

      return { roleId, updatedPermissions: matched.map((p) => p.name) };
    });
  }

  /**
   * Creates an employee invitation, validating that roleId belongs to organizationId.
   */
  static async createEmployeeInvitation(input: CreateInvitationInput) {
    // Multi-tenant validation: ensure role belongs to the organization
    const role = await prisma.role.findFirst({
      where: {
        id: input.roleId,
        organizationId: input.organizationId,
      },
    });

    if (!role) {
      throw new Error(
        `Role ${input.roleId} does not belong to organization ${input.organizationId}`
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const days = input.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invitation = await prisma.employeeInvitation.create({
      data: {
        organizationId: input.organizationId,
        email: input.email.toLowerCase().trim(),
        roleId: input.roleId,
        tokenHash,
        expiresAt,
        status: InvitationStatus.PENDING,
        invitedById: input.invitedById,
      },
    });

    return {
      invitation,
      rawToken: token,
    };
  }
}
