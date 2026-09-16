import app from "../src/app.js";
import config from "../src/config/index.js";
import { prisma, checkDatabaseHealth } from "../src/infrastructure/prisma.js";
import { checkRedisHealth, disconnectRedis } from "../src/infrastructure/redis.js";
import type { Server } from "node:http";

const PORT = 4002;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runFoundationVerification() {
  console.log("==================================================");
  console.log("🛡️ VERIFYING PRODUCTION FOUNDATION (PHASE 2)");
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

  // Start HTTP server on port 4002
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      resolve(s);
    });
  });

  try {
    // ------------------------------------------------------------------
    // TEST 1: Centralized Configuration Validation
    // ------------------------------------------------------------------
    console.log("\n--- Test 1: Centralized & Validated Configuration ---");
    assert(Boolean(config.PORT), `Port is configured: ${config.PORT}`);
    assert(Boolean(config.DATABASE_URL), "Database URL is loaded and valid");
    assert(Boolean(config.REDIS_URL), `Redis URL is loaded: ${config.REDIS_URL}`);
    assert(Object.isFrozen(config), "Configuration object is frozen (immutable)");

    // ------------------------------------------------------------------
    // TEST 2: Health Checks (Liveness & Readiness)
    // ------------------------------------------------------------------
    console.log("\n--- Test 2: Health Check Endpoints ---");

    // Liveness /health
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, "GET /health returns HTTP 200");
    assert(healthData.status === "ok", "GET /health status is 'ok'");
    assert(healthData.service === "smart-inventory-api", "GET /health reports service name");
    assert(typeof healthData.uptime === "number", "GET /health includes process uptime");

    // Liveness /health/live
    const liveRes = await fetch(`${BASE_URL}/health/live`);
    const liveData = await liveRes.json();
    assert(liveRes.status === 200, "GET /health/live returns HTTP 200");
    assert(liveData.success === true && liveData.data.status === "live", "GET /health/live standard response");

    // Readiness /health/ready (Postgres & Redis)
    const readyRes = await fetch(`${BASE_URL}/health/ready`);
    const readyData = await readyRes.json();
    assert(readyRes.status === 200, "GET /health/ready returns HTTP 200");
    assert(readyData.success === true, "GET /health/ready reports success");
    assert(readyData.data.dependencies.database === "healthy", "PostgreSQL dependency is healthy");
    assert(readyData.data.dependencies.redis === "healthy", "Redis dependency is healthy");

    // Direct infrastructure health functions
    const dbDirect = await checkDatabaseHealth();
    assert(dbDirect === true, "Direct checkDatabaseHealth() returns true");
    const redisDirect = await checkRedisHealth();
    assert(redisDirect === true, "Direct checkRedisHealth() returns true");

    // ------------------------------------------------------------------
    // TEST 3: Security Hardening (Headers, CORS, Request ID, Body Limits)
    // ------------------------------------------------------------------
    console.log("\n--- Test 3: Security Headers & CORS ---");
    const optRes = await fetch(`${BASE_URL}/health`, { method: "GET" });
    assert(
      optRes.headers.get("x-content-type-options") === "nosniff",
      "Helmet sets X-Content-Type-Options: nosniff"
    );
    assert(
      optRes.headers.has("access-control-allow-origin"),
      "CORS headers present in response"
    );
    assert(
      optRes.headers.get("access-control-expose-headers")?.includes("X-Request-ID") || false,
      "Access-Control-Expose-Headers exposes X-Request-ID"
    );

    // ------------------------------------------------------------------
    // TEST 4: Request ID Generation & Preservation
    // ------------------------------------------------------------------
    console.log("\n--- Test 4: Request ID & Correlation ---");
    // Auto-generated ID
    const autoIdRes = await fetch(`${BASE_URL}/health`);
    const autoReqId = autoIdRes.headers.get("x-request-id");
    assert(Boolean(autoReqId && autoReqId.startsWith("req_")), `Auto-generated Request ID: ${autoReqId}`);

    // Preserved custom valid ID
    const customReqId = "client-trace-id-abc-12345";
    const customIdRes = await fetch(`${BASE_URL}/health`, {
      headers: { "X-Request-ID": customReqId },
    });
    assert(
      customIdRes.headers.get("x-request-id") === customReqId,
      "Client provided X-Request-ID is preserved and echoed"
    );

    // ------------------------------------------------------------------
    // TEST 5: Rate Limiting
    // ------------------------------------------------------------------
    console.log("\n--- Test 5: Rate Limiting Headers ---");
    const rlRes = await fetch(`${BASE_URL}/health`);
    assert(
      rlRes.headers.has("ratelimit-limit") || rlRes.headers.has("x-ratelimit-limit") || rlRes.headers.has("ratelimit-remaining"),
      "Rate limiting headers are returned"
    );

    // ------------------------------------------------------------------
    // TEST 6: Schema Request Validation Middleware
    // ------------------------------------------------------------------
    console.log("\n--- Test 6: Schema Request Validation ---");
    // Valid body
    const validBody = {
      name: "Ergonomic Office Chair",
      sku: "CHAIR-001",
      price: 199.99,
    };
    const validValRes = await fetch(`${BASE_URL}/api/foundation-test/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const validValData = await validValRes.json();
    assert(validValRes.status === 200, "Valid request payload accepted (HTTP 200)");
    assert(validValData.success === true, "Valid response contains success: true");

    // Invalid body (fails on name length, sku regex, and negative price)
    const invalidBody = {
      name: "x",
      sku: "invalid sku with spaces!",
      price: -50,
    };
    const invalidValRes = await fetch(`${BASE_URL}/api/foundation-test/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidBody),
    });
    const invalidValData = await invalidValRes.json();
    assert(invalidValRes.status === 400, "Invalid request rejected with HTTP 400 Bad Request");
    assert(invalidValData.success === false, "Error response has success: false");
    assert(invalidValData.error.code === "VALIDATION_ERROR", "Error code is VALIDATION_ERROR");
    assert(Array.isArray(invalidValData.error.details), "Error details array provided");
    const fieldErrors = (invalidValData.error.details as any[]).map((d) => d.field);
    assert(
      fieldErrors.includes("name") && fieldErrors.includes("sku") && fieldErrors.includes("price"),
      "Validation caught all invalid fields (name, sku, price)"
    );

    // Malformed JSON syntax
    const malformedRes = await fetch(`${BASE_URL}/api/foundation-test/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json ...",
    });
    const malformedData = await malformedRes.json();
    assert(malformedRes.status === 400, "Malformed JSON rejected with HTTP 400");
    assert(malformedData.error.code === "INVALID_JSON_BODY", "Malformed JSON error code is INVALID_JSON_BODY");

    // ------------------------------------------------------------------
    // TEST 7: Centralized Error Handling & Safety
    // ------------------------------------------------------------------
    console.log("\n--- Test 7: Centralized Error Handling & 404 ---");
    // 404 Route
    const notFoundRes = await fetch(`${BASE_URL}/api/v1/non-existent-module-route`);
    const notFoundData = await notFoundRes.json();
    assert(notFoundRes.status === 404, "Unmapped route returns HTTP 404");
    assert(notFoundData.error.code === "RESOURCE_NOT_FOUND", "404 error code is RESOURCE_NOT_FOUND");

    // 500 Safe Error Masking (Never leak sensitive strings)
    const errRes = await fetch(`${BASE_URL}/api/foundation-test/internal-error`);
    const errData = await errRes.json();
    assert(errRes.status === 500, "Internal error returns HTTP 500");
    assert(errData.success === false, "500 response has success: false");
    assert(errData.error.code === "INTERNAL_SERVER_ERROR", "500 error code is INTERNAL_SERVER_ERROR");
    // In production, internal message must never leak passwords
    assert(
      !JSON.stringify(errData).includes("SUPER_SECRET_PW"),
      "Sensitive database credentials strictly masked from client error response"
    );

    // ------------------------------------------------------------------
    // TEST 8: Organization-Scoped Data Access Helpers
    // ------------------------------------------------------------------
    console.log("\n--- Test 8: Organization-Scoped Query & Tenant Isolation ---");
    const testOrgId = "11111111-1111-1111-1111-111111111111";
    // Matching tenant caller
    const scopedOkRes = await fetch(
      `${BASE_URL}/api/foundation-test/scoped-access?orgId=${testOrgId}&callerOrgId=${testOrgId}`
    );
    const scopedOkData = await scopedOkRes.json();
    assert(scopedOkRes.status === 200, "Matching tenant allowed access (HTTP 200)");
    assert(scopedOkData.data.scoped.organizationId === testOrgId, "Organization ID bound to query scope");

    // Cross-tenant mismatch
    const wrongOrgId = "22222222-2222-2222-2222-222222222222";
    const crossTenantRes = await fetch(
      `${BASE_URL}/api/foundation-test/scoped-access?orgId=${testOrgId}&callerOrgId=${wrongOrgId}`
    );
    const crossTenantData = await crossTenantRes.json();
    assert(crossTenantRes.status === 403, "Cross-tenant access rejected with HTTP 403 Forbidden");
    assert(crossTenantData.error.code === "FORBIDDEN", "Cross-tenant error code is FORBIDDEN");

    // ------------------------------------------------------------------
    // TEST 9: Database Transaction Runner & Rollback Verification
    // ------------------------------------------------------------------
    console.log("\n--- Test 9: Database Transaction Atomicity & Rollback ---");
    const txRes = await fetch(`${BASE_URL}/api/foundation-test/transaction-test`, {
      method: "POST",
    });
    const txData = await txRes.json();
    assert(txRes.status === 200, "Transaction test endpoint executed successfully");
    assert(txData.data.rolledBack === true, "Transaction rollback verified: uncommitted entity discarded");

    // ------------------------------------------------------------------
    // TEST 10: API Versioning / Routing Conventions
    // ------------------------------------------------------------------
    console.log("\n--- Test 10: API Routing & Versioning ---");
    // /api and /api/v1 both mount the router
    const v1Res = await fetch(`${BASE_URL}/api/v1/foundation-test/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    assert(v1Res.status === 200, "Route reachable via /api/v1 prefix");

    console.log("\n==================================================");
    console.log(`🏁 PRODUCTION FOUNDATION SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) {
      throw new Error(`${failed} foundation tests failed`);
    }
  } finally {
    server.close();
    await disconnectRedis();
    await prisma.$disconnect();
  }
}

runFoundationVerification().catch((err) => {
  console.error("Foundation verification failed:", err);
  process.exit(1);
});
