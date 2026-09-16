import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { authorizationApi } from "../api/authorization.api";
import type { Permission, PermissionCheckResult, RoleMatrix } from "../types";
import { PERMISSION_CATEGORIES } from "./RolesView";

export const AuthorizationView: React.FC = () => {
  const { activeOrgId, user, activeMembership } = useAuth();

  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Single Permission Tester State
  const [testPermission, setTestPermission] = useState<string>("STOCK_UPDATE");
  const [customPermission, setCustomPermission] = useState<string>("");
  const [isCheckingSingle, setIsCheckingSingle] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<PermissionCheckResult | null>(null);

  // All Permissions Audit State
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);
  const [allAuditResults, setAllAuditResults] = useState<Record<string, boolean> | null>(null);

  const loadAuthzData = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [permRes, matrixRes] = await Promise.all([
        authorizationApi.getPermissions(activeOrgId),
        authorizationApi.getRoleMatrix(activeOrgId),
      ]);

      setAllPermissions(permRes.allPermissions);
      setUserPermissions(new Set(permRes.userPermissions));
      setMatrix(matrixRes);
    } catch (err: any) {
      setError(err.message || "Failed to load authorization data");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    loadAuthzData();
  }, [loadAuthzData]);

  const handleTestSinglePermission = async (permName: string) => {
    if (!activeOrgId || !permName.trim()) return;
    setIsCheckingSingle(true);
    setCheckResult(null);

    try {
      const res = await authorizationApi.checkPermission(activeOrgId, permName.trim());
      setCheckResult(res);
    } catch (err: any) {
      setCheckResult({
        permission: permName,
        allowed: false,
        statusCode: 500,
        message: err.message || "Request failed",
      });
    } finally {
      setIsCheckingSingle(false);
    }
  };

  const handleAuditAllPermissions = async () => {
    if (!activeOrgId) return;
    setIsCheckingAll(true);
    try {
      const res = await authorizationApi.checkAll(activeOrgId);
      setAllAuditResults(res.results);
    } catch (err: any) {
      setError(err.message || "Failed to audit all permissions");
    } finally {
      setIsCheckingAll(false);
    }
  };

  if (isLoading && allPermissions.length === 0) {
    return <div className="view-container loading-box">Loading authorization test bench...</div>;
  }

  return (
    <div className="view-container">
      <div className="view-header-bar">
        <div>
          <h2>⚡ Permission-Based Authorization Tester</h2>
          <p className="text-muted">
            Authorization in Smart Inventory evaluates granular permission flags (e.g.{" "}
            <code>STOCK_UPDATE</code>), not literal role names. Live test your permissions against
            the backend authorization engine.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Live Single Permission Checker Card */}
      <div className="card authz-tester-card">
        <div className="card-header">
          <div>
            <h3>Live Permission Guard Verification</h3>
            <p className="text-muted">
              Calls <code>POST /api/organizations/:orgId/check-permission</code> with caller&apos;s
              context (User: <strong>{user?.email}</strong> &bull; Role:{" "}
              <strong>{activeMembership?.roleName}</strong>).
            </p>
          </div>
          <span className="badge badge-system">Authoritative Backend Check</span>
        </div>

        <div className="card-body">
          <div className="checker-form-row">
            <div className="form-group flex-1">
              <label htmlFor="select-perm">Select System Permission:</label>
              <select
                id="select-perm"
                value={testPermission}
                onChange={(e) => {
                  setTestPermission(e.target.value);
                  setCustomPermission("");
                }}
              >
                {allPermissions.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} — {p.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="custom-perm">Or Type Any Permission String:</label>
              <input
                id="custom-perm"
                type="text"
                value={customPermission}
                onChange={(e) => setCustomPermission(e.target.value)}
                placeholder="e.g. INVENTORY_DESTROY, UNKNOWN_PERM"
              />
            </div>

            <div className="form-group">
              <label>&nbsp;</label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isCheckingSingle}
                onClick={() =>
                  handleTestSinglePermission(
                    customPermission.trim() ? customPermission.trim() : testPermission
                  )
                }
              >
                {isCheckingSingle ? "Evaluating..." : "Check Permission"}
              </button>
            </div>
          </div>

          {/* Result Card */}
          {checkResult && (
            <div
              className={`authz-result-card ${
                checkResult.allowed ? "result-allowed" : "result-denied"
              }`}
            >
              <div className="result-indicator-col">
                <span className="result-large-icon">{checkResult.allowed ? "✅" : "⛔"}</span>
                <span className="result-verdict">
                  {checkResult.allowed ? "ALLOWED (200)" : "DENIED (403)"}
                </span>
              </div>

              <div className="result-detail-col">
                <div className="result-headline">
                  <span>
                    Tested Permission: <code>{checkResult.permission}</code>
                  </span>
                  <span className="badge badge-business">
                    Organization: {activeMembership?.organizationName}
                  </span>
                </div>
                <p className="result-explanation">{checkResult.message}</p>
                <div className="result-subtext">
                  <span>Evaluated against User Role: <strong>{activeMembership?.roleName}</strong></span>
                  <span>Backend Guard: <code>hasPermission(userId, orgId, permission)</code></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User's Current Permissions Audit Grid */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>
              Your Active Permissions ({userPermissions.size}/23)
            </h3>
            <p className="text-muted">
              Live snapshot of permissions currently granted to role{" "}
              <strong>{activeMembership?.roleName}</strong>.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={isCheckingAll}
            onClick={handleAuditAllPermissions}
          >
            {isCheckingAll ? "Auditing..." : "🔄 Run Full Backend Audit"}
          </button>
        </div>

        <div className="card-body">
          <div className="user-perm-grid">
            {allPermissions.map((perm) => {
              const hasPerm = allAuditResults
                ? allAuditResults[perm.name]
                : userPermissions.has(perm.name);

              return (
                <div
                  key={perm.name}
                  className={`user-perm-card ${hasPerm ? "has-perm" : "lacks-perm"}`}
                  onClick={() => {
                    setTestPermission(perm.name);
                    setCustomPermission("");
                    handleTestSinglePermission(perm.name);
                  }}
                  title="Click to test this permission"
                >
                  <div className="user-perm-status">
                    <span className="status-symbol">{hasPerm ? "✓" : "✗"}</span>
                    <span className="status-text">{hasPerm ? "GRANTED" : "DENIED"}</span>
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

      {/* Role vs Permission Matrix */}
      {matrix && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Organization Role vs. Permission Matrix</h3>
              <p className="text-muted">
                Compares all roles registered in this organization across the 23 system permissions.
              </p>
            </div>
          </div>

          <div className="card-body table-responsive">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="matrix-header-col">Permission Name</th>
                  {matrix.roles.map((role) => (
                    <th key={role.id} className="matrix-role-header">
                      <div className="role-col-title">{role.name}</div>
                      {role.isSystem ? (
                        <span className="badge badge-system text-tiny">System</span>
                      ) : (
                        <span className="badge badge-custom text-tiny">Custom</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                  <React.Fragment key={category}>
                    <tr className="matrix-category-row">
                      <td colSpan={matrix.roles.length + 1} className="matrix-category-cell">
                        📁 {category}
                      </td>
                    </tr>
                    {perms.map((permName) => {
                      const permObj = allPermissions.find((p) => p.name === permName);
                      return (
                        <tr key={permName} className="matrix-data-row">
                          <td className="matrix-perm-cell">
                            <strong>{permName}</strong>
                            <div className="text-muted text-tiny">{permObj?.description}</div>
                          </td>
                          {matrix.roles.map((role) => {
                            const isAssigned = role.permissions.includes(permName);
                            return (
                              <td
                                key={role.id}
                                className={`matrix-cell ${isAssigned ? "cell-assigned" : "cell-empty"}`}
                              >
                                {isAssigned ? (
                                  <span className="matrix-check" title={`${role.name} has ${permName}`}>
                                    ✓
                                  </span>
                                ) : (
                                  <span className="matrix-dash">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
