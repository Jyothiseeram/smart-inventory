import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User, UserMembership } from "../types";
import { authApi, type RegisterOrgInput } from "../api/auth.api";
import { authorizationApi } from "../api/authorization.api";
import {
  getStoredToken,
  setStoredToken,
  getStoredOrgId,
  setStoredOrgId,
} from "../api/client";

interface AuthContextType {
  user: User | null;
  token: string | null;
  memberships: UserMembership[];
  activeOrgId: string | null;
  activeMembership: UserMembership | null;
  permissions: string[];
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  registerOrg: (data: RegisterOrgInput) => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissionNames: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(getStoredOrgId());
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeMembership =
    memberships.find((m) => m.organizationId === activeOrgId) ||
    memberships[0] ||
    null;

  const refreshPermissionsForOrg = useCallback(async (orgId: string | null) => {
    if (!orgId) {
      setPermissions([]);
      return;
    }
    try {
      const res = await authorizationApi.getPermissions(orgId);
      setPermissions(res.userPermissions || []);
    } catch (err: any) {
      console.warn("Failed to load permissions for org:", err.message);
      setPermissions([]);
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setMemberships([]);
      setActiveOrgId(null);
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await authApi.getMe();
      setUser(res.user);
      setMemberships(res.memberships);

      const storedOrgId = getStoredOrgId();
      const hasStoredOrg = res.memberships.some((m) => m.organizationId === storedOrgId);

      let targetOrgId: string | null = null;
      if (storedOrgId && hasStoredOrg) {
        targetOrgId = storedOrgId;
      } else if (res.memberships.length > 0 && res.memberships[0]) {
        targetOrgId = res.memberships[0].organizationId;
        setStoredOrgId(targetOrgId);
      } else {
        setStoredOrgId(null);
      }

      setActiveOrgId(targetOrgId);
      if (targetOrgId) {
        await refreshPermissionsForOrg(targetOrgId);
      } else {
        setPermissions([]);
      }
    } catch (err: any) {
      console.warn("Failed to refresh user session:", err.message);
      setStoredToken(null);
      setStoredOrgId(null);
      setToken(null);
      setUser(null);
      setMemberships([]);
      setActiveOrgId(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshPermissionsForOrg]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setMemberships(res.memberships);

      if (res.memberships.length > 0 && res.memberships[0]) {
        const primaryOrgId = res.memberships[0].organizationId;
        setActiveOrgId(primaryOrgId);
        setStoredOrgId(primaryOrgId);
        await refreshPermissionsForOrg(primaryOrgId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerOrg = async (data: RegisterOrgInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.registerOrg(data);
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      setMemberships(res.memberships);

      const orgId = res.organization?.id || (res.memberships[0] ? res.memberships[0].organizationId : null);
      if (orgId) {
        setActiveOrgId(orgId);
        setStoredOrgId(orgId);
        await refreshPermissionsForOrg(orgId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to register organization");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrganization = async (orgId: string) => {
    const exists = memberships.some((m) => m.organizationId === orgId);
    if (exists) {
      setActiveOrgId(orgId);
      setStoredOrgId(orgId);
      await refreshPermissionsForOrg(orgId);
    }
  };

  const refreshPermissions = async () => {
    if (activeOrgId) {
      await refreshPermissionsForOrg(activeOrgId);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("Backend logout error:", err);
    } finally {
      setStoredToken(null);
      setStoredOrgId(null);
      setToken(null);
      setUser(null);
      setMemberships([]);
      setActiveOrgId(null);
      setPermissions([]);
      setError(null);
    }
  };

  const hasPermission = (permissionName: string): boolean => {
    return permissions.includes(permissionName);
  };

  const hasAnyPermission = (permissionNames: string[]): boolean => {
    return permissionNames.some((p) => permissions.includes(p));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        memberships,
        activeOrgId,
        activeMembership,
        permissions,
        isLoading,
        error,
        login,
        registerOrg,
        switchOrganization,
        logout,
        refreshMe,
        refreshPermissions,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
