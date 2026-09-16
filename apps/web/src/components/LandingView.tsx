import React, { useEffect, useState } from "react";
import { authApi } from "../api/auth.api";

interface LandingViewProps {
  onNavigate: (tab: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onNavigate }) => {
  const [health, setHealth] = useState<{ status: string; service: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .checkHealth()
      .then(setHealth)
      .catch((err) => setHealthError(err.message || "Failed to reach backend"));
  }, []);

  return (
    <div className="view-container landing-container">
      <div className="hero-banner">
        <h2>Smart Inventory Multi-Tenant RBAC Testbench</h2>
        <p className="hero-description">
          A dedicated development & testing dashboard for verifying organization-scoped
          customizable roles, business type role templates, permission-based authorization,
          and PostgreSQL composite foreign key tenant isolation.
        </p>

        <div className="backend-health-card">
          <div className="health-badge">
            <span className={`status-dot ${health?.status === "ok" ? "online" : "offline"}`} />
            <span>
              Backend Status:{" "}
              {health ? (
                <strong className="text-success">Connected ({health.service})</strong>
              ) : healthError ? (
                <strong className="text-danger">Offline: {healthError}</strong>
              ) : (
                "Checking /health..."
              )}
            </span>
          </div>
        </div>

        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate("register")}>
            🚀 Register New Organization
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => onNavigate("login")}>
            🔑 Sign In
          </button>
        </div>
      </div>

      <div className="architecture-grid">
        <div className="arch-card">
          <div className="arch-icon">🏢</div>
          <h3>Multi-Tenant Isolation</h3>
          <p>
            Shared PostgreSQL database with strict logical isolation via <code>organizationId</code>.
            Memberships and Employee Invitations enforce composite foreign keys at the engine level to prevent cross-tenant role bleed.
          </p>
        </div>

        <div className="arch-card">
          <div className="arch-icon">🧩</div>
          <h3>Business Type Templates</h3>
          <p>
            Onboarding provides tailored default roles according to <code>BusinessType</code> (Medical, Furniture, Electronics, Fashion, General) without hardcoding business authorization in code.
          </p>
        </div>

        <div className="arch-card">
          <div className="arch-icon">🛠️</div>
          <h3>Customizable Roles</h3>
          <p>
            Organization owners can create custom roles (e.g. <em>Lead Crafter</em>, <em>Head Technician</em>) and assign any combination of the 23 system permissions.
          </p>
        </div>

        <div className="arch-card">
          <div className="arch-icon">🔒</div>
          <h3>Permission-Based Authz</h3>
          <p>
            Authorization evaluates granular actions (e.g. <code>hasPermission('STOCK_UPDATE')</code>), never literal role names. Allows full flexibility per tenant.
          </p>
        </div>
      </div>
    </div>
  );
};
