import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "../routes/Router";
import type { BusinessType } from "../types";
import { BUSINESS_TYPE_PREVIEWS } from "../utils/roleTemplatesPreview";

interface RegisterViewProps {
  onSuccess?: () => void;
  onNavigateLogin?: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onSuccess, onNavigateLogin }) => {
  const { registerOrg } = useAuth();
  const navigate = useNavigate();

  const [userName, setUserName] = useState("Dr. Sarah Adams");
  const [email, setEmail] = useState(() => `sarah.${Math.floor(Math.random() * 9000 + 1000)}@pharmacy.test`);
  const [password, setPassword] = useState("Password123!");
  const [organizationName, setOrganizationName] = useState("St. Jude Pharmacy");
  const [businessType, setBusinessType] = useState<BusinessType>("MEDICAL");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTemplates = BUSINESS_TYPE_PREVIEWS[businessType] || BUSINESS_TYPE_PREVIEWS.GENERAL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await registerOrg({
        userName,
        email,
        password,
        organizationName,
        businessType,
      });
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    if (onNavigateLogin) {
      onNavigateLogin();
    } else {
      navigate("/login");
    }
  };

  const setDemoPreset = (type: BusinessType, org: string, user: string, mailPrefix: string) => {
    setBusinessType(type);
    setOrganizationName(org);
    setUserName(user);
    setEmail(`${mailPrefix}.${Date.now().toString().slice(-4)}@example.com`);
  };

  return (
    <div className="view-container">
      <div className="form-card-container">
        <div className="form-card">
          <div className="form-header">
            <h2>Register Organization & Admin</h2>
            <p>Provisions organization, business type default roles, and assigns Owner membership.</p>
          </div>

          {/* Quick Presets */}
          <div className="preset-bar">
            <span className="preset-label">Quick Presets:</span>
            <button
              type="button"
              className="preset-chip"
              onClick={() => setDemoPreset("MEDICAL", "St. Jude Pharmacy", "Dr. Sarah Adams", "sarah")}
            >
              💊 Medical
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => setDemoPreset("ELECTRONICS", "Nova Tech Lab", "Marcus Vance", "marcus")}
            >
              ⚡ Electronics
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => setDemoPreset("FURNITURE", "Heritage Wood Co", "Henry Ford", "henry")}
            >
              🪑 Furniture
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => setDemoPreset("FASHION", "Vogue Boutique", "Elena Rostova", "elena")}
            >
              👗 Fashion
            </button>
          </div>

          {errorMessage && (
            <div className="alert alert-error">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="reg-name">Admin User Full Name</label>
              <input
                id="reg-name"
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Dr. Sarah Adams"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@business.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Secret password"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-org">Organization Name</label>
                <input
                  id="reg-org"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Apex Health Ltd."
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-type">Business Type</label>
                <select
                  id="reg-type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                >
                  <option value="MEDICAL">Medical Store (Pharmacy)</option>
                  <option value="FURNITURE">Furniture & Showroom</option>
                  <option value="ELECTRONICS">Electronics & Repair</option>
                  <option value="FASHION">Fashion & Apparel</option>
                  <option value="GENERAL">General Retail Goods</option>
                  <option value="OTHER">Other Business</option>
                </select>
              </div>
            </div>

            {/* Live Role Templates Preview */}
            <div className="role-preview-box">
              <div className="role-preview-header">
                <strong>Auto-Provisioned Roles for {businessType}:</strong>
                <span className="text-muted text-small">
                  {selectedTemplates.length} default roles will be created in your tenant
                </span>
              </div>
              <div className="role-preview-grid">
                {selectedTemplates.map((tpl) => (
                  <div key={tpl.name} className="role-preview-item">
                    <div className="role-preview-name">
                      <strong>{tpl.name}</strong>
                      {tpl.isSystem && <span className="badge badge-system">System Owner</span>}
                    </div>
                    <p className="role-preview-desc">{tpl.description}</p>
                    <div className="role-preview-perms">
                      <span className="perm-count-badge">
                        {tpl.permissions.length} permissions assigned
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={isSubmitting}>
              {isSubmitting ? "Provisioning Organization & Roles..." : "Register Organization & Launch Dashboard"}
            </button>
          </form>

          <div className="form-footer">
            <span>Already have an account?</span>
            <button type="button" className="btn-link" onClick={handleGoToLogin}>
              Sign in here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
