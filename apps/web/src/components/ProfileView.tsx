import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "../routes/Router";

export const ProfileView: React.FC = () => {
  const { user, activeMembership, memberships, switchOrganization, logout, permissions } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="view-container">
      <div className="view-header-bar">
        <div>
          <h2>User Profile & Session Details</h2>
          <p className="text-muted">
            Inspect your authenticated credentials, multi-tenant organizations, and active role.
          </p>
        </div>
        <button type="button" className="btn btn-danger" onClick={handleLogout}>
          Sign Out
        </button>
      </div>

      <div className="profile-layout">
        {/* User Information Card */}
        <div className="card">
          <div className="card-header">
            <h3>👤 Personal Account</h3>
          </div>
          <div className="card-body">
            <div className="profile-info-grid">
              <div className="profile-field">
                <span className="field-label">Full Name:</span>
                <span className="field-value"><strong>{user.name}</strong></span>
              </div>
              <div className="profile-field">
                <span className="field-label">Email Address:</span>
                <span className="field-value"><code>{user.email}</code></span>
              </div>
              <div className="profile-field">
                <span className="field-label">User ID:</span>
                <span className="field-value"><code>{user.id}</code></span>
              </div>
              <div className="profile-field">
                <span className="field-label">Account Status:</span>
                <span className="badge badge-active">{user.status || "ACTIVE"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Active Tenant Card */}
        <div className="card">
          <div className="card-header">
            <h3>🏢 Active Organization Context</h3>
          </div>
          <div className="card-body">
            {activeMembership ? (
              <div className="profile-info-grid">
                <div className="profile-field">
                  <span className="field-label">Organization Name:</span>
                  <span className="field-value"><strong>{activeMembership.organizationName}</strong></span>
                </div>
                <div className="profile-field">
                  <span className="field-label">Business Type:</span>
                  <span className="badge badge-business">{activeMembership.businessType}</span>
                </div>
                <div className="profile-field">
                  <span className="field-label">Tenant ID:</span>
                  <span className="field-value"><code>{activeMembership.organizationId}</code></span>
                </div>
                <div className="profile-field">
                  <span className="field-label">Your Active Role:</span>
                  <span className="field-value">
                    <span className="badge badge-role">{activeMembership.roleName}</span>
                    {activeMembership.isSystemRole && (
                      <span className="badge badge-system" style={{ marginLeft: "8px" }}>
                        System Owner
                      </span>
                    )}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="field-label">Permissions Granted:</span>
                  <span className="field-value">
                    <strong>{permissions.length}</strong> of 23 system permissions
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted">No active organization selected.</p>
            )}
          </div>
        </div>

        {/* Multi-Tenant Organization Memberships */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>🌐 Your Organizations ({memberships.length})</h3>
              <p className="text-muted">
                Each organization has completely isolated data and distinct roles.
              </p>
            </div>
          </div>
          <div className="card-body table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization Name</th>
                  <th>Business Type</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => {
                  const isCurrent = m.organizationId === activeMembership?.organizationId;
                  return (
                    <tr key={m.organizationId}>
                      <td>
                        <strong>{m.organizationName}</strong>
                        {isCurrent && (
                          <span className="badge badge-active" style={{ marginLeft: "8px" }}>
                            Current
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-business">{m.businessType}</span>
                      </td>
                      <td>
                        <span className="badge badge-role">{m.roleName}</span>
                      </td>
                      <td>
                        <span className="badge badge-active">ACTIVE</span>
                      </td>
                      <td>
                        {isCurrent ? (
                          <span className="text-muted text-small">Active</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => switchOrganization(m.organizationId)}
                          >
                            Switch Organization
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
