import React from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "../routes/Router";

export const Header: React.FC = () => {
  const { user, activeMembership, memberships, switchOrganization, logout, hasPermission } = useAuth();
  const { currentPath, navigate } = useRouter();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="app-header">
      {/* Dev Banner */}
      <div className="dev-banner">
        <span className="dev-tag">PRODUCTION READY</span>
        <strong>RBAC & MULTI-TENANT AUTHENTICATION FOUNDATION</strong>
        <span className="dev-note">PostgreSQL 17 + Prisma Engine &bull; Zero Mock Data</span>
      </div>

      <div className="header-main">
        <div className="header-brand" onClick={() => navigate(user ? "/dashboard" : "/login")}>
          <span className="brand-icon">🛡️</span>
          <div>
            <h1 className="brand-title">Smart Inventory</h1>
            <p className="brand-sub">Multi-Tenant RBAC & Auth Engine</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && activeMembership ? (
          <nav className="header-nav">
            <button
              className={`nav-btn ${currentPath === "/dashboard" ? "active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              📊 Dashboard
            </button>
            {hasPermission("PRODUCT_VIEW") && (
              <button
                className={`nav-btn ${currentPath === "/products" ? "active" : ""}`}
                onClick={() => navigate("/products")}
              >
                📦 Products
              </button>
            )}
            {hasPermission("STOCK_VIEW") && (
              <button
                className={`nav-btn ${currentPath === "/inventory" ? "active" : ""}`}
                onClick={() => navigate("/inventory")}
              >
                📊 Inventory
              </button>
            )}
            {hasPermission("SUPPLIER_VIEW") && (
              <button
                className={`nav-btn ${currentPath === "/suppliers" ? "active" : ""}`}
                onClick={() => navigate("/suppliers")}
              >
                🚚 Suppliers
              </button>
            )}
            {hasPermission("EMPLOYEE_VIEW") && (
              <button
                className={`nav-btn ${currentPath === "/members" ? "active" : ""}`}
                onClick={() => navigate("/members")}
              >
                👥 Members
              </button>
            )}
            <button
              className={`nav-btn ${currentPath === "/roles" ? "active" : ""}`}
              onClick={() => navigate("/roles")}
            >
              🛡️ Roles
            </button>
            <button
              className={`nav-btn ${currentPath === "/permissions" ? "active" : ""}`}
              onClick={() => navigate("/permissions")}
            >
              ⚡ Permissions
            </button>
            <button
              className={`nav-btn ${currentPath === "/profile" ? "active" : ""}`}
              onClick={() => navigate("/profile")}
            >
              👤 Profile
            </button>
          </nav>
        ) : null}

        {/* User Context & Actions */}
        <div className="header-actions">
          {user && activeMembership ? (
            <div className="tenant-selector-box">
              <div className="tenant-info">
                <span className="tenant-label">Tenant:</span>
                <select
                  className="org-select"
                  value={activeMembership.organizationId}
                  onChange={(e) => switchOrganization(e.target.value)}
                >
                  {memberships.map((m) => (
                    <option key={m.organizationId} value={m.organizationId}>
                      {m.organizationName} ({m.businessType})
                    </option>
                  ))}
                </select>
                <span className="badge badge-business">{activeMembership.businessType}</span>
                <span className="badge badge-role">{activeMembership.roleName}</span>
              </div>

              <div className="user-profile">
                <span
                  className="user-avatar"
                  onClick={() => navigate("/profile")}
                  style={{ cursor: "pointer" }}
                  title="View Profile"
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <div
                  className="user-meta"
                  onClick={() => navigate("/profile")}
                  style={{ cursor: "pointer" }}
                  title="View Profile"
                >
                  <span className="user-name">{user.name}</span>
                  <span className="user-email">{user.email}</span>
                </div>
                <button className="btn-logout" onClick={handleLogout} title="Sign Out">
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                className={`btn btn-secondary ${currentPath === "/login" ? "active" : ""}`}
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
              <button
                className={`btn btn-primary ${currentPath === "/register" ? "active" : ""}`}
                onClick={() => navigate("/register")}
              >
                Register Business
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
