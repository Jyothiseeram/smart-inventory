import { apiRequest } from "./client";
import type { Member, Invitation } from "../types";

export interface EmployeesResponse {
  members: Member[];
  invitations: Invitation[];
}

export interface InviteEmployeeInput {
  email: string;
  roleId: string;
}

export interface InviteResponse {
  message: string;
  invitation: Invitation;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

export const employeesApi = {
  async getEmployees(orgId: string): Promise<EmployeesResponse> {
    return apiRequest<EmployeesResponse>(`/api/organizations/${orgId}/employees`, {
      method: "GET",
    });
  },

  async inviteEmployee(
    orgId: string,
    data: InviteEmployeeInput
  ): Promise<InviteResponse> {
    return apiRequest<InviteResponse>(
      `/api/organizations/${orgId}/employees/invitations`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  async createEmployee(
    orgId: string,
    data: CreateEmployeeInput
  ): Promise<{ message: string; member: Member }> {
    return apiRequest<{ message: string; member: Member }>(
      `/api/organizations/${orgId}/employees`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  async updateMemberRole(
    orgId: string,
    memberId: string,
    roleId: string
  ): Promise<{ message: string; member: Member }> {
    return apiRequest<{ message: string; member: Member }>(
      `/api/organizations/${orgId}/employees/${memberId}/role`,
      {
        method: "PUT",
        body: JSON.stringify({ roleId }),
      }
    );
  },

  async updateMemberStatus(
    orgId: string,
    memberId: string,
    status: string
  ): Promise<{ message: string; member: Member }> {
    return apiRequest<{ message: string; member: Member }>(
      `/api/organizations/${orgId}/employees/${memberId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    );
  },

  async removeMember(
    orgId: string,
    memberId: string
  ): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
      `/api/organizations/${orgId}/employees/${memberId}`,
      {
        method: "DELETE",
      }
    );
  },
};
