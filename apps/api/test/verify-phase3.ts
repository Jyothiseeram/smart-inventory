import app from "../src/app.js";
import { prisma } from "../src/infrastructure/prisma.js";
import type { Server } from "node:http";

const PORT = 4003;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runPhase3Verification() {
  console.log("==================================================");
  console.log("📦 VERIFYING PHASE 3 — PRODUCT CATALOGUE & INVENTORY");
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
    // TEST 1: Default Units Seeding Verification
    // ------------------------------------------------------------------
    console.log("\n--- Test 1: Verify Default Units Seeding ---");
    const unitsRes = await fetch(`${BASE_URL}/api/v1/units`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const unitsData = await unitsRes.json();
    assert(unitsRes.status === 200, "GET /units returns 200 OK");
    const unitCodes = unitsData.data.map((u: any) => u.code);
    assert(
      unitCodes.includes("pc") && unitCodes.includes("box") && unitCodes.includes("kg"),
      `Default units seeded: ${unitCodes.join(", ")}`
    );
    const pieceUnit = unitsData.data.find((u: any) => u.code === "pc");

    // ------------------------------------------------------------------
    // TEST 2: Category Management & Tenant Scoped Uniqueness
    // ------------------------------------------------------------------
    console.log("\n--- Test 2: Category CRUD & Uniqueness ---");
    const catRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Antibiotics",
        description: "Prescription antibiotics",
      }),
    });
    const catData = await catRes.json();
    assert(catRes.status === 201, "Category 'Antibiotics' created in Org A (HTTP 201)");
    const categoryAId = catData.data.id;

    // Duplicate category name in same org rejected
    const dupCatRes = await fetch(`${BASE_URL}/api/v1/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({ name: "Antibiotics" }),
    });
    assert(dupCatRes.status === 409, "Duplicate category name in same organization rejected (HTTP 409)");

    // Cross-tenant category access rejected
    const crossCatRes = await fetch(`${BASE_URL}/api/v1/categories/${categoryAId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
    });
    assert(crossCatRes.status === 403, "User from Org B accessing Org A category rejected (HTTP 403 Forbidden)");

    // ------------------------------------------------------------------
    // TEST 3: Brand Management & Tenant Scoped Uniqueness
    // ------------------------------------------------------------------
    console.log("\n--- Test 3: Brand CRUD & Uniqueness ---");
    const brandRes = await fetch(`${BASE_URL}/api/v1/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Pfizer",
        description: "Pfizer Global Biopharmaceuticals",
      }),
    });
    const brandData = await brandRes.json();
    assert(brandRes.status === 201, "Brand 'Pfizer' created in Org A (HTTP 201)");
    const brandAId = brandData.data.id;

    const dupBrandRes = await fetch(`${BASE_URL}/api/v1/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({ name: "Pfizer" }),
    });
    assert(dupBrandRes.status === 409, "Duplicate brand name in same organization rejected (HTTP 409)");

    // ------------------------------------------------------------------
    // TEST 4: Unit Management & Custom Unit Creation
    // ------------------------------------------------------------------
    console.log("\n--- Test 4: Custom Unit Creation & Validation ---");
    const customUnitRes = await fetch(`${BASE_URL}/api/v1/units`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Blister Pack (10)",
        code: "blister10",
        description: "Blister pack of 10 capsules",
      }),
    });
    const customUnitData = await customUnitRes.json();
    assert(customUnitRes.status === 201, "Custom unit 'Blister Pack (10)' created in Org A (HTTP 201)");
    const customUnitAId = customUnitData.data.id;

    // ------------------------------------------------------------------
    // TEST 5: Product Creation, Initial Stock & SKU Organization Scope
    // ------------------------------------------------------------------
    console.log("\n--- Test 5: Product Creation, Initial Stock & Organization-Scoped SKU ---");
    const productPayloadA = {
      name: "Amoxicillin 500mg",
      description: "Broad spectrum antibiotic capsules",
      sku: "AMX-500",
      barcode: "789123456001",
      categoryId: categoryAId,
      brandId: brandAId,
      unitId: customUnitAId,
      costPrice: 5.5,
      sellingPrice: 12.0,
      reorderLevel: 25,
      initialStock: 100,
    };

    const prodResA = await fetch(`${BASE_URL}/api/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify(productPayloadA),
    });
    const prodDataA = await prodResA.json();
    assert(prodResA.status === 201, "Product created in Org A (HTTP 201)");
    assert(prodDataA.data.sku === "AMX-500", "Product SKU stored correctly");
    assert(prodDataA.data.inventory.currentQuantity === 100, "Initial inventory initialized to 100");
    const productAId = prodDataA.data.id;

    // Verify OPENING_STOCK movement automatically recorded
    const movementsResA = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/movements`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const movementsDataA = await movementsResA.json();
    assert(movementsResA.status === 200, "GET /inventory/:id/movements returns 200 OK");
    assert(movementsDataA.data.movements.length === 1, "Initial stock created exactly 1 movement record");
    assert(
      movementsDataA.data.movements[0].movementType === "OPENING_STOCK" &&
        movementsDataA.data.movements[0].previousQuantity === 0 &&
        movementsDataA.data.movements[0].resultingQuantity === 100,
      "Opening movement accurately recorded: 0 -> 100"
    );

    // CRITICAL: Organization B creates product with SAME SKU "AMX-500" -> MUST BE ALLOWED!
    console.log("\n--- Organization-Scoped SKU: Same SKU allowed across distinct organizations ---");
    const prodResB = await fetch(`${BASE_URL}/api/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
      body: JSON.stringify({
        name: "Audio Mixer AMX-500",
        sku: "AMX-500", // Same SKU!
        costPrice: 45.0,
        sellingPrice: 99.0,
        initialStock: 10,
      }),
    });
    const prodDataB = await prodResB.json();
    assert(
      prodResB.status === 201,
      "Organization B successfully created product with identical SKU 'AMX-500' (Tenant Isolation)"
    );
    const productBId = prodDataB.data.id;

    // Duplicate SKU in SAME Organization A -> MUST BE REJECTED!
    const dupSkuRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Duplicate Amoxicillin Attempt",
        sku: "AMX-500",
      }),
    });
    assert(dupSkuRes.status === 409, "Duplicate SKU within same organization rejected with HTTP 409 Conflict");

    // ------------------------------------------------------------------
    // TEST 6: Cross-Tenant Classification Injection Attack
    // ------------------------------------------------------------------
    console.log("\n--- Test 6: Cross-Tenant Classification Injection Attack ---");
    const injectionRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
      body: JSON.stringify({
        name: "Malicious Component",
        sku: "MAL-001",
        categoryId: categoryAId, // Category belonging to Org A!
      }),
    });
    assert(
      injectionRes.status === 403,
      "Attempt by Org B to attach Org A's category rejected with HTTP 403 Forbidden"
    );

    // ------------------------------------------------------------------
    // TEST 7: Cross-Tenant Product Access
    // ------------------------------------------------------------------
    console.log("\n--- Test 7: Cross-Tenant Product Access Prevention ---");
    const crossProdGet = await fetch(`${BASE_URL}/api/v1/products/${productAId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
    });
    assert(crossProdGet.status === 403, "Org B user accessing Org A product by ID rejected with HTTP 403");

    const crossProdPatch = await fetch(`${BASE_URL}/api/v1/products/${productAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
      body: JSON.stringify({ name: "Hacked Name" }),
    });
    assert(crossProdPatch.status === 403, "Org B user updating Org A product rejected with HTTP 403");

    // ------------------------------------------------------------------
    // TEST 8: Atomic Stock Adjustment & Negative Stock Policy
    // ------------------------------------------------------------------
    console.log("\n--- Test 8: Atomic Stock Adjustment & Negative Stock Prevention ---");

    // 1. Positive adjustment (+25)
    const posAdjRes = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        quantity: 25,
        movementType: "ADJUSTMENT",
        reason: "Supplier intake correction",
      }),
    });
    const posAdjData = await posAdjRes.json();
    assert(posAdjRes.status === 200, "Positive stock adjustment executed (HTTP 200)");
    assert(posAdjData.data.inventory.currentQuantity === 125, "New stock quantity calculated: 125");
    assert(
      posAdjData.data.movement.previousQuantity === 100 &&
        posAdjData.data.movement.resultingQuantity === 125 &&
        posAdjData.data.movement.quantity === 25,
      "Movement record audit accurate: 100 -> 125 (+25)"
    );

    // 2. Negative adjustment (-15)
    const negAdjRes = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        quantity: -15,
        movementType: "ADJUSTMENT",
        reason: "Inventory recount reduction",
      }),
    });
    const negAdjData = await negAdjRes.json();
    assert(negAdjRes.status === 200, "Negative stock adjustment executed (HTTP 200)");
    assert(negAdjData.data.inventory.currentQuantity === 110, "Stock reduced accurately: 110");

    // 3. Negative Stock Policy Enforcement (Attempt -200 when current is 110)
    console.log("\n--- Negative Stock Policy Enforcement ---");
    const overAdjRes = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        quantity: -200,
        movementType: "ADJUSTMENT",
        reason: "Illegal over-consumption attempt",
      }),
    });
    const overAdjData = await overAdjRes.json();
    assert(
      overAdjRes.status === 400 && overAdjData.error.code === "INSUFFICIENT_STOCK",
      "Adjustment resulting in negative stock rejected with HTTP 400 INSUFFICIENT_STOCK"
    );

    // Verify stock remains exactly 110 and no movement record was persisted (atomicity)
    const verifyStockRes = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const verifyStockData = await verifyStockRes.json();
    assert(
      verifyStockData.data.inventory.currentQuantity === 110,
      "Atomicity verified: Inventory quantity unchanged at 110 after rollback"
    );

    // ------------------------------------------------------------------
    // TEST 9: Cross-Tenant Inventory Attacks
    // ------------------------------------------------------------------
    console.log("\n--- Test 9: Cross-Tenant Inventory Attacks ---");
    const crossInvGet = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
    });
    assert(crossInvGet.status === 403, "Org B cannot view Org A product inventory (HTTP 403)");

    const crossInvAdjust = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
      body: JSON.stringify({
        quantity: 50,
        movementType: "ADJUSTMENT",
        reason: "Cross-tenant tampering",
      }),
    });
    assert(crossInvAdjust.status === 403, "Org B cannot adjust Org A inventory (HTTP 403)");

    const crossInvMovements = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/movements`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-organization-id": orgBId,
      },
    });
    assert(crossInvMovements.status === 403, "Org B cannot view Org A stock movements (HTTP 403)");

    // ------------------------------------------------------------------
    // TEST 10: RBAC & Permission Enforcement
    // ------------------------------------------------------------------
    console.log("\n--- Test 10: RBAC Permission Restrictions ---");
    // Get Billing Staff role in Org A (has PRODUCT_VIEW and STOCK_VIEW, lacks PRODUCT_CREATE, PRODUCT_DELETE, STOCK_ADJUST)
    const rolesRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/roles`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const rolesData = await rolesRes.json();
    const billingRole = rolesData.roles.find((r: any) => r.name === "Billing Staff");
    assert(Boolean(billingRole), "Found Billing Staff role in Org A");

    const clerkEmail = `chloe.${Date.now()}@apexhealth.test`;
    const clerkPassword = "SecurePassword123!";

    const clerkRes = await fetch(`${BASE_URL}/api/organizations/${orgAId}/employees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Chloe Diaz",
        email: clerkEmail,
        password: clerkPassword,
        roleId: billingRole.id,
      }),
    });
    const clerkData = await clerkRes.json();
    assert(clerkRes.status === 201, "Billing Staff user created");

    const clerkLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: clerkEmail,
        password: clerkPassword,
      }),
    });
    const clerkLoginData = await clerkLoginRes.json();
    const tokenClerk = clerkLoginData.token;

    // Clerk can view products (PRODUCT_VIEW)
    const clerkViewRes = await fetch(`${BASE_URL}/api/v1/products`, {
      headers: {
        Authorization: `Bearer ${tokenClerk}`,
        "x-organization-id": orgAId,
      },
    });
    assert(clerkViewRes.status === 200, "Billing Staff with PRODUCT_VIEW can view products");

    // Clerk CANNOT create product (needs PRODUCT_CREATE)
    const clerkCreateRes = await fetch(`${BASE_URL}/api/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenClerk}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        name: "Unauthorized Product",
        sku: "UNAUTH-01",
      }),
    });
    assert(
      clerkCreateRes.status === 403,
      "Billing Staff without PRODUCT_CREATE rejected with HTTP 403 Forbidden"
    );

    // Clerk CANNOT adjust inventory (needs STOCK_ADJUST)
    const clerkAdjustRes = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenClerk}`,
        "x-organization-id": orgAId,
      },
      body: JSON.stringify({
        quantity: 10,
        movementType: "ADJUSTMENT",
        reason: "Unauthorized adjustment attempt",
      }),
    });
    assert(
      clerkAdjustRes.status === 403,
      "Billing Staff without STOCK_ADJUST rejected with HTTP 403 Forbidden"
    );

    // ------------------------------------------------------------------
    // TEST 11: Product Deactivation & Audit Preservation
    // ------------------------------------------------------------------
    console.log("\n--- Test 11: Product Deactivation & Historical Audit Trail ---");
    const deleteRes = await fetch(`${BASE_URL}/api/v1/products/${productAId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200, "DELETE /products/:id returned 200 OK");
    assert(
      deleteData.data.action === "DEACTIVATED",
      "Product with historical stock movements safely deactivated (soft-delete)"
    );

    // Verify product status is INACTIVE
    const checkStatusRes = await fetch(`${BASE_URL}/api/v1/products/${productAId}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const checkStatusData = await checkStatusRes.json();
    assert(checkStatusData.data.status === "INACTIVE", "Product status updated to INACTIVE in database");

    // Stock movements are fully preserved
    const checkMovementsRes = await fetch(`${BASE_URL}/api/v1/inventory/${productAId}/movements`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "x-organization-id": orgAId,
      },
    });
    const checkMovementsData = await checkMovementsRes.json();
    assert(
      checkMovementsData.data.movements.length >= 3,
      `All ${checkMovementsData.data.movements.length} historical stock movements fully preserved after deactivation`
    );

    // ------------------------------------------------------------------
    // TEST 12: PostgreSQL Database Engine Composite Foreign Key Check
    // ------------------------------------------------------------------
    console.log("\n--- Test 12: Database Engine Level Composite Foreign Key Invariant ---");
    let dbFkBlocked = false;
    try {
      // Attempt to directly insert a stock movement for Org A referencing Product B (which belongs to Org B)
      await prisma.stockMovement.create({
        data: {
          organizationId: orgAId,
          productId: productBId, // Belongs to Org B!
          quantity: 10,
          movementType: "ADJUSTMENT",
          previousQuantity: 0,
          resultingQuantity: 10,
          reason: "Direct DB cross-tenant tamper test",
        },
      });
    } catch (err: any) {
      if (err.code === "P2003") {
        dbFkBlocked = true;
      }
    }
    assert(
      dbFkBlocked,
      "PostgreSQL engine composite foreign key rejected cross-tenant stock movement link (P2003)"
    );

    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    console.log("\n--- Cleaning Up Phase 3 Test Data ---");
    await prisma.organization.delete({ where: { id: orgAId } });
    await prisma.organization.delete({ where: { id: orgBId } });
    console.log("  ✓ Cleaned up test organizations, products, and movements via cascade");

    console.log("\n==================================================");
    console.log(`🏁 PHASE 3 VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) {
      throw new Error(`${failed} Phase 3 verification tests failed!`);
    }
  } finally {
    server.close();
  }
}

runPhase3Verification()
  .catch((err) => {
    console.error("Phase 3 verification error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
