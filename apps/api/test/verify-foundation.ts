import { prisma } from "../src/infrastructure/prisma.js";
import { UserStatus, OrganizationStatus, MembershipStatus, InvitationStatus } from "../src/generated/prisma/enums.js";

async function verify() {
  console.log("==================================================");
  console.log("🧪 STARTING IDENTITY & BUSINESS FOUNDATION VERIFICATION");
  console.log("==================================================");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedTests++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Seeded Roles & Permissions
  // ----------------------------------------------------
  console.log("\n--- Test 1: Verify Seeded Roles and Permissions ---");
  const expectedRoles = [
    "OWNER",
    "MANAGER",
    "INVENTORY_MANAGER",
    "SALES_EXECUTIVE",
    "ACCOUNTANT",
    "EMPLOYEE",
  ];

  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  });

  assert(roles.length >= 6, `Found ${roles.length} roles (expected at least 6)`);
  for (const r of expectedRoles) {
    const found = roles.find((role) => role.name === r);
    assert(!!found, `Role "${r}" exists`);
  }

  const ownerRole = roles.find((r) => r.name === "OWNER");
  assert(
    !!ownerRole && ownerRole.rolePermissions.length === 13,
    `OWNER has all 13 permissions (found ${ownerRole?.rolePermissions.length})`
  );

  const inventoryManagerRole = roles.find((r) => r.name === "INVENTORY_MANAGER");
  const imPermissions = inventoryManagerRole?.rolePermissions.map((rp) => rp.permission.name) || [];
  assert(
    imPermissions.includes("STOCK_ADJUST") && imPermissions.includes("PRODUCT_CREATE"),
    `INVENTORY_MANAGER has STOCK_ADJUST and PRODUCT_CREATE permissions`
  );

  const employeeRole = roles.find((r) => r.name === "EMPLOYEE");
  assert(
    !!employeeRole && employeeRole.rolePermissions.length === 2,
    `EMPLOYEE has basic view permissions (found ${employeeRole?.rolePermissions.length})`
  );

  // ----------------------------------------------------
  // TEST 2: Multi-Tenancy (Multiple Orgs in Same Schema)
  // ----------------------------------------------------
  console.log("\n--- Test 2: Create Multiple Organizations (Multi-Tenancy) ---");
  const orgA = await prisma.organization.create({
    data: {
      name: "Apex Electronics Corp",
      status: OrganizationStatus.ACTIVE,
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: "Summit Retailers Ltd",
      status: OrganizationStatus.ACTIVE,
    },
  });

  assert(!!orgA.id && !!orgB.id, "Both organizations created successfully with UUIDs");
  assert(orgA.id !== orgB.id, "Organization IDs are distinct");

  // ----------------------------------------------------
  // TEST 3: User & Membership Creation and Traversal
  // ----------------------------------------------------
  console.log("\n--- Test 3: User Creation & Organization Membership ---");
  const testEmail = `test.user.${Date.now()}@smartinventory.io`;
  const user = await prisma.user.create({
    data: {
      name: "Alex Mercer",
      email: testEmail,
      passwordHash: "$2b$12$e8xO5r...mockPasswordHash",
      status: UserStatus.ACTIVE,
    },
  });

  assert(!!user.id, `User created with ID ${user.id}`);

  // Add User as OWNER in Org A
  const membershipA = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: orgA.id,
      roleId: ownerRole!.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  assert(!!membershipA.id, "Membership in Org A created with role OWNER");

  // Verify full relationship traversal: User -> Membership -> Organization & Role -> Permission
  const userWithMemberships = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      memberships: {
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
      },
    },
  });

  assert(
    userWithMemberships?.memberships.length === 1 &&
      userWithMemberships.memberships[0]?.organization.name === "Apex Electronics Corp",
    "User -> Membership -> Organization relationship resolved correctly"
  );

  assert(
    userWithMemberships?.memberships[0]?.role.name === "OWNER" &&
      userWithMemberships.memberships[0].role.rolePermissions.length === 13,
    "Membership -> Role -> RolePermission -> Permission resolved correctly"
  );

  // ----------------------------------------------------
  // TEST 4: Multi-Tenant Membership (Same User in Org B)
  // ----------------------------------------------------
  console.log("\n--- Test 4: User Joins Second Organization With Different Role ---");
  const managerRole = roles.find((r) => r.name === "MANAGER")!;
  const membershipB = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: orgB.id,
      roleId: managerRole.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  assert(!!membershipB.id, "User successfully assigned membership in Org B as MANAGER");

  const multiOrgCheck = await prisma.membership.findMany({
    where: { userId: user.id },
  });
  assert(
    multiOrgCheck.length === 2,
    `User has ${multiOrgCheck.length} distinct memberships across organizations`
  );

  // ----------------------------------------------------
  // TEST 5: Unique Constraint (Prevent Duplicate Memberships)
  // ----------------------------------------------------
  console.log("\n--- Test 5: Prevent Duplicate Memberships in Same Organization ---");
  let duplicatePrevented = false;
  try {
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: orgA.id,
        roleId: employeeRole!.id,
        status: MembershipStatus.ACTIVE,
      },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      duplicatePrevented = true;
    }
  }
  assert(
    duplicatePrevented,
    "Duplicate membership for (userId, organizationId) prevented by unique constraint (P2002)"
  );

  // ----------------------------------------------------
  // TEST 6: Employee Invitation
  // ----------------------------------------------------
  console.log("\n--- Test 6: Employee Invitation ---");
  const invitation = await prisma.employeeInvitation.create({
    data: {
      organizationId: orgA.id,
      email: "new.hire@example.com",
      roleId: employeeRole!.id,
      tokenHash: "inv_token_hash_abc123xyz789",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: InvitationStatus.PENDING,
      invitedById: user.id,
    },
    include: {
      organization: true,
      role: true,
      invitedBy: true,
    },
  });

  assert(
    invitation.organization.name === "Apex Electronics Corp" &&
      invitation.role.name === "EMPLOYEE" &&
      invitation.invitedBy?.email === testEmail,
    "EmployeeInvitation successfully created and navigates to Organization, Role, and Inviting User"
  );

  // ----------------------------------------------------
  // TEST 7: Referential Action (Restrict Deleting In-Use Role)
  // ----------------------------------------------------
  console.log("\n--- Test 7: Referential Action - Restricted Role Deletion ---");
  let roleDeleteRestricted = false;
  try {
    await prisma.role.delete({
      where: { id: employeeRole!.id },
    });
  } catch (err: any) {
    if (err.code === "P2003" || err.code === "P2014") {
      roleDeleteRestricted = true;
    }
  }
  assert(
    roleDeleteRestricted,
    "Role deletion restricted (onDelete: Restrict) when referenced by active memberships/invitations"
  );

  // ----------------------------------------------------
  // CLEANUP TEST DATA
  // ----------------------------------------------------
  console.log("\n--- Cleanup Test Records ---");
  // Deleting organizations cascades to delete memberships and invitations
  await prisma.organization.delete({ where: { id: orgA.id } });
  await prisma.organization.delete({ where: { id: orgB.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("  ✓ Cleaned up test organizations and user (cascaded cleanly)");

  console.log("\n==================================================");
  console.log(`🏁 VERIFICATION SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log("==================================================");

  if (failedTests > 0) {
    throw new Error(`${failedTests} verification tests failed!`);
  }
}

verify()
  .catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
