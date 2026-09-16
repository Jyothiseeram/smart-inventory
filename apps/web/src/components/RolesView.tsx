import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { rolesApi } from "../api/roles.api";
import { authorizationApi } from "../api/authorization.api";
import type { Role, Permission } from "../types";

export const PERMISSION_CATEGORIES: Record<string, string[]> = {
  "Products Catalogue": [
    "PRODUCT_VIEW",
    "PRODUCT_CREATE",
    "PRODUCT_UPDATE",
    "PRODUCT_DELETE",
  ],
  "Inventory & Stock": [
    "STOCK_VIEW",
    "STOCK_UPDATE",
    "STOCK_ADJUST",
  ],
  "Sales & Billing": [
    "SALE_VIEW",
    "SALE_CREATE",
    "SALE_UPDATE",
    "SALE_CANCEL",
  ],
  "Suppliers": [
    "SUPPLIER_VIEW",
    "SUPPLIER_CREATE",
    "SUPPLIER_UPDATE",
  ],
  "Team & Employees": [
    "EMPLOYEE_VIEW",
    "EMPLOYEE_CREATE",
    "EMPLOYEE_INVITE",
    "EMPLOYEE_UPDATE",
    "EMPLOYEE_REMOVE",
  ],
  "Reporting & Analytics": [
    "REPORT_VIEW",
  ],
  "Administration & Settings": [
    "SETTINGS_VIEW",
    "SETTINGS_UPDATE",
    "ORGANIZATION_MANAGE",
  ],
};

