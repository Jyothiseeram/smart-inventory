import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../infrastructure/prisma.js";
import { OrganizationService } from "../modules/organization/organization.service.js";
import { BusinessType, MembershipStatus, UserStatus, InvitationStatus } from "../generated/prisma/enums.js";
import { requireAuth } from "../middleware/authenticate.js";
import { hashPassword, verifyPassword } from "../common/password.js";

const router = Router();

async function createSessionForUser(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * POST /api/auth/register-org
 * Atomically registers a User and Organization, provisions default roles from BusinessType,
 * assigns creator to Owner role, and creates session.
 */
router.post("/register-org", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userName, email, password, organizationName, businessType } = req.body;

    if (!userName || !email || !password || !organizationName) {
      res.status(400).json({
        error: "Bad Request",
        message: "userName, email, password, and organizationName are required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: userName.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Validate or default businessType
    const validBusinessType = Object.values(BusinessType).includes(businessType)
      ? (businessType as BusinessType)
      : BusinessType.GENERAL;

    // Create organization with business-type default roles
    const setup = await OrganizationService.createOrganizationWithDefaults({
      name: organizationName.trim(),
      businessType: validBusinessType,
      ownerUserId: user.id,
    });

    const token = await createSessionForUser(user.id);

    // Fetch user memberships
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      include: {
        organization: true,
        role: true,
      },
    });

    res.status(201).json({
      message: "Organization and owner registered successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
      organization: setup.organization,
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        businessType: m.organization.businessType,
        roleId: m.roleId,
        roleName: m.role.name,
        isSystemRole: m.role.isSystem,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to register organization",
    });
  }
});

/**
 * POST /api/auth/login
 * Verifies email/password and returns user with all active memberships/organizations.
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
      return;
    }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        error: "Forbidden",
        message: `Account is ${user.status.toLowerCase()}. Please contact support or your organization owner.`,
      });
      return;
    }

    const token = await createSessionForUser(user.id);

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      include: {
        organization: true,
        role: true,
      },
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        businessType: m.organization.businessType,
        roleId: m.roleId,
        roleName: m.role.name,
        isSystemRole: m.role.isSystem,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to log in",
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroys the current session from the database.
 */
router.post("/logout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    let tokenHash = req.sessionTokenHash;

    if (!tokenHash) {
      const authHeader = req.headers.authorization;
      const tokenHeader =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : typeof req.headers["x-session-token"] === "string"
          ? req.headers["x-session-token"]
          : undefined;

      if (tokenHeader) {
        tokenHash = crypto
          .createHash("sha256")
          .update(tokenHeader)
          .digest("hex");
      }
    }

    if (tokenHash) {
      await prisma.session.deleteMany({
        where: { tokenHash },
      });
    }

    res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to logout",
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and their active organizations.
 */
router.get("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "Not Found", message: "User not found" });
      return;
    }

    if (user.status !== UserStatus.ACTIVE) {
      res.status(403).json({
        error: "Forbidden",
        message: `Account is ${user.status.toLowerCase()}. Access denied.`,
      });
      return;
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.ACTIVE },
      include: {
        organization: true,
        role: true,
      },
    });

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        businessType: m.organization.businessType,
        roleId: m.roleId,
        roleName: m.role.name,
        isSystemRole: m.role.isSystem,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to retrieve user context",
    });
  }
});

/**
 * POST /api/auth/accept-invitation
 * Validates invitation token, registers/links user account, creates organization membership,
 * updates invitation status to ACCEPTED, and returns authentication session.
 */
router.post("/accept-invitation", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, name, password } = req.body;

    if (!token || !password) {
      res.status(400).json({
        error: "Bad Request",
        message: "Invitation token and password are required",
      });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const invitation = await prisma.employeeInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!invitation) {
      res.status(404).json({
        error: "Not Found",
        message: "Invalid invitation token",
      });
      return;
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      res.status(400).json({
        error: "Bad Request",
        message: `Invitation has already been ${invitation.status.toLowerCase()}`,
      });
      return;
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.employeeInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      res.status(400).json({
        error: "Bad Request",
        message: "Invitation has expired",
      });
      return;
    }

    // Atomic user creation/connection, membership assignment, and invitation update
    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            name: (name || invitation.email.split("@")[0]).trim(),
            email: invitation.email,
            passwordHash: hashPassword(password),
            status: UserStatus.ACTIVE,
          },
        });
      } else if (user.status !== UserStatus.ACTIVE) {
        throw new Error("User account is inactive or suspended");
      }

      // Check if membership already exists
      const existingMembership = await tx.membership.findUnique({
        where: {
          user_organization_unique: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        },
      });

      let membership = existingMembership;
      if (!membership) {
        membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: invitation.organizationId,
            roleId: invitation.roleId,
            status: MembershipStatus.ACTIVE,
          },
        });
      }

      await tx.employeeInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return { user, membership };
    });

    const sessionToken = await createSessionForUser(result.user.id);

    const memberships = await prisma.membership.findMany({
      where: { userId: result.user.id, status: MembershipStatus.ACTIVE },
      include: {
        organization: true,
        role: true,
      },
    });

    res.status(200).json({
      message: `Successfully joined ${invitation.organization.name}`,
      token: sessionToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        status: result.user.status,
      },
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        businessType: invitation.organization.businessType,
      },
      role: invitation.role.name,
      memberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        businessType: m.organization.businessType,
        roleId: m.roleId,
        roleName: m.role.name,
        isSystemRole: m.role.isSystem,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Failed to accept invitation",
    });
  }
});

export default router;
