import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "../routes/Router";

interface LoginViewProps {
  onSuccess?: () => void;
  onNavigateRegister?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onNavigateRegister }) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email, password);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToRegister = () => {
    if (onNavigateRegister) {
      onNavigateRegister();
    } else {
      navigate("/register");
    }
  };

  return (
    <div className="view-container">
      <div className="form-card-container">
        <div className="form-card">
          <div className="form-header">
            <h2>Sign In to RBAC Dashboard</h2>
            <p>Access your organization, review roles, and test permissions.</p>
          </div>

          {errorMessage && (
            <div className="alert alert-error">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@business.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your account password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={isSubmitting}>
              {isSubmitting ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="form-footer">
            <span>Don&apos;t have an organization registered?</span>
            <button type="button" className="btn-link" onClick={handleGoToRegister}>
              Register a business here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
