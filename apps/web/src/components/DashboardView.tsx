import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { organizationApi, type OrgDetailsResponse, type AccessTestResponse } from "../api/organization.api";
import { authorizationApi } from "../api/authorization.api";
import { useNavigate } from "../routes/Router";
import type { Permission } from "../types";

export const DashboardView: React.FC = () => {
  const { activeMembership, activeOrgId, user, permissions, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [orgDetails, setOrgDetails] = useState<OrgDetailsResponse | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tenant Isolation Test state
  const [testOrgId, setTestOrgId] = useState<string>("00000000-0000-0000-0000-000000000000");
  const [testResult, setTestResult] = useState<AccessTestResponse | null>(null);
  const [isTestingAccess, setIsTestingAccess] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [orgData, permData] = await Promise.all([
        organizationApi.getOrganization(activeOrgId),
        authorizationApi.getPermissions(activeOrgId),
      ]);
      setOrgDetails(orgData);
      setAllPermissions(permData.allPermissions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load organization details");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleTestTenantIsolation = async (targetId: string) => {
    setIsTestingAccess(true);
    setTestResult(null);
    try {
      const res = await organizationApi.testAccess(targetId);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        tenantAllowed: false,
        message: err.message || "Access test request failed",
        error: "Request Error",
      });
    } finally {
      setIsTestingAccess(false);
    }
  };

  if (isLoading) {
    return <div className="view-container loading-box">Loading organization dashboard...</div>;
  }

  if (error || !orgDetails) {
    return (
      <div className="view-container">
        <div className="alert alert-error">{error || "Organization not found"}</div>
      </div>
    );
  }

  const { organization } = orgDetails;
  const userPermSet = new Set(permissions);

  return (
    <div className="view-container dashboard-container">
      {/* Welcome Banner */}
      <div className="card org-header-card">
        <div className="org-header-left">
          <div className="org-avatar">🏢</div>
          <div>
            <div className="org-title-row">
              <h2>Welcome, {user?.name || "User"}</h2>
              <span className="badge badge-business">{organization.businessType}</span>
              <span className="badge badge-active">{organization.status}</span>
            </div>
            <p className="tenant-id-text">
              <strong>Organization:</strong> {organization.name} &bull;{" "}
              <strong>Account Status:</strong> <span className="badge badge-active">{user?.status || "ACTIVE"}</span> &bull;{" "}
              <strong>Tenant ID:</strong> <code>{organization.id}</code>
            </p>
          </div>
        </div>

        <div className="org-header-right">
          <div className="membership-pill">
            <span className="pill-label">Role:</span>
            <span className="pill-role">{activeMembership?.roleName || "Member"}</span>
            {activeMembership?.isSystemRole && (
              <span className="badge badge-system">System Owner</span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-icon">🛡️</span>
          <div className="metric-data">
            <span className="metric-value">{organization.counts?.roles || 0}</span>
            <span className="metric-label">Organization Roles</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">👥</span>
          <div className="metric-data">
            <span className="metric-value">{organization.counts?.members || 0}</span>
            <span className="metric-label">Active Members</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">✉️</span>
          <div className="metric-data">
            <span className="metric-value">{organization.counts?.invitations || 0}</span>
            <span className="metric-label">Pending Invitations</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">🔑</span>
          <div className="metric-data">
            <span className="metric-value">{permissions.length} / 23</span>
            <span className="metric-label">Permissions Granted</span>
          </div>
        </div>
      </div>

      {/* Role-Based Navigation & Feature Gates (Section 11) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>🚀 Role-Based Application Modules</h3>
            <p className="text-muted">
              Module availability is governed dynamically by backend permission checks, not hardcoded role names.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div className="role-modules-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {/* Team / Members */}
            <div
              className={`module-gate-card ${hasPermission("EMPLOYEE_VIEW") ? "enabled" : "disabled"}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                background: hasPermission("EMPLOYEE_VIEW") ? "#ffffff" : "#f1f5f9",
                opacity: hasPermission("EMPLOYEE_VIEW") ? 1 : 0.6,
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>👥</div>
              <h4 style={{ margin: "0 0 4px 0" }}>Team & Members</h4>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
                Required: <code>EMPLOYEE_VIEW</code>
              </p>
              {hasPermission("EMPLOYEE_VIEW") ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-block"
                  onClick={() => navigate("/members")}
                >
                  Manage Members
                </button>
              ) : (
                <span className="badge badge-warning text-small">Restricted (403)</span>
              )}
            </div>

            {/* Roles Management */}
            <div
              className={`module-gate-card ${hasPermission("ORGANIZATION_MANAGE") ? "enabled" : "disabled"}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                background: hasPermission("ORGANIZATION_MANAGE") ? "#ffffff" : "#f1f5f9",
                opacity: hasPermission("ORGANIZATION_MANAGE") ? 1 : 0.6,
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🛡️</div>
              <h4 style={{ margin: "0 0 4px 0" }}>Roles & RBAC</h4>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
                Required: <code>ORGANIZATION_MANAGE</code>
              </p>
              {hasPermission("ORGANIZATION_MANAGE") ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-block"
                  onClick={() => navigate("/roles")}
                >
                  Manage Roles
                </button>
              ) : (
                <span className="badge badge-warning text-small">Restricted (403)</span>
              )}
            </div>

            {/* Inventory (Phase 2 Preview) */}
            <div
              className={`module-gate-card ${hasPermission("STOCK_VIEW") || hasPermission("PRODUCT_VIEW") ? "enabled" : "disabled"}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                background: hasPermission("STOCK_VIEW") ? "#ffffff" : "#f1f5f9",
                opacity: hasPermission("STOCK_VIEW") ? 1 : 0.6,
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>📦</div>
              <h4 style={{ margin: "0 0 4px 0" }}>Inventory & Stock</h4>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
                Required: <code>STOCK_VIEW</code>
              </p>
              {hasPermission("STOCK_VIEW") ? (
                <span className="badge badge-active text-small">Authorized (Phase 2)</span>
              ) : (
                <span className="badge badge-warning text-small">Restricted (403)</span>
              )}
            </div>

            {/* Sales (Phase 2 Preview) */}
            <div
              className={`module-gate-card ${hasPermission("SALE_VIEW") || hasPermission("SALE_CREATE") ? "enabled" : "disabled"}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                background: hasPermission("SALE_CREATE") ? "#ffffff" : "#f1f5f9",
                opacity: hasPermission("SALE_CREATE") ? 1 : 0.6,
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>💰</div>
              <h4 style={{ margin: "0 0 4px 0" }}>Sales & Orders</h4>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
                Required: <code>SALE_CREATE</code>
              </p>
              {hasPermission("SALE_CREATE") ? (
                <span className="badge badge-active text-small">Authorized (Phase 2)</span>
              ) : (
                <span className="badge badge-warning text-small">Restricted (403)</span>
              )}
            </div>

            {/* Suppliers (Phase 4A) */}
            <div
              className={`module-gate-card ${hasPermission("SUPPLIER_VIEW") ? "enabled" : "disabled"}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                background: hasPermission("SUPPLIER_VIEW") ? "#ffffff" : "#f1f5f9",
                opacity: hasPermission("SUPPLIER_VIEW") ? 1 : 0.6,
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🚚</div>
              <h4 style={{ margin: "0 0 4px 0" }}>Suppliers</h4>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
                Required: <code>SUPPLIER_VIEW</code>
              </p>
              {hasPermission("SUPPLIER_VIEW") ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm btn-block"
                  onClick={() => navigate("/suppliers")}
                >
                  Manage Suppliers
                </button>
              ) : (
                <span className="badge badge-warning text-small">Restricted (403)</span>
              )}
            </div>

            {/* Permissions Tester */}
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "16px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚡</div>
              <h4 style={{ margin: "0 0 4px 0" }}>Authz Tester</h4>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
                Full system permissions
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-block"
                onClick={() => navigate("/permissions")}
              >
                Inspect All Permissions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Your Permissions Checklist (Section 10) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Your Permissions Checklist</h3>
            <p className="text-muted">
              Live authorization status for active role <strong>{activeMembership?.roleName}</strong> across all 23 permissions.
            </p>
          </div>
          <span className="badge badge-system">
            {permissions.length} Granted &bull; {23 - permissions.length} Denied
          </span>
        </div>
        <div className="card-body">
          <div className="user-perm-grid">
            {allPermissions.map((perm) => {
              const has = userPermSet.has(perm.name);
              return (
                <div
                  key={perm.name}
                  className={`user-perm-card ${has ? "has-perm" : "lacks-perm"}`}
                >
                  <div className="user-perm-status">
                    <span className="status-symbol">{has ? "✓" : "✗"}</span>
                    <span className="status-text">{has ? "GRANTED" : "DENIED"}</span>
                  </div>
                  <div className="user-perm-info">
                    <strong className="perm-code">{perm.name}</strong>
                    <span className="perm-desc">{perm.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tenant Isolation Security Test Section */}
      <div className="card security-test-card">
        <div className="card-header">
          <div>
            <h3>🧪 Multi-Tenant Security Isolation Test</h3>
            <p className="text-muted">
              Live verification: Attempt to access an arbitrary or foreign organization ID using the
              current user&apos;s session. The backend endpoint enforces strict tenant boundaries and
              rejects unauthorized tenants with <code>403 Forbidden</code>.
            </p>
          </div>
          <span className="badge badge-warning">Live Backend Check</span>
        </div>

        <div className="card-body">
          <div className="test-controls">
            <div className="form-group flex-grow">
              <label htmlFor="target-org-id">Target Organization ID to Query:</label>
              <input
                id="target-org-id"
                type="text"
                value={testOrgId}
                onChange={(e) => setTestOrgId(e.target.value)}
                placeholder="Target Organization UUID"
              />
            </div>

            <div className="test-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={isTestingAccess || !testOrgId}
                onClick={() => handleTestTenantIsolation(testOrgId)}
              >
                {isTestingAccess ? "Testing..." : "Test Cross-Tenant Isolation"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setTestOrgId(organization.id);
                  handleTestTenantIsolation(organization.id);
                }}
              >
                Test Current Org (Should Allow)
              </button>
            </div>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div
              className={`test-result-box ${
                testResult.tenantAllowed ? "result-allowed" : "result-denied"
              }`}
            >
              <div className="result-header">
                <span className="result-status-pill">
                  {testResult.tenantAllowed ? "✅ 200 OK: ACCESS ALLOWED" : "⛔ 403 FORBIDDEN: TENANT ISOLATION ENFORCED"}
                </span>
                <span className="text-small text-muted">Caller: {user?.email}</span>
              </div>
              <p className="result-message">{testResult.message}</p>
              {testResult.organization && (
                <div className="result-details">
                  <span>
                    Tenant: <strong>{testResult.organization.name}</strong> ({testResult.organization.businessType})
                  </span>
                  <span>
                    Role: <strong>{testResult.role}</strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
