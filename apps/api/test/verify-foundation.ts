import { prisma } from "../src/infrastructure/prisma.js";
import {
  UserStatus,
  BusinessType,
  MembershipStatus,
  InvitationStatus,
} from "../src/generated/prisma/enums.js";
import { OrganizationService } from "../src/modules/organization/organization.service.js";
import {
  hasPermission,
  getUserPermissions,
} from "../src/middleware/authorization.js";

async function verify() {
  console.log("==================================================");
  console.log("🧪 VERIFYING ORGANIZATION-SCOPED CUSTOMIZABLE RBAC");
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

  // Pre-test cleanup of any previous test records
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: ".test" } } });

  // ----------------------------------------------------
  // TEST 1: System Permissions Verification
  // ----------------------------------------------------
  console.log("\n--- Test 1: Verify Global System Permissions ---");
  const totalPermissions = await prisma.permission.count();
  assert(
    totalPermissions === 23,
    `Total permissions registered in database: ${totalPermissions} (expected 23)`
  );

  // ----------------------------------------------------
  // TEST 2: Business Type Default Role Templates
  // ----------------------------------------------------
  console.log("\n--- Test 2: Create Organizations with Business Type Role Templates ---");
  const ownerUser1 = await prisma.user.create({
    data: {
      name: "Dr. Sarah Adams",
      email: `sarah.adams.${Date.now()}@pharmacy.test`,
      passwordHash: "mock_hash_1",
      status: UserStatus.ACTIVE,
    },
  });

  const ownerUser2 = await prisma.user.create({
    data: {
      name: "Marcus Vance",
      email: `marcus.vance.${Date.now()}@electronics.test`,
      passwordHash: "mock_hash_2",
      status: UserStatus.ACTIVE,
    },
  });

  // Org 1: Medical Store
  const medicalSetup = await OrganizationService.createOrganizationWithDefaults({
    name: "St. Jude Pharmacy",
    businessType: BusinessType.MEDICAL,
    ownerUserId: ownerUser1.id,
  });

  // Org 2: Electronics Store
  const electronicsSetup = await OrganizationService.createOrganizationWithDefaults({
    name: "Nova Electronics Lab",
    businessType: BusinessType.ELECTRONICS,
    ownerUserId: ownerUser2.id,
  });

  const medRoles = await prisma.role.findMany({
    where: { organizationId: medicalSetup.organization.id },
  });
  const medRoleNames = medRoles.map((r) => r.name);
  assert(
    medRoleNames.includes("Owner") &&
      medRoleNames.includes("Pharmacist") &&
      medRoleNames.includes("Billing Staff") &&
      medRoleNames.includes("Inventory Staff"),
    `Medical Store created with expected roles: ${medRoleNames.join(", ")}`
  );

  const elecRoles = await prisma.role.findMany({
    where: { organizationId: electronicsSetup.organization.id },
  });
  const elecRoleNames = elecRoles.map((r) => r.name);
  assert(
    elecRoleNames.includes("Owner") &&
      elecRoleNames.includes("Store Manager") &&
      elecRoleNames.includes("Technician") &&
      elecRoleNames.includes("Sales Staff") &&
      elecRoleNames.includes("Inventory Staff"),
    `Electronics Store created with expected roles: ${elecRoleNames.join(", ")}`
  );

  // ----------------------------------------------------
  // TEST 3: Owner Role Full Access
  // ----------------------------------------------------
  console.log("\n--- Test 3: Owner Receives Full Permissions for Organization ---");
  const medicalOwnerPerms = await getUserPermissions(
    ownerUser1.id,
    medicalSetup.organization.id
  );
  assert(
    medicalOwnerPerms.length === 23,
    `Owner has all 23 permissions in St. Jude Pharmacy (found ${medicalOwnerPerms.length})`
  );

  const elecOwnerPerms = await getUserPermissions(
    ownerUser2.id,
    electronicsSetup.organization.id
  );
  assert(
    elecOwnerPerms.length === 23,
    `Owner has all 23 permissions in Nova Electronics Lab (found ${elecOwnerPerms.length})`
  );

  // ----------------------------------------------------
  // TEST 4: Organization-Specific Roles with Same Name but Different Permissions
  // ----------------------------------------------------
  console.log("\n--- Test 4: Same Role Name with Organization-Specific Permissions ---");
  // Create Furniture Org with "Store Manager"
  const ownerUser3 = await prisma.user.create({
    data: {
      name: "Henry Ford",
      email: `henry.${Date.now()}@furniture.test`,
      passwordHash: "mock_hash_3",
      status: UserStatus.ACTIVE,
    },
  });

  const furnitureSetup = await OrganizationService.createOrganizationWithDefaults({
    name: "Heritage Furniture Co",
    businessType: BusinessType.FURNITURE,
    ownerUserId: ownerUser3.id,
  });

  const elecManager = elecRoles.find((r) => r.name === "Store Manager")!;
  const furnRoles = await prisma.role.findMany({
    where: { organizationId: furnitureSetup.organization.id },
  });
  const furnManager = furnRoles.find((r) => r.name === "Store Manager")!;

  assert(
    elecManager.id !== furnManager.id,
    "Store Manager in Electronics and Store Manager in Furniture have distinct IDs"
  );
  assert(
    elecManager.organizationId !== furnManager.organizationId,
    "Store Manager roles are bound to distinct organization IDs"
  );

  // ----------------------------------------------------
  // TEST 5: Custom Role Creation & Customization
  // ----------------------------------------------------
  console.log("\n--- Test 5: Customizable Roles Created by Organization Owner ---");
  const customRole = await OrganizationService.createCustomRole({
    organizationId: furnitureSetup.organization.id,
    name: "Master Wood Crafter",
    description: "Custom artisan role creating and customizing furniture pieces",
    permissions: ["PRODUCT_VIEW", "PRODUCT_CREATE", "STOCK_ADJUST"],
  });

  assert(
    customRole.name === "Master Wood Crafter" &&
      customRole.organizationId === furnitureSetup.organization.id,
    "Custom role 'Master Wood Crafter' created within Heritage Furniture Co"
  );

  // Assign employee to this custom role
  const artisanUser = await prisma.user.create({
    data: {
      name: "Liam O'Connor",
      email: `liam.${Date.now()}@artisan.test`,
      passwordHash: "mock_hash_4",
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.membership.create({
    data: {
      userId: artisanUser.id,
      organizationId: furnitureSetup.organization.id,
      roleId: customRole.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  const artisanPerms = await getUserPermissions(
    artisanUser.id,
    furnitureSetup.organization.id
  );
  assert(
    artisanPerms.includes("PRODUCT_CREATE") &&
      artisanPerms.includes("STOCK_ADJUST") &&
      !artisanPerms.includes("SALE_CANCEL"),
    "Custom role permissions correctly evaluated via getUserPermissions"
  );

  // ----------------------------------------------------
  // TEST 6: Permission-Based Authorization Check
  // ----------------------------------------------------
  console.log("\n--- Test 6: Permission-Based Authorization Check ---");
  const canCreateProduct = await hasPermission(
    artisanUser.id,
    furnitureSetup.organization.id,
    "PRODUCT_CREATE"
  );
  const canCancelSale = await hasPermission(
    artisanUser.id,
    furnitureSetup.organization.id,
    "SALE_CANCEL"
  );

  assert(canCreateProduct === true, "hasPermission('PRODUCT_CREATE') evaluates to true");
  assert(canCancelSale === false, "hasPermission('SALE_CANCEL') evaluates to false");

  // ----------------------------------------------------
  // TEST 7: Multi-Tenant Security & Tenant Isolation
  // ----------------------------------------------------
  console.log("\n--- Test 7: Multi-Tenant Security Isolation ---");
  // Liam is an artisan in Furniture Org. Can he do ANYTHING in Medical Org?
  const crossTenantCheck = await hasPermission(
    artisanUser.id,
    medicalSetup.organization.id,
    "PRODUCT_VIEW"
  );
  assert(
    crossTenantCheck === false,
    "User cannot access or exercise permissions in an organization they are not a member of"
  );

  // ----------------------------------------------------
  // TEST 8: CRITICAL MULTI-TENANT REQUIREMENT
  // EmployeeInvitation CANNOT reference a role from another organization
  // ----------------------------------------------------
  console.log("\n--- Test 8: CRITICAL REQUIREMENT - Cross-Organization Role in Invitation ---");

  // 1. Application-level check via OrganizationService
  let appLevelBlocked = false;
  try {
    await OrganizationService.createEmployeeInvitation({
      organizationId: medicalSetup.organization.id, // Medical Org
      email: "intruder@test.com",
      roleId: elecManager.id, // Electronics Store Manager role!
      invitedById: ownerUser1.id,
    });
  } catch (err: any) {
    if (err.message.includes("does not belong to organization")) {
      appLevelBlocked = true;
    }
  }
  assert(
    appLevelBlocked,
    "Application service rejects invitation with cross-tenant role"
  );

  // 2. Database-level check via PostgreSQL composite foreign key
  let dbLevelBlocked = false;
  try {
    await prisma.employeeInvitation.create({
      data: {
        organizationId: medicalSetup.organization.id, // Medical Org
        email: "direct_db_bypass@test.com",
        roleId: elecManager.id, // Electronics Store Manager role!
        tokenHash: "fake_token_hash_cross_org",
        expiresAt: new Date(Date.now() + 86400000),
        status: InvitationStatus.PENDING,
      },
    });
  } catch (err: any) {
    // Foreign key violation error code in Prisma is P2003
    if (err.code === "P2003") {
      dbLevelBlocked = true;
    }
  }
  assert(
    dbLevelBlocked,
    "PostgreSQL composite foreign key rejects cross-tenant role in EmployeeInvitation at database engine level (P2003)"
  );

  // 3. Database-level check for Membership composite foreign key
  let membershipDbBlocked = false;
  try {
    await prisma.membership.create({
      data: {
        userId: artisanUser.id,
        organizationId: medicalSetup.organization.id, // Medical Org
        roleId: furnManager.id, // Furniture Manager role!
        status: MembershipStatus.ACTIVE,
      },
    });
  } catch (err: any) {
    if (err.code === "P2003") {
      membershipDbBlocked = true;
    }
  }
  assert(
    membershipDbBlocked,
    "PostgreSQL composite foreign key rejects cross-tenant role in Membership at database engine level (P2003)"
  );

  // ----------------------------------------------------
  // TEST 9: Duplicate Role Name Uniqueness within Same Organization
  // ----------------------------------------------------
  console.log("\n--- Test 9: Unique Role Names Per Organization ---");
  let duplicateRoleBlocked = false;
  try {
    await prisma.role.create({
      data: {
        organizationId: medicalSetup.organization.id,
        name: "Pharmacist", // Already exists in Medical Org!
      },
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      duplicateRoleBlocked = true;
    }
  }
  assert(
    duplicateRoleBlocked,
    "Duplicate role name in the same organization rejected by @@unique([organizationId, name]) (P2002)"
  );

  // ----------------------------------------------------
  // CLEANUP TEST DATA
  // ----------------------------------------------------
  console.log("\n--- Cleanup Test Data ---");
  await prisma.organization.delete({ where: { id: medicalSetup.organization.id } });
  await prisma.organization.delete({ where: { id: electronicsSetup.organization.id } });
  await prisma.organization.delete({ where: { id: furnitureSetup.organization.id } });
  await prisma.user.delete({ where: { id: ownerUser1.id } });
  await prisma.user.delete({ where: { id: ownerUser2.id } });
  await prisma.user.delete({ where: { id: ownerUser3.id } });
  await prisma.user.delete({ where: { id: artisanUser.id } });
  console.log("  ✓ Cleaned up all test organizations and users via cascade");

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
