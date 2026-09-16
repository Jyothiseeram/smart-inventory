import { apiRequest } from "./client";
import type { BusinessType, User, UserMembership, Organization } from "../types";

export interface RegisterOrgInput {
  userName: string;
  email: string;
  password: string;
  organizationName: string;
  businessType: BusinessType;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
  organization?: Organization;
  memberships: UserMembership[];
}

export interface AcceptInvitationInput {
  token: string;
  name: string;
  password: string;
}

export const authApi = {
  async registerOrg(data: RegisterOrgInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/api/auth/register-org", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<{ message: string }> {
    return apiRequest<{ message: string }>("/api/auth/logout", {
      method: "POST",
    });
  },

  async acceptInvitation(data: AcceptInvitationInput): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/api/auth/accept-invitation", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getMe(): Promise<{ user: User; memberships: UserMembership[] }> {
    return apiRequest<{ user: User; memberships: UserMembership[] }>("/api/auth/me", {
      method: "GET",
    });
  },

  async checkHealth(): Promise<{ status: string; service: string }> {
    return apiRequest<{ status: string; service: string }>("/health", {
      method: "GET",
    });
  },
};
