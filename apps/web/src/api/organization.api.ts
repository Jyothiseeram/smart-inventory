import { apiRequest } from "./client";
import type { Organization } from "../types";

export interface OrgDetailsResponse {
  organization: Organization;
  callerMembership: {
    roleId: string;
    roleName: string;
    status: string;
  } | null;
}

export interface AccessTestResponse {
  status?: string;
  tenantAllowed: boolean;
  message: string;
  organization?: {
    id: string;
    name: string;
    businessType: string;
  };
  role?: string;
  error?: string;
}

export const organizationApi = {
  async getOrganization(orgId: string): Promise<OrgDetailsResponse> {
    return apiRequest<OrgDetailsResponse>(`/api/organizations/${orgId}`, {
      method: "GET",
    });
  },

  async testAccess(orgId: string): Promise<AccessTestResponse> {
    try {
      return await apiRequest<AccessTestResponse>(
        `/api/organizations/${orgId}/access-test`,
        { method: "GET" }
      );
    } catch (err: any) {
      if (err.statusCode === 403 && err.data) {
        return err.data as AccessTestResponse;
      }
      throw err;
    }
  },
};