export const RolesView: React.FC = () => {
  const { activeOrgId, hasPermission } = useAuth();
  const canManageRoles = hasPermission("ORGANIZATION_MANAGE");

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create Role Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Permissions State
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [rolesRes, authzRes] = await Promise.all([
        rolesApi.getRoles(activeOrgId),
        authorizationApi.getPermissions(activeOrgId),
      ]);
      setRoles(rolesRes.roles);
      setAllPermissions(authzRes.allPermissions);

      // Keep selectedRole synced
      if (selectedRole) {
        const updatedSelected = rolesRes.roles.find((r) => r.id === selectedRole.id);
        setSelectedRole(updatedSelected || rolesRes.roles[0] || null);
      } else if (rolesRes.roles.length > 0) {
        setSelectedRole(rolesRes.roles[0] || null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, selectedRole?.id]);

  useEffect(() => {
    loadData();
  }, [activeOrgId]);

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setIsEditingPermissions(false);
  };

  const handleTogglePermCheckbox = (permName: string) => {
    const next = new Set(selectedPermissions);
    if (next.has(permName)) {
      next.delete(permName);
    } else {
      next.add(permName);
    }
    setSelectedPermissions(next);
  };

  const handleToggleCategory = (perms: string[]) => {
    const allSelected = perms.every((p) => selectedPermissions.has(p));
    const next = new Set(selectedPermissions);
    if (allSelected) {
      perms.forEach((p) => next.delete(p));
    } else {
      perms.forEach((p) => next.add(p));
    }
    setSelectedPermissions(next);
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !newRoleName.trim()) return;

    setIsSubmitting(true);
    setCreateError(null);

    try {
      const res = await rolesApi.createCustomRole(activeOrgId, {
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
        permissions: Array.from(selectedPermissions),
      });

      setIsCreateModalOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedPermissions(new Set());

      await loadData();
      setSelectedRole(res.role);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create custom role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditing = () => {
    if (!selectedRole) return;
    setEditPermissions(new Set(selectedRole.permissions || []));
    setIsEditingPermissions(true);
    setUpdateError(null);
  };

  const handleToggleEditPerm = (permName: string) => {
    const next = new Set(editPermissions);
    if (next.has(permName)) {
      next.delete(permName);
    } else {
      next.add(permName);
    }
    setEditPermissions(next);
  };

  const handleSaveEditedPermissions = async () => {
    if (!activeOrgId || !selectedRole) return;
    setIsUpdating(true);
    setUpdateError(null);

    try {
      await rolesApi.updateRolePermissions(
        activeOrgId,
        selectedRole.id,
        Array.from(editPermissions)
      );
      setIsEditingPermissions(false);
      await loadData();
    } catch (err: any) {
      setUpdateError(err.message || "Failed to update role permissions");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!activeOrgId) return;
    const confirm = window.confirm(`Are you sure you want to delete role '${role.name}'?`);
    if (!confirm) return;

    try {
      await rolesApi.deleteRole(activeOrgId, role.id);
      setSelectedRole(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete role: ${err.message}`);
    }
  };

  if (isLoading && roles.length === 0) {
    return <div className="view-container loading-box">Loading organization roles...</div>;
  }

  return (
    <div className="view-container">
      <div className="view-header-bar">
        <div>
          <h2>Organization Roles & Permissions</h2>
          <p className="text-muted">
            All roles are strictly scoped to this organization. Create custom roles or tailor permissions without affecting any other tenant.
          </p>
        </div>
        {canManageRoles && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsCreateModalOpen(true);
              setCreateError(null);
            }}
          >
            ➕ Create Custom Role
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="roles-layout">
        {/* Roles List */}
        <div className="roles-list-pane">
          <div className="pane-header">
            <h3>Roles in Tenant ({roles.length})</h3>
          </div>
          <div className="roles-stack">
            {roles.map((role) => (
              <div
                key={role.id}
                className={`role-item-card ${selectedRole?.id === role.id ? "selected" : ""}`}
                onClick={() => handleSelectRole(role)}
              >
                <div className="role-item-top">
                  <span className="role-item-name">{role.name}</span>
                  {role.isSystem ? (
                    <span className="badge badge-system">System Default</span>
                  ) : (
                    <span className="badge badge-custom">Custom Role</span>
                  )}
                </div>
                <p className="role-item-desc">{role.description || "No description provided."}</p>
                <div className="role-item-meta">
                  <span className="meta-tag">
                    🔑 {role.permissionCount ?? role.permissions?.length ?? 0} permissions
                  </span>
                  <span className="meta-tag">
                    👤 {role.memberCount ?? 0} members
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Role Detail & Permissions */}
        <div className="role-detail-pane">
          {selectedRole ? (
            <div className="card">
              <div className="role-detail-header">
                <div>
                  <div className="role-title-row">
                    <h3>{selectedRole.name}</h3>
                    {selectedRole.isSystem ? (
                      <span className="badge badge-system">System Template</span>
                    ) : (
                      <span className="badge badge-custom">Custom Role</span>
                    )}
                  </div>
                  <p className="text-muted">{selectedRole.description || "No description."}</p>
                  <p className="text-small text-muted">
                    <strong>Role ID:</strong> <code>{selectedRole.id}</code> &bull;{" "}
                    <strong>Organization ID:</strong> <code>{selectedRole.organizationId}</code>
                  </p>
                </div>

                <div className="detail-actions">
                  {canManageRoles && (
                    <>
                      {!isEditingPermissions ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleStartEditing}
                          >
                            ✏️ Edit Permissions
                          </button>
                          {!selectedRole.isSystem && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteRole(selectedRole)}
                            >
                              🗑️ Delete Role
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="edit-action-btns">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            disabled={isUpdating}
                            onClick={handleSaveEditedPermissions}
                          >
                            {isUpdating ? "Saving..." : "💾 Save Changes"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsEditingPermissions(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {updateError && (
                <div className="alert alert-error">
                  <strong>Update Error:</strong> {updateError}
                </div>
              )}

              {/* Permissions Breakdown by Domain */}
              <div className="permissions-breakdown">
                <div className="breakdown-header">
                  <h4>
                    Assigned Permissions (
                    {isEditingPermissions
                      ? editPermissions.size
                      : (selectedRole.permissions?.length ?? 0)}
                    /23)
                  </h4>
                  {isEditingPermissions && (
                    <span className="text-muted text-small">
                      Check or uncheck permissions to customize this role
                    </span>
                  )}
                </div>

                <div className="category-accordion-grid">
                  {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                    const currentPermSet = isEditingPermissions
                      ? editPermissions
                      : new Set(selectedRole.permissions || []);
                    const grantedInCat = perms.filter((p) => currentPermSet.has(p)).length;

                    return (
                      <div key={category} className="category-box">
                        <div className="category-header">
                          <span className="category-title">{category}</span>
                          <span className="category-count">
                            {grantedInCat} / {perms.length}
                          </span>
                        </div>

                        <div className="category-perms-list">
                          {perms.map((permName) => {
                            const isGranted = currentPermSet.has(permName);
                            const permObj = allPermissions.find((p) => p.name === permName);

                            return (
                              <div
                                key={permName}
                                className={`perm-chip ${isGranted ? "granted" : "revoked"}`}
                                onClick={() => {
                                  if (isEditingPermissions) {
                                    handleToggleEditPerm(permName);
                                  }
                                }}
                              >
                                {isEditingPermissions ? (
                                  <input
                                    type="checkbox"
                                    checked={isGranted}
                                    onChange={() => handleToggleEditPerm(permName)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="perm-chip-icon">
                                    {isGranted ? "✓" : "✗"}
                                  </span>
                                )}
                                <span className="perm-chip-name">{permName}</span>
                                {permObj?.description && (
                                  <span className="perm-chip-desc" title={permObj.description}>
                                    {permObj.description}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="card empty-state">Select a role on the left to view details</div>
          )}
        </div>
      </div>

      {/* Create Custom Role Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Create Organization-Specific Role</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {createError && <div className="alert alert-error">{createError}</div>}

            <form onSubmit={handleCreateRole}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="custom-role-name">Role Name *</label>
                  <input
                    id="custom-role-name"
                    type="text"
                    required
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Master Wood Crafter, Lead Technician, Head Chemist"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="custom-role-desc">Description</label>
                  <input
                    id="custom-role-desc"
                    type="text"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Role responsibilities and scope"
                  />
                </div>

                <div className="perm-picker-header">
                  <div>
                    <strong>Select Permissions ({selectedPermissions.size}/23 selected):</strong>
                  </div>
                  <div className="perm-picker-shortcuts">
                    <button
                      type="button"
                      className="btn-link text-small"
                      onClick={() =>
                        setSelectedPermissions(new Set(allPermissions.map((p) => p.name)))
                      }
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="btn-link text-small"
                      onClick={() => setSelectedPermissions(new Set())}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="modal-perms-scroll">
                  {Object.entries(PERMISSION_CATEGORIES).map(([cat, perms]) => (
                    <div key={cat} className="modal-perm-cat">
                      <div className="modal-cat-row">
                        <strong className="text-small">{cat}</strong>
                        <button
                          type="button"
                          className="btn-link text-small"
                          onClick={() => handleToggleCategory(perms)}
                        >
                          Toggle Category
                        </button>
                      </div>
                      <div className="modal-perm-checkboxes">
                        {perms.map((p) => (
                          <label key={p} className="perm-checkbox-label">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(p)}
                              onChange={() => handleTogglePermCheckbox(p)}
                            />
                            <span>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !newRoleName.trim()}
                >
                  {isSubmitting ? "Creating Role..." : "Create Custom Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
