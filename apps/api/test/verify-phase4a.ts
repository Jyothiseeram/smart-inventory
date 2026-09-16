import app from "../src/app.js";
import { prisma } from "../src/infrastructure/prisma.js";
import type { Server } from "node:http";

const PORT = 4004;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runPhase4AVerification() {
  console.log("==================================================");
  console.log("🚚 VERIFYING PHASE 4A — SUPPLIER MASTER CATALOGUE");
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

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      resolve(s);
    });
  });

  try {
    // ------------------------------------------------------------------
    // SETUP: Register Organization A (Medical) and Organization B (Electronics)
    // ------------------------------------------------------------------
    console.log("\n--- Setup: Register Org A (Medical) & Org B (Electronics) ---");
    const orgARes = await fetch(`${BASE_URL}/api/auth/register-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: "Dr. Alicia Vance",
        email: `alicia.${Date.now()}@apexhealth.test`,
        password: "SecurePassword123!",
        organizationName: "Apex Health Pharma",
        businessType: "MEDICAL",
      }),
    });
    const orgAData = await orgARes.json();
    assert(orgARes.status === 201, "Organization A registered successfully");
    const tokenA = orgAData.token;
    const orgAId = orgAData.organization.id;
    const ownerAId = orgAData.user.id;

    const orgBRes = await fetch(`${BASE_URL}/api/auth/register-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: "Robert Sterling",
        email: `robert.${Date.now()}@voltelectronics.test`,
        password: "SecurePassword123!",
        organizationName: "Volt Electronics",
        businessType: "ELECTRONICS",
      }),
    });
    const orgBData = await orgBRes.json();
    assert(orgBRes.status === 201, "Organization B registered successfully");
    const tokenB = orgBData.token;
    const orgBId = orgBData.organization.id;

    // ------------------------------------------------------------------
    // TEST 1: Valid Supplier Creation
    // ------------------------------------------------------------------
    console.log("\n--- Test 1: Valid Supplier Creation ---");
    const createRes1 = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "BioMed Supplies Inc",
        contactPerson: "Dr. Rajesh Rao",
        email: "contact@biomedsupplies.test",
        phone: "+91-9876543210",
        address: "Plot 42, Biotech Park, Genome Valley, Hyderabad",
        taxId: "GSTIN-36AABCB1234F1Z5",
        notes: "Primary sterile equipment vendor with net-30 terms",
        status: "ACTIVE",
      }),
    });
    const createData1 = await createRes1.json();
    assert(createRes1.status === 201, "Supplier 1 created with HTTP 201");
    assert(createData1.success === true, "ApiResponse success is true");
    assert(createData1.data.name === "BioMed Supplies Inc", "Supplier name matches");
    assert(createData1.data.organizationId === orgAId, "Supplier organizationId matches Org A");
    assert(createData1.data.taxId === "GSTIN-36AABCB1234F1Z5", "Supplier taxId matches");
    assert(createData1.data.status === "ACTIVE", "Supplier status is ACTIVE");
    const supplier1Id = createData1.data.id;

    // Create a second supplier in Org A
    const createRes2 = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "PharmaChem Global Logistics",
        contactPerson: "Ananya Sharma",
        email: "dispatch@pharmachem.test",
        phone: "+91-9123456780",
        address: "Warehouse 12, Air Cargo Complex, Mumbai",
        taxId: "GSTIN-27AABCP9876Q1Z2",
        notes: "Cold-chain pharmaceutical delivery partner",
        status: "ACTIVE",
      }),
    });
    const createData2 = await createRes2.json();
    assert(createRes2.status === 201, "Supplier 2 created with HTTP 201");
    const supplier2Id = createData2.data.id;

    // ------------------------------------------------------------------
    // TEST 2: Input Validation Failures
    // ------------------------------------------------------------------
    console.log("\n--- Test 2: Input Validation Failures ---");

    // Empty name
    const emptyNameRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "   ",
        email: "test@vendor.com",
      }),
    });
    assert(emptyNameRes.status === 400, "Empty supplier name rejected with HTTP 400");

    // Malformed email
    const invalidEmailRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Invalid Email Vendor",
        email: "not-an-email",
      }),
    });
    assert(invalidEmailRes.status === 400, "Malformed email rejected with HTTP 400");

    // Excessive field length
    const excessivePhoneRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Long Phone Vendor",
        phone: "1234567890".repeat(10), // 100 characters (> 50 limit)
      }),
    });
    assert(excessivePhoneRes.status === 400, "Excessive phone length rejected with HTTP 400");

    // ------------------------------------------------------------------
    // TEST 3: Organization-Scoped Tax Identifier Uniqueness
    // ------------------------------------------------------------------
    console.log("\n--- Test 3: Tax Identifier Uniqueness ---");

    // Duplicate taxId in same org -> 409 Conflict
    const dupTaxRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Duplicate TaxId Vendor",
        taxId: "GSTIN-36AABCB1234F1Z5", // Same as Supplier 1
      }),
    });
    assert(dupTaxRes.status === 409, "Duplicate taxId in same organization rejected with HTTP 409 Conflict");

    // Same taxId in Org B -> Allowed (multi-tenant scoped, not globally unique)
    const orgBSameTaxRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
      body: JSON.stringify({
        name: "BioMed Supplies (Org B Branch)",
        taxId: "GSTIN-36AABCB1234F1Z5",
      }),
    });
    assert(orgBSameTaxRes.status === 201, "Same taxId in different organization allowed with HTTP 201");
    const orgBSupplierData = await orgBSameTaxRes.json();
    const orgBSupplierId = orgBSupplierData.data.id;

    // Multiple suppliers with null/empty taxId in same org -> Allowed
    const nullTax1Res = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Small Unregistered Vendor A",
        taxId: "",
      }),
    });
    assert(nullTax1Res.status === 201, "First null taxId supplier created with HTTP 201");

    const nullTax2Res = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Small Unregistered Vendor B",
        taxId: null,
      }),
    });
    assert(nullTax2Res.status === 201, "Second null taxId supplier in same org allowed with HTTP 201");
    const unregVendorBData = await nullTax2Res.json();
    const unregVendorBId = unregVendorBData.data.id;

    // ------------------------------------------------------------------
    // TEST 4: Supplier Retrieval & Pagination
    // ------------------------------------------------------------------
    console.log("\n--- Test 4: Supplier Retrieval & Pagination ---");

    // List suppliers in Org A
    const listRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, "GET /suppliers returns HTTP 200");
    assert(listData.data.length === 4, "Org A has 4 total registered suppliers");
    assert(listData.metrics.total === 4, "Metrics total is 4");
    assert(listData.metrics.active === 4, "Metrics active is 4");
    assert(listData.metrics.inactive === 0, "Metrics inactive is 0");

    // Get single supplier
    const getRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const getData = await getRes.json();
    assert(getRes.status === 200, "GET /suppliers/:id returns HTTP 200");
    assert(getData.data.id === supplier1Id, "Retrieved supplier ID matches");
    assert(getData.data.contactPerson === "Dr. Rajesh Rao", "Retrieved contact person matches");

    // Get non-existent UUID
    const get404Res = await fetch(
      `${BASE_URL}/api/v1/suppliers/00000000-0000-0000-0000-000000000000`,
      {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          "x-organization-id": orgAId,
        },
      }
    );
    assert(get404Res.status === 404, "Non-existent supplier ID returns HTTP 404 Not Found");

    // ------------------------------------------------------------------
    // TEST 5: Search & Status Filtering
    // ------------------------------------------------------------------
    console.log("\n--- Test 5: Search & Status Filtering ---");

    // Search by Name
    const searchNameRes = await fetch(`${BASE_URL}/api/v1/suppliers?search=BioMed`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const searchNameData = await searchNameRes.json();
    assert(searchNameData.data.length === 1, "Search by name 'BioMed' returns exactly 1 supplier");
    assert(searchNameData.data[0].name === "BioMed Supplies Inc", "Matched supplier is BioMed");

    // Search by Contact Person
    const searchContactRes = await fetch(`${BASE_URL}/api/v1/suppliers?search=Rajesh`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const searchContactData = await searchContactRes.json();
    assert(searchContactData.data.length === 1, "Search by contact person 'Rajesh' returns 1 supplier");

    // Search by Email
    const searchEmailRes = await fetch(`${BASE_URL}/api/v1/suppliers?search=pharmachem.test`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const searchEmailData = await searchEmailRes.json();
    assert(searchEmailData.data.length === 1, "Search by email domain returns 1 supplier");
    assert(searchEmailData.data[0].id === supplier2Id, "Matched supplier is PharmaChem");

    // Search by Phone
    const searchPhoneRes = await fetch(`${BASE_URL}/api/v1/suppliers?search=9123456780`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const searchPhoneData = await searchPhoneRes.json();
    assert(searchPhoneData.data.length === 1, "Search by phone number returns 1 supplier");

    // Search by Tax ID
    const searchTaxRes = await fetch(`${BASE_URL}/api/v1/suppliers?search=36AABCB1234F1Z5`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const searchTaxData = await searchTaxRes.json();
    assert(searchTaxData.data.length === 1, "Search by taxId returns 1 supplier");

    // ------------------------------------------------------------------
    // TEST 6: Supplier Updates
    // ------------------------------------------------------------------
    console.log("\n--- Test 6: Supplier Updates ---");

    const updateRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        contactPerson: "Dr. Rajesh Rao (Lead Director)",
        phone: "+91-9999988888",
        notes: "Updated terms: 5% early payment discount",
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, "PATCH /suppliers/:id returns HTTP 200");
    assert(
      updateData.data.contactPerson === "Dr. Rajesh Rao (Lead Director)",
      "Updated contact person saved"
    );
    assert(updateData.data.phone === "+91-9999988888", "Updated phone saved");
    assert(
      updateData.data.notes === "Updated terms: 5% early payment discount",
      "Updated notes saved"
    );

    // Update with conflicting taxId
    const updateConflictRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        taxId: "GSTIN-27AABCP9876Q1Z2", // Belongs to supplier 2
      }),
    });
    assert(
      updateConflictRes.status === 409,
      "Update with duplicate taxId in same org rejected with HTTP 409"
    );

    // ------------------------------------------------------------------
    // TEST 7: Lifecycle: Deactivation (ACTIVE -> INACTIVE) & Reactivation
    // ------------------------------------------------------------------
    console.log("\n--- Test 7: Supplier Lifecycle (Active / Inactive) ---");

    // Soft-deactivate supplier 2
    const deactRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier2Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        status: "INACTIVE",
      }),
    });
    const deactData = await deactRes.json();
    assert(deactRes.status === 200, "Supplier deactivated via PATCH returns HTTP 200");
    assert(deactData.data.status === "INACTIVE", "Supplier status updated to INACTIVE");

    // Check status filtering: active only
    const activeOnlyRes = await fetch(`${BASE_URL}/api/v1/suppliers?status=ACTIVE`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const activeOnlyData = await activeOnlyRes.json();
    assert(activeOnlyData.data.length === 3, "status=ACTIVE filter returns 3 active suppliers");

    // Check status filtering: inactive only
    const inactiveOnlyRes = await fetch(`${BASE_URL}/api/v1/suppliers?status=INACTIVE`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const inactiveOnlyData = await inactiveOnlyRes.json();
    assert(inactiveOnlyData.data.length === 1, "status=INACTIVE filter returns 1 inactive supplier");
    assert(inactiveOnlyData.data[0].id === supplier2Id, "Inactive supplier is Supplier 2");
    assert(inactiveOnlyData.metrics.inactive === 1, "Metrics inactive count is 1");
    assert(inactiveOnlyData.metrics.active === 3, "Metrics active count is 3");

    // Reactivate supplier 2
    const reactRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier2Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        status: "ACTIVE",
      }),
    });
    const reactData = await reactRes.json();
    assert(reactRes.status === 200, "Supplier reactivated with HTTP 200");
    assert(reactData.data.status === "ACTIVE", "Supplier status restored to ACTIVE");

    // ------------------------------------------------------------------
    // TEST 8: CRITICAL Multi-Tenant Security Isolation
    // ------------------------------------------------------------------
    console.log("\n--- Test 8: CRITICAL Multi-Tenant Security Isolation ---");

    // Cross-tenant Read: Org B user attempts to read Org A's supplier
    const crossReadRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
    });
    assert(
      crossReadRes.status === 403,
      "Org B cannot read Org A supplier (HTTP 403 Forbidden)"
    );

    // Cross-tenant Update: Org B user attempts to modify Org A's supplier
    const crossUpdateRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
      body: JSON.stringify({
        name: "Hacked by Org B",
      }),
    });
    assert(
      crossUpdateRes.status === 403,
      "Org B cannot update Org A supplier (HTTP 403 Forbidden)"
    );

    // Verify Org A supplier was NOT modified
    const verifyUnchanged = await prisma.supplier.findUnique({
      where: { id: supplier1Id },
    });
    assert(
      verifyUnchanged?.name === "BioMed Supplies Inc",
      "Org A supplier data remained strictly uncompromised"
    );

    // Cross-tenant Delete: Org B user attempts to delete Org A's supplier
    const crossDeleteRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
    });
    assert(
      crossDeleteRes.status === 403,
      "Org B cannot delete Org A supplier (HTTP 403 Forbidden)"
    );

    // Organization Spoofing: Org A user tries to inject Org B ID in POST body
    const spoofRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Spoofing Attempt Vendor",
        organizationId: orgBId, // Injected Org B ID
      }),
    });
    const spoofData = await spoofRes.json();
    assert(spoofRes.status === 201, "Supplier created under verified tenant context");
    assert(
      spoofData.data.organizationId === orgAId,
      "Injected organizationId was safely ignored; created strictly under Org A"
    );

    // ------------------------------------------------------------------
    // TEST 9: RBAC Permission Restrictions
    // ------------------------------------------------------------------
    console.log("\n--- Test 9: RBAC Permission Restrictions ---");

    // Fetch Billing Staff role in Org A (lacks SUPPLIER_CREATE, SUPPLIER_UPDATE, SUPPLIER_DELETE)
    const rolesRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/roles`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const rolesData = await rolesRes.json();
    const billingRole = rolesData.roles.find((r: any) => r.name === "Billing Staff");
    assert(Boolean(billingRole), "Found Billing Staff role in Org A");

    // Create a Billing Staff user in Org A
    const billingEmail = `billing.${Date.now()}@apexhealth.test`;
    const empRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Carlos Billing Officer",
        email: billingEmail,
        password: "BillingPassword123!",
        roleId: billingRole.id,
      }),
    });
    assert(empRes.status === 201, "Billing Staff user registered in Org A");

    // Log in as Billing Staff user
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: billingEmail,
        password: "BillingPassword123!",
      }),
    });
    const loginData = await loginRes.json();
    const billingToken = loginData.token;

    // Billing Staff has no SUPPLIER_CREATE permission
    const billingCreateRes = await fetch(`${BASE_URL}/api/v1/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${billingToken}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Unauthorized Vendor Attempt",
      }),
    });
    assert(
      billingCreateRes.status === 403,
      "Billing Staff without SUPPLIER_CREATE rejected with HTTP 403 Forbidden"
    );

    // Billing Staff has no SUPPLIER_UPDATE permission
    const billingUpdateRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${billingToken}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Unauthorized Vendor Update",
      }),
    });
    assert(
      billingUpdateRes.status === 403,
      "Billing Staff without SUPPLIER_UPDATE rejected with HTTP 403 Forbidden"
    );

    // Billing Staff has no SUPPLIER_UPDATE permission for DELETE
    const billingDeleteRes = await fetch(`${BASE_URL}/api/v1/suppliers/${supplier1Id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${billingToken}`,
        "x-organization-id": orgAId,
      },
    });
    assert(
      billingDeleteRes.status === 403,
      "Billing Staff without SUPPLIER_UPDATE rejected on DELETE with HTTP 403 Forbidden"
    );

    // ------------------------------------------------------------------
    // TEST 10: Supplier Deletion & Database Invariants
    // ------------------------------------------------------------------
    console.log("\n--- Test 10: Supplier Deletion & Database Invariants ---");

    // Delete unregVendorB (authorized owner)
    const deleteRes = await fetch(`${BASE_URL}/api/v1/suppliers/${unregVendorBId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200, "DELETE /suppliers/:id returns HTTP 200");
    assert(deleteData.data.action === "DELETED", "Supplier action was DELETED");

    // Verify supplier is gone
    const verifyDeleted = await prisma.supplier.findUnique({
      where: { id: unregVendorBId },
    });
    assert(verifyDeleted === null, "Supplier purged cleanly from database");

    // Database compound unique constraint [id, organizationId] invariant check
    const supplierUniqueCheck = await prisma.supplier.findUnique({
      where: {
        supplier_org_unique: {
          id: supplier1Id,
          organizationId: orgAId,
        },
      },
    });
    assert(
      Boolean(supplierUniqueCheck),
      "Database engine verified compound unique index [id, organizationId] on Supplier"
    );

    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    console.log("\n--- Cleaning Up Phase 4A Test Data ---");
    await prisma.organization.delete({ where: { id: orgAId } });
    await prisma.organization.delete({ where: { id: orgBId } });
    console.log("  ✓ Cleaned up test organizations and suppliers via cascade");

    console.log("\n==================================================");
    console.log(`🏁 PHASE 4A VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) {
      throw new Error(`${failed} Phase 4A verification tests failed!`);
    }
  } finally {
    server.close();
  }
}

runPhase4AVerification()
  .catch((err) => {
    console.error("Phase 4A verification error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
