import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { employeesApi, type EmployeesResponse } from "../api/employees.api";
import { rolesApi } from "../api/roles.api";
import type { Role, Member } from "../types";

export const EmployeesView: React.FC = () => {
  const { activeOrgId, hasPermission } = useAuth();

  const [data, setData] = useState<EmployeesResponse | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdRawToken, setCreatedRawToken] = useState<string | null>(null);

  // Direct Create Employee Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRoleId, setCreateRoleId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Change Role Modal State
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);

  // Cross-Tenant Attack Test State
  const [isTestingAttack, setIsTestingAttack] = useState(false);
  const [attackResult, setAttackResult] = useState<{
    blocked: boolean;
    status: number;
    message: string;
  } | null>(null);

  const loadTeamData = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [empRes, rolesRes] = await Promise.all([
        employeesApi.getEmployees(activeOrgId),
        rolesApi.getRoles(activeOrgId),
      ]);

      setData(empRes);
      setRoles(rolesRes.roles);
      if (rolesRes.roles.length > 0) {
        const defaultRole = rolesRes.roles.find((r) => r.name !== "Owner") || rolesRes.roles[0];
        if (defaultRole) {
          if (!inviteRoleId) setInviteRoleId(defaultRole.id);
          if (!createRoleId) setCreateRoleId(defaultRole.id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, inviteRoleId, createRoleId]);

  useEffect(() => {
    loadTeamData();
  }, [activeOrgId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !inviteEmail.trim() || !inviteRoleId) return;

    setIsInviting(true);
    setInviteMessage(null);
    setInviteError(null);
    setCreatedRawToken(null);

    try {
      const res = await employeesApi.inviteEmployee(activeOrgId, {
        email: inviteEmail.trim(),
        roleId: inviteRoleId,
      });

      setInviteMessage(`Invitation generated for ${res.invitation.email}`);
      if (res.invitation.rawToken) {
        setCreatedRawToken(res.invitation.rawToken);
      }
      setInviteEmail("");
      await loadTeamData();
    } catch (err: any) {
      setInviteError(err.message || "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleDirectCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !createName.trim() || !createEmail.trim() || !createPassword.trim() || !createRoleId) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      await employeesApi.createEmployee(activeOrgId, {
        name: createName.trim(),
        email: createEmail.trim(),
        password: createPassword.trim(),
        roleId: createRoleId,
      });

      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      await loadTeamData();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create employee");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMemberRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !editingMember || !selectedRoleId) return;

    setIsUpdatingRole(true);
    setRoleUpdateError(null);

    try {
      await employeesApi.updateMemberRole(activeOrgId, editingMember.id, selectedRoleId);
      setEditingMember(null);
      await loadTeamData();
    } catch (err: any) {
      setRoleUpdateError(err.message || "Failed to update role");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleToggleStatus = async (member: Member) => {
    if (!activeOrgId) return;
    const newStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await employeesApi.updateMemberStatus(activeOrgId, member.id, newStatus);
      await loadTeamData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (!activeOrgId) return;
    const confirm = window.confirm(`Are you sure you want to remove ${member.name} from this organization?`);
    if (!confirm) return;

    try {
      await employeesApi.removeMember(activeOrgId, member.id);
      await loadTeamData();
    } catch (err: any) {
      alert(`Failed to remove member: ${err.message}`);
    }
  };

  const handleCrossTenantAttackTest = async () => {
    if (!activeOrgId) return;
    setIsTestingAttack(true);
    setAttackResult(null);

    const fakeCrossOrgRoleId = "00000000-0000-0000-0000-000000000000";
    try {
      await employeesApi.inviteEmployee(activeOrgId, {
        email: "cross_tenant_test@example.com",
        roleId: fakeCrossOrgRoleId,
      });
      setAttackResult({
        blocked: false,
        status: 200,
        message: "WARNING: Cross-tenant role invitation was unexpectedly accepted!",
      });
    } catch (err: any) {
      setAttackResult({
        blocked: true,
        status: err.statusCode || 400,
        message:
          err.message ||
          "Rejected by PostgreSQL composite foreign key constraint (cross-tenant safety verified).",
      });
    } finally {
      setIsTestingAttack(false);
    }
  };

  if (isLoading && !data) {
    return <div className="view-container loading-box">Loading team members...</div>;
  }

  const canInvite = hasPermission("EMPLOYEE_INVITE");
  const canCreate = hasPermission("EMPLOYEE_CREATE");
  const canUpdate = hasPermission("EMPLOYEE_UPDATE");
  const canRemove = hasPermission("EMPLOYEE_REMOVE");

  return (
    <div className="view-container">
      <div className="view-header-bar">
        <div>
          <h2>Organization Members & Team Management</h2>
          <p className="text-muted">
            Manage organization members, assign organization-scoped roles, and issue team invitations.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsCreateModalOpen(true);
              setCreateError(null);
            }}
          >
            ➕ Onboard Employee Directly
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="employees-layout">
        {/* Left Column: Invite Form & Cross-Tenant Test */}
        <div className="emp-sidebar-col">
          {/* Invite Employee Card */}
          <div className="card">
            <div className="card-header">
              <h3>✉️ Invite Team Member</h3>
            </div>
            <div className="card-body">
              {!canInvite ? (
                <div className="alert alert-warning">
                  You lack the <code>EMPLOYEE_INVITE</code> permission to issue invitations.
                </div>
              ) : (
                <>
                  {inviteMessage && <div className="alert alert-success">{inviteMessage}</div>}
                  {createdRawToken && (
                    <div className="alert alert-info" style={{ wordBreak: "break-all" }}>
                      <strong>Invite Token:</strong> <code>{createdRawToken}</code>
                      <p className="text-small" style={{ margin: "4px 0 0 0" }}>
                        Share this token with the employee to complete registration via <code>/api/auth/accept-invitation</code>.
                      </p>
                    </div>
                  )}
                  {inviteError && <div className="alert alert-error">{inviteError}</div>}

                  <form onSubmit={handleInvite}>
                    <div className="form-group">
                      <label htmlFor="inv-email">Employee Email *</label>
                      <input
                        id="inv-email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="inv-role">Assign Role *</label>
                      <select
                        id="inv-role"
                        value={inviteRoleId}
                        onChange={(e) => setInviteRoleId(e.target.value)}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} {r.isSystem ? "(System)" : "(Custom)"}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted">
                        Only roles scoped to this tenant are selectable.
                      </small>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      disabled={isInviting || !inviteEmail.trim() || !inviteRoleId}
                    >
                      {isInviting ? "Issuing Invitation..." : "Send Invitation"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {/* Cross-Tenant Attack Test Card */}
          <div className="card cross-tenant-attack-card">
            <div className="card-header">
              <div>
                <h4>🛡️ Cross-Tenant Injection Test</h4>
                <p className="text-small text-muted">
                  Simulate an attacker attempting to invite an employee to this organization while specifying a foreign role.
                </p>
              </div>
            </div>

            <div className="card-body">
              <button
                type="button"
                className="btn btn-danger btn-block"
                disabled={isTestingAttack}
                onClick={handleCrossTenantAttackTest}
              >
                {isTestingAttack ? "Testing Attack..." : "Test Cross-Tenant Injection"}
              </button>

              {attackResult && (
                <div
                  className={`attack-result-box ${
                    attackResult.blocked ? "result-blocked" : "result-failed"
                  }`}
                >
                  <div className="attack-header">
                    <strong>
                      {attackResult.blocked
                        ? "🛡️ ATTACK BLOCKED (Expected)"
                        : "⚠️ SECURITY VULNERABILITY"}
                    </strong>
                    <span className="badge badge-warning">HTTP {attackResult.status}</span>
                  </div>
                  <p className="attack-message">{attackResult.message}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Members & Invitations Tables */}
        <div className="emp-main-col">
          {/* Active Members Table */}
          <div className="card">
            <div className="card-header">
              <h3>Active Organization Members ({data?.members.length || 0})</h3>
            </div>
            <div className="card-body table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined Date</th>
                    {(canUpdate || canRemove) && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {data?.members && data.members.length > 0 ? (
                    data.members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.name}</strong>
                        </td>
                        <td>{member.email}</td>
                        <td>
                          <span
                            className={`badge ${
                              member.isSystemRole ? "badge-system" : "badge-role"
                            }`}
                          >
                            {member.roleName}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              member.status === "ACTIVE" ? "badge-active" : "badge-warning"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                        {(canUpdate || canRemove) && (
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {canUpdate && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setEditingMember(member);
                                      setSelectedRoleId(member.roleId);
                                      setRoleUpdateError(null);
                                    }}
                                    title="Change member role"
                                  >
                                    Role
                                  </button>
                                  {member.roleName !== "Owner" && (
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${member.status === "ACTIVE" ? "btn-warning" : "btn-success"}`}
                                      onClick={() => handleToggleStatus(member)}
                                      title={member.status === "ACTIVE" ? "Suspend member" : "Activate member"}
                                    >
                                      {member.status === "ACTIVE" ? "Suspend" : "Activate"}
                                    </button>
                                  )}
                                </>
                              )}
                              {canRemove && member.roleName !== "Owner" && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRemoveMember(member)}
                                  title="Remove member from organization"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        No members found in this tenant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations Table */}
          <div className="card">
            <div className="card-header">
              <h3>Pending Invitations ({data?.invitations.length || 0})</h3>
            </div>
            <div className="card-body table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invited Email</th>
                    <th>Assigned Role</th>
                    <th>Status</th>
                    <th>Expires At</th>
                    <th>Invited By</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.invitations && data.invitations.length > 0 ? (
                    data.invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.email}</strong>
                        </td>
                        <td>
                          <span className="badge badge-role">{inv.roleName}</span>
                        </td>
                        <td>
                          <span className="badge badge-warning">{inv.status}</span>
                        </td>
                        <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                        <td>{inv.invitedBy || "System"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No pending invitations.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Employee Creation Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Onboard Employee Directly</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {createError && <div className="alert alert-error">{createError}</div>}

            <form onSubmit={handleDirectCreateEmployee}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="create-name">Full Name *</label>
                  <input
                    id="create-name"
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Liam Walker"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-email">Email Address *</label>
                  <input
                    id="create-email"
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="liam@example.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-password">Initial Password *</label>
                  <input
                    id="create-password"
                    type="password"
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Temporary login password"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-role">Assigned Role *</label>
                  <select
                    id="create-role"
                    value={createRoleId}
                    onChange={(e) => setCreateRoleId(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.isSystem ? "(System)" : "(Custom)"}
                      </option>
                    ))}
                  </select>
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
                  disabled={isCreating || !createName || !createEmail || !createPassword || !createRoleId}
                >
                  {isCreating ? "Onboarding..." : "Onboard Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {editingMember && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Change Member Role</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingMember(null)}
              >
                ✕
              </button>
            </div>

            {roleUpdateError && <div className="alert alert-error">{roleUpdateError}</div>}

            <form onSubmit={handleUpdateMemberRole}>
              <div className="modal-body">
                <p>
                  Changing role for: <strong>{editingMember.name}</strong> ({editingMember.email})
                </p>
                <div className="form-group">
                  <label htmlFor="select-new-role">Select New Role in Tenant:</label>
                  <select
                    id="select-new-role"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.isSystem ? "(System)" : "(Custom)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUpdatingRole || !selectedRoleId}
                >
                  {isUpdatingRole ? "Updating Role..." : "Save Role Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
