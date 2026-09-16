import app from "../src/app.js";
import { prisma } from "../src/infrastructure/prisma.js";
import { UserStatus, MembershipStatus } from "../src/generated/prisma/enums.js";
import type { Server } from "node:http";

const PORT = 4001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runApiVerification() {
  console.log("==================================================");
  console.log("🌐 VERIFYING PRODUCTION RBAC API SUITE (PHASE 1)");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // Start HTTP server on port 4001
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      resolve(s);
    });
  });

  try {
    // ------------------------------------------------------------------
    // TEST 1: Health Check
    // ------------------------------------------------------------------
    console.log("\n--- Test 1: GET /health ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === "ok", "Health endpoint returns 200 OK");

    // ------------------------------------------------------------------
    // TEST SCENARIO 1 (Section 20: Owner): Register Org A & Owner Login
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 1: Owner Registration & Login (Org A - Medical) ---");
    const ownerAPayload = {
      userName: "Dr. Evelyn Reed",
      email: `evelyn.${Date.now()}@metrohealth.test`,
      password: "SecurePassword123!",
      organizationName: "Metro Health Pharmacy",
      businessType: "MEDICAL",
    };

    const regRes = await fetch(`${BASE_URL}/api/auth/register-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ownerAPayload),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, `Owner registered successfully (HTTP 201)`);
    assert(Boolean(regData.token), "Received session token in registration response");

    const ownerAToken = regData.token;
    const orgAId = regData.organization.id;
    const ownerAId = regData.user.id;

    // Login as Owner
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerAPayload.email, password: ownerAPayload.password }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, "Owner login successful (HTTP 200)");
    assert(loginData.memberships[0].roleName === "Owner", "Owner has Owner role");

    // Owner permissions: should have all 23 permissions
    const ownerPermsRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/authorization/permissions`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const ownerPermsData = await ownerPermsRes.json();
    assert(ownerPermsRes.status === 200, "GET /permissions returns 200 OK");
    assert(ownerPermsData.userPermissions.length === 23, "Owner possesses all 23 system permissions");

    // ------------------------------------------------------------------
    // TEST SCENARIO 2 (Section 20: Employee - Manager): Direct Create Employee
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 2: Employee Creation with Pharmacist/Manager Role ---");
    // Get roles to find Pharmacist role ID
    const rolesRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/roles`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const rolesData = await rolesRes.json();
    const pharmacistRole = rolesData.roles.find((r: any) => r.name === "Pharmacist");
    assert(Boolean(pharmacistRole), "Pharmacist role found in Organization A");

    const managerPayload = {
      name: "Alex Mercer",
      email: `alex.${Date.now()}@metrohealth.test`,
      password: "ManagerPassword123!",
      roleId: pharmacistRole.id,
    };

    // Create Manager via Owner
    const createEmpRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(managerPayload),
    });
    const createEmpData = await createEmpRes.json();
    assert(createEmpRes.status === 201, "Direct employee creation returns 201 Created");
    assert(createEmpData.member.roleName === "Pharmacist", "Employee assigned Pharmacist role");

    // Login as Manager
    const managerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: managerPayload.email, password: managerPayload.password }),
    });
    const managerLoginData = await managerLoginRes.json();
    assert(managerLoginRes.status === 200, "Manager login successful (HTTP 200)");
    const managerToken = managerLoginData.token;

    // Verify Manager permissions (Pharmacist has 10 permissions, NOT all 23)
    const managerPermsRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/authorization/permissions`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const managerPermsData = await managerPermsRes.json();
    assert(managerPermsData.userPermissions.length === 10, `Manager has 10 permissions (found ${managerPermsData.userPermissions.length})`);
    assert(managerPermsData.userPermissions.includes("STOCK_VIEW"), "Manager has STOCK_VIEW");
    assert(!managerPermsData.userPermissions.includes("ORGANIZATION_MANAGE"), "Manager lacks ORGANIZATION_MANAGE");

    // ------------------------------------------------------------------
    // TEST SCENARIO 3 (Section 20: Sales Person): Billing Staff Role Permissions
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 3: Sales Person / Billing Staff Role ---");
    const billingRole = rolesData.roles.find((r: any) => r.name === "Billing Staff");
    assert(Boolean(billingRole), "Billing Staff role found");

    const billingPayload = {
      name: "Chloe Bennett",
      email: `chloe.${Date.now()}@metrohealth.test`,
      password: "BillingPassword123!",
      roleId: billingRole.id,
    };

    const createBillingRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(billingPayload),
    });
    assert(createBillingRes.status === 201, "Billing staff created successfully");

    // Login as Billing Staff
    const billingLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: billingPayload.email, password: billingPayload.password }),
    });
    const billingLoginData = await billingLoginRes.json();
    const billingToken = billingLoginData.token;

    // Check permissions: SALE_CREATE allowed, STOCK_ADJUST denied
    const saleCheckRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/authorization/check-permission`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${billingToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ permission: "SALE_CREATE" }),
    });
    const saleCheckData = await saleCheckRes.json();
    assert(saleCheckRes.status === 200 && saleCheckData.allowed === true, "Billing staff possesses SALE_CREATE permission");

    const stockAdjustCheckRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/authorization/check-permission`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${billingToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ permission: "STOCK_ADJUST" }),
    });
    const stockAdjustCheckData = await stockAdjustCheckRes.json();
    assert(stockAdjustCheckRes.status === 200 && stockAdjustCheckData.allowed === false, "Billing staff lacks STOCK_ADJUST permission (Denied)");

    // ------------------------------------------------------------------
    // TEST SCENARIO 4 (Section 20: Supplier): Supplier Functionality Verification
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 4: Supplier Functionality Permissions ---");
    // Pharmacist has SUPPLIER_VIEW, Billing Staff does NOT have SUPPLIER_VIEW
    const managerSupplierRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/authorization/check-permission`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ permission: "SUPPLIER_VIEW" }),
    });
    const managerSupplierData = await managerSupplierRes.json();
    assert(managerSupplierData.allowed === true, "Manager has SUPPLIER_VIEW permission");

    const billingSupplierRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/authorization/check-permission`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${billingToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ permission: "SUPPLIER_VIEW" }),
    });
    const billingSupplierData = await billingSupplierRes.json();
    assert(billingSupplierData.allowed === false, "Billing staff does not have SUPPLIER_VIEW (Denied)");

    // ------------------------------------------------------------------
    // TEST SCENARIO 5 (Section 20: Direct API Attack): Unauthorized User Call
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 5: Direct API Attack (Billing staff attempts POST /roles) ---");
    const attackRoleRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/roles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${billingToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Hacker Role",
        permissions: ["ORGANIZATION_MANAGE"],
      }),
    });
    assert(attackRoleRes.status === 403, "Direct API attack by unauthorized user rejected with 403 Forbidden");

    // ------------------------------------------------------------------
    // TEST SCENARIO 6 (Section 20: Cross-Organization Attack): Org B Intruder
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 6: Cross-Organization Attack ---");
    // Register Organization B
    const ownerBPayload = {
      userName: "Marcus Vance",
      email: `marcus.${Date.now()}@electronics.test`,
      password: "MarcusPassword123!",
      organizationName: "Nova Electronics Lab",
      businessType: "ELECTRONICS",
    };
    const regBRes = await fetch(`${BASE_URL}/api/auth/register-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ownerBPayload),
    });
    const regBData = await regBRes.json();
    const ownerBToken = regBData.token;
    const orgBId = regBData.organization.id;
    const ownerBId = regBData.user.id;

    // Owner B attempts to access Org A's employees
    const crossOrgEmpRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert(crossOrgEmpRes.status === 403, "User from Org B accessing Org A employees rejected with 403 Forbidden");

    // Owner B attempts to access Org A's roles
    const crossOrgRolesRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/roles`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert(crossOrgRolesRes.status === 403, "User from Org B accessing Org A roles rejected with 403 Forbidden");

    // Explicit access-test endpoint
    const crossOrgAccessRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/access-test`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert(crossOrgAccessRes.status === 403, "Cross-tenant access test rejected with 403 Forbidden");

    // ------------------------------------------------------------------
    // TEST SCENARIO 7 (Section 20: Unauthenticated API Request)
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 7: Unauthenticated API Request ---");
    const unauthRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees`);
    assert(unauthRes.status === 401, "Unauthenticated request to protected endpoint rejected with 401 Unauthorized");

    const unauthMeRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(unauthMeRes.status === 401, "Unauthenticated request to /api/auth/me rejected with 401 Unauthorized");

    // ------------------------------------------------------------------
    // TEST SCENARIO 8 (Section 20: Invalid Role / Permission)
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 8: Invalid Role / Permission Enforcement ---");
    // Billing staff attempts to invite employee (requires EMPLOYEE_INVITE)
    const attackInviteRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees/invitations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${billingToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "unauthorized_invite@test.com",
        roleId: pharmacistRole.id,
      }),
    });
    assert(attackInviteRes.status === 403, "User lacking EMPLOYEE_INVITE permission rejected with 403 Forbidden");

    // ------------------------------------------------------------------
    // TEST SCENARIO 9: Employee Invitation Acceptance Flow
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 9: Invitation Issue & Accept Flow ---");
    const inviteEmail = `invitee.${Date.now()}@test.com`;
    const issueInviteRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees/invitations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: inviteEmail,
        roleId: pharmacistRole.id,
      }),
    });
    const issueInviteData = await issueInviteRes.json();
    assert(issueInviteRes.status === 201, "Owner can issue invitation (HTTP 201)");
    const rawToken = issueInviteData.invitation.rawToken;
    assert(Boolean(rawToken), "Raw token returned for invite delivery");

    // Accept invitation
    const acceptRes = await fetch(`${BASE_URL}/api/auth/accept-invitation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: rawToken,
        name: "Invited Pharmacist",
        password: "InviteePassword123!",
      }),
    });
    const acceptData = await acceptRes.json();
    assert(acceptRes.status === 200, "Invited user can accept invitation (HTTP 200)");
    assert(acceptData.user.name === "Invited Pharmacist", "Invited user account created and named");
    assert(acceptData.role === "Pharmacist", "Invited user joined with Pharmacist role");
    const inviteeUserId = acceptData.user.id;

    // ------------------------------------------------------------------
    // TEST SCENARIO 10: Logout API & Backend Session Invalidation
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 10: Logout API & Session Invalidation ---");
    const inviteeToken = acceptData.token;
    // Verify token works
    const testMeRes1 = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${inviteeToken}` },
    });
    assert(testMeRes1.status === 200, "Token valid before logout");

    // Logout
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${inviteeToken}` },
    });
    assert(logoutRes.status === 200, "Logout endpoint returns 200 OK");

    // Verify token is now INVALID (session deleted from db)
    const testMeRes2 = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${inviteeToken}` },
    });
    assert(testMeRes2.status === 401, "Session invalidated in DB after logout (HTTP 401 Unauthorized)");

    // ------------------------------------------------------------------
    // TEST SCENARIO 11: Account Status Enforcement (Suspended User Check)
    // ------------------------------------------------------------------
    console.log("\n--- Test Scenario 11: Account Status Enforcement (Suspended User) ---");
    // Suspend the billing staff user in DB
    const billingUser = await prisma.user.findFirst({ where: { email: billingPayload.email } });
    await prisma.user.update({
      where: { id: billingUser!.id },
      data: { status: UserStatus.SUSPENDED },
    });

    // Login attempt by suspended user
    const suspLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: billingPayload.email, password: billingPayload.password }),
    });
    assert(suspLoginRes.status === 403, "Login attempt by suspended user rejected with 403 Forbidden");

    // Clean up test records
    await prisma.organization.delete({ where: { id: orgAId } });
    await prisma.organization.delete({ where: { id: orgBId } });
    await prisma.user.delete({ where: { id: ownerAId } });
    await prisma.user.delete({ where: { id: ownerBId } });
    if (inviteeUserId) {
      await prisma.user.delete({ where: { id: inviteeUserId } });
    }
    console.log("  ✓ All test organizations and users cleaned up successfully");

    console.log("\n==================================================");
    console.log(`🏁 API TEST SUITE SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) {
      throw new Error(`${failed} API tests failed`);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runApiVerification().catch((err) => {
  console.error("API verification error:", err);
  process.exit(1);
});
