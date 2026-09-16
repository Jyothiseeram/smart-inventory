export type BusinessType =
  | "MEDICAL"
  | "FURNITURE"
  | "ELECTRONICS"
  | "FASHION"
  | "GENERAL"
  | "OTHER";

export interface User {
  id: string;
  name: string;
  email: string;
  status?: string;
}

export interface UserMembership {
  organizationId: string;
  organizationName: string;
  businessType: BusinessType;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
}

export interface Organization {
  id: string;
  name: string;
  businessType: BusinessType;
  status: string;
  createdAt: string;
  counts?: {
    members: number;
    roles: number;
    invitations: number;
  };
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  status: string;
  memberCount?: number;
  permissionCount?: number;
  permissions?: string[];
  createdAt: string;
}

export interface Permission {
  name: string;
  description: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
  status: string;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  expiresAt: string;
  invitedBy: string | null;
  createdAt: string;
  rawToken?: string;
}

export interface PermissionCheckResult {
  permission: string;
  allowed: boolean;
  statusCode: number;
  message: string;
}

export interface RoleMatrix {
  allPermissions: Permission[];
  roles: Array<{
    id: string;
    name: string;
    isSystem: boolean;
    permissions: string[];
  }>;
}

export interface BusinessTypeTemplatePreview {
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: string[];
}
