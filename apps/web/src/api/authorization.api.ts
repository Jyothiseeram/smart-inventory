import { apiRequest } from "./client";
import type { Permission, PermissionCheckResult, RoleMatrix } from "../types";

export interface PermissionsResponse {
  allPermissions: Permission[];
  userPermissions: string[];
  roleName: string;
  isOwner: boolean;
}

export interface CheckAllResponse {
  results: Record<string, boolean>;
  grantedCount: number;
  totalCount: number;
}

export const authorizationApi = {
  async getPermissions(orgId: string): Promise<PermissionsResponse> {
    return apiRequest<PermissionsResponse>(
      `/api/organizations/${orgId}/authorization/permissions`,
      { method: "GET" }
    );
  },

  async checkPermission(
    orgId: string,
    permission: string
  ): Promise<PermissionCheckResult> {
    return apiRequest<PermissionCheckResult>(
      `/api/organizations/${orgId}/authorization/check-permission`,
      {
        method: "POST",
        body: JSON.stringify({ permission }),
      }
    );
  },

  async checkAll(orgId: string): Promise<CheckAllResponse> {
    return apiRequest<CheckAllResponse>(
      `/api/organizations/${orgId}/authorization/check-all`,
      { method: "POST" }
    );
  },

  async getRoleMatrix(orgId: string): Promise<RoleMatrix> {
    return apiRequest<RoleMatrix>(
      `/api/organizations/${orgId}/authorization/matrix`,
      { method: "GET" }
    );
  },
};
