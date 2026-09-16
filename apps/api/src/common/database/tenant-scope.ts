import { ForbiddenError, ValidationError } from "../errors/app-error.js";

/**
 * Ensures an organizationId is valid and merges it with existing query conditions.
 * Prevents developers from writing queries that accidentally bypass multi-tenant isolation.
 */
export function forOrganization<T extends Record<string, unknown>>(
  organizationId: string,
  filter?: T
): T & { organizationId: string } {
  if (!organizationId || typeof organizationId !== "string" || organizationId.trim().length === 0) {
    throw new ValidationError("Valid organizationId is required for tenant-scoped operations");
  }

  return {
    ...(filter || {}),
    organizationId: organizationId.trim(),
  } as T & { organizationId: string };
}

/**
 * Validates that an entity retrieved from the database belongs to the caller's active organization.
 * Throws ForbiddenError (403) on cross-tenant mismatch.
 */
export function assertTenantAccess(
  entityOrganizationId: string,
  callerOrganizationId: string,
  resourceName = "Resource"
): void {
  if (!entityOrganizationId || !callerOrganizationId || entityOrganizationId !== callerOrganizationId) {
    throw new ForbiddenError(
      `Multi-Tenant Isolation Enforced: ${resourceName} does not belong to organization '${callerOrganizationId}'. Access denied.`,
      { entityOrganizationId, callerOrganizationId }
    );
  }
}
