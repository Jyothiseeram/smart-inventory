import { prisma } from "../src/infrastructure/prisma.js";

const PERMISSIONS = [
  { name: "PRODUCT_VIEW", description: "Can view product catalogue and details" },
  { name: "PRODUCT_CREATE", description: "Can create new products" },
  { name: "PRODUCT_UPDATE", description: "Can update product information" },
  { name: "PRODUCT_DELETE", description: "Can delete products" },
  { name: "STOCK_VIEW", description: "Can view current inventory stock levels" },
  { name: "STOCK_ADJUST", description: "Can perform inventory adjustments" },
  { name: "SALE_VIEW", description: "Can view sales orders and history" },
  { name: "SALE_CREATE", description: "Can create new sales orders" },
  { name: "SALE_CANCEL", description: "Can cancel sales orders" },
  { name: "EMPLOYEE_VIEW", description: "Can view organization members and employees" },
  { name: "EMPLOYEE_CREATE", description: "Can invite and onboard new employees" },
  { name: "EMPLOYEE_UPDATE", description: "Can update employee roles and statuses" },
  { name: "REPORT_VIEW", description: "Can view business and inventory reports" },
] as const;

const ROLE_DEFINITIONS: Record<string, { description: string; permissions: string[] }> = {
  OWNER: {
    description: "Organization owner with full access across all modules",
    permissions: [
      "PRODUCT_VIEW",
      "PRODUCT_CREATE",
      "PRODUCT_UPDATE",
      "PRODUCT_DELETE",
      "STOCK_VIEW",
      "STOCK_ADJUST",
      "SALE_VIEW",
      "SALE_CREATE",
      "SALE_CANCEL",
      "EMPLOYEE_VIEW",
      "EMPLOYEE_CREATE",
      "EMPLOYEE_UPDATE",
      "REPORT_VIEW",
    ],
  },
  MANAGER: {
    description: "Operations manager with access to manage inventory, sales, team, and reports",
    permissions: [
      "PRODUCT_VIEW",
      "PRODUCT_CREATE",
      "PRODUCT_UPDATE",
      "STOCK_VIEW",
      "STOCK_ADJUST",
      "SALE_VIEW",
      "SALE_CREATE",
      "SALE_CANCEL",
      "EMPLOYEE_VIEW",
      "EMPLOYEE_UPDATE",
      "REPORT_VIEW",
    ],
  },
  INVENTORY_MANAGER: {
    description: "Dedicated inventory lead managing products, stock, and stock reports",
    permissions: [
      "PRODUCT_VIEW",
      "PRODUCT_CREATE",
      "PRODUCT_UPDATE",
      "PRODUCT_DELETE",
      "STOCK_VIEW",
      "STOCK_ADJUST",
      "REPORT_VIEW",
    ],
  },
  SALES_EXECUTIVE: {
    description: "Sales representative handling customer sales orders and viewing stock",
    permissions: [
      "PRODUCT_VIEW",
      "STOCK_VIEW",
      "SALE_VIEW",
      "SALE_CREATE",
    ],
  },
  ACCOUNTANT: {
    description: "Financial accountant with read access to sales, reports, and stock valuation",
    permissions: [
      "PRODUCT_VIEW",
      "STOCK_VIEW",
      "SALE_VIEW",
      "REPORT_VIEW",
    ],
  },
  EMPLOYEE: {
    description: "Standard employee with basic viewing access",
    permissions: [
      "PRODUCT_VIEW",
      "STOCK_VIEW",
    ],
  },
};

export async function seed() {
  console.log("🌱 Starting seed for initial permissions and roles...");

  // 1. Seed Permissions
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: {
        name: perm.name,
        description: perm.description,
      },
    });
    permissionMap.set(record.name, record.id);
    console.log(`  ✓ Permission: ${record.name}`);
  }

  // 2. Seed Roles and RolePermissions
  for (const [roleName, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: roleDef.description,
        isSystem: true,
      },
      create: {
        name: roleName,
        description: roleDef.description,
        isSystem: true,
      },
    });
    console.log(`  ✓ Role: ${role.name}`);

    // Assign Permissions to Role
    for (const permName of roleDef.permissions) {
      const permissionId = permissionMap.get(permName);
      if (!permissionId) {
        throw new Error(`Permission ${permName} not found in map`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId,
        },
      });
    }
  }

  console.log("✅ Seeding completed successfully!");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed()
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
