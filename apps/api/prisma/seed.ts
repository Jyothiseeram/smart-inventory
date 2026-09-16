import { prisma } from "../src/infrastructure/prisma.js";
import { ALL_PERMISSIONS } from "../src/common/permissions.js";

export async function seedPermissions() {
  console.log("🌱 Seeding global permissions...");
  const seeded = [];
  for (const perm of ALL_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: {
        name: perm.name,
        description: perm.description,
      },
    });
    seeded.push(record);
  }
  console.log(`✅ Seeded ${seeded.length} global permissions successfully.`);
  return seeded;
}

export async function seed() {
  await seedPermissions();
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
