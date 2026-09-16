-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('FURNITURE', 'MEDICAL', 'ELECTRONICS', 'FASHION', 'GENERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "employee_invitations" DROP CONSTRAINT "employee_invitations_role_id_fkey";

-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_role_id_fkey";

-- DropIndex
DROP INDEX "roles_name_key";

-- Clean existing placeholder global roles before adding NOT NULL organization_id
TRUNCATE TABLE "role_permissions", "roles" CASCADE;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "business_type" "BusinessType" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "organization_id" UUID NOT NULL,
ADD COLUMN     "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "organizations_business_type_idx" ON "organizations"("business_type");

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- CreateIndex
CREATE INDEX "roles_status_idx" ON "roles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_id_organization_id_key" ON "roles"("id", "organization_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_organization_id_fkey" FOREIGN KEY ("role_id", "organization_id") REFERENCES "roles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_role_id_organization_id_fkey" FOREIGN KEY ("role_id", "organization_id") REFERENCES "roles"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
