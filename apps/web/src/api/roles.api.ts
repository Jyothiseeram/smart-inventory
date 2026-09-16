import { apiRequest } from "./client";
import type { Role } from "../types";

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export const rolesApi = {
  async getRoles(orgId: string): Promise<{ roles: Role[] }> {
    return apiRequest<{ roles: Role[] }>(`/api/organizations/${orgId}/roles`, {
      method: "GET",
    });
  },

  async getRole(orgId: string, roleId: string): Promise<{ role: Role }> {
    return apiRequest<{ role: Role }>(`/api/organizations/${orgId}/roles/${roleId}`, {
      method: "GET",
    });
  },

  async createCustomRole(
    orgId: string,
    data: CreateRoleInput
  ): Promise<{ message: string; role: Role }> {
    return apiRequest<{ message: string; role: Role }>(
      `/api/organizations/${orgId}/roles`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  async updateRolePermissions(
    orgId: string,
    roleId: string,
    permissions: string[]
  ): Promise<{ message: string; roleId: string; permissions: string[] }> {
    return apiRequest<{ message: string; roleId: string; permissions: string[] }>(
      `/api/organizations/${orgId}/roles/${roleId}/permissions`,
      {
        method: "PUT",
        body: JSON.stringify({ permissions }),
      }
    );
  },

  async deleteRole(
    orgId: string,
    roleId: string
  ): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
      `/api/organizations/${orgId}/roles/${roleId}`,
      {
        method: "DELETE",
      }
    );
  },
};
