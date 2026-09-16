import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "../routes/Router";

export const UnauthorizedView: React.FC = () => {
  const { user, activeMembership, permissions } = useAuth();
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const requiredPermission = urlParams.get("required");

  return (
    <div className="view-container">
      <div className="form-card-container">
        <div className="card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
          <div className="card-header" style={{ justifyContent: "center", flexDirection: "column" }}>
            <span style={{ fontSize: "56px", marginBottom: "16px" }}>⛔</span>
            <h2 style={{ color: "#ef4444" }}>403 — Access Forbidden</h2>
            <p className="text-muted">
              You do not have permission to access this protected resource.
            </p>
          </div>

          <div className="card-body">
            {requiredPermission && (
              <div className="alert alert-error" style={{ textAlign: "left", marginBottom: "20px" }}>
                <strong>Required Permission Missing:</strong> <code>{requiredPermission}</code>
              </div>
            )}

            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", textAlign: "left", marginBottom: "24px" }}>
              <p style={{ margin: "4px 0" }}>
                <strong>Authenticated User:</strong> {user?.email}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Active Organization:</strong> {activeMembership?.organizationName}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Your Role:</strong>{" "}
                <span className="badge badge-role">{activeMembership?.roleName || "None"}</span>
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Granted Permissions ({permissions.length}/23):</strong>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", maxHeight: "140px", overflowY: "auto" }}>
                {permissions.map((p) => (
                  <span key={p} className="badge badge-active" style={{ fontSize: "11px" }}>
                    ✓ {p}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/dashboard")}
              >
                Return to Dashboard
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/permissions")}
              >
                View Permissions Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
