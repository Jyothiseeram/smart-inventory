import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RouterProvider, useRouter, ProtectedRoute, PermissionRoute } from "./routes/Router";
import { Header } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { RegisterView } from "./components/RegisterView";
import { LoginView } from "./components/LoginView";
import { DashboardView } from "./components/DashboardView";
import { RolesView } from "./components/RolesView";
import { PermissionsView } from "./components/PermissionsView";
import { EmployeesView } from "./components/EmployeesView";
import { ProfileView } from "./components/ProfileView";
import { ProductsView } from "./components/ProductsView";
import { InventoryView } from "./components/InventoryView";
import { SuppliersView } from "./components/SuppliersView";
import { UnauthorizedView } from "./components/UnauthorizedView";
import "./App.css";

const MainContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { currentPath, navigate } = useRouter();

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Connecting to Smart Inventory backend...</p>
      </div>
    );
  }

  const renderRoute = () => {
    switch (currentPath) {
      case "/register":
        return <RegisterView onSuccess={() => navigate("/dashboard")} onNavigateLogin={() => navigate("/login")} />;
      case "/login":
        return <LoginView onSuccess={() => navigate("/dashboard")} onNavigateRegister={() => navigate("/register")} />;
      case "/dashboard":
        return (
          <ProtectedRoute>
            <DashboardView />
          </ProtectedRoute>
        );
      case "/products":
        return (
          <ProtectedRoute>
            <PermissionRoute requiredPermission="PRODUCT_VIEW">
              <ProductsView />
            </PermissionRoute>
          </ProtectedRoute>
        );
      case "/inventory":
        return (
          <ProtectedRoute>
            <PermissionRoute requiredPermission="STOCK_VIEW">
              <InventoryView />
            </PermissionRoute>
          </ProtectedRoute>
        );
      case "/suppliers":
        return (
          <ProtectedRoute>
            <PermissionRoute requiredPermission="SUPPLIER_VIEW">
              <SuppliersView />
            </PermissionRoute>
          </ProtectedRoute>
        );
      case "/members":
        return (
          <ProtectedRoute>
            <PermissionRoute requiredPermission="EMPLOYEE_VIEW">
              <EmployeesView />
            </PermissionRoute>
          </ProtectedRoute>
        );
      case "/roles":
        return (
          <ProtectedRoute>
            <RolesView />
          </ProtectedRoute>
        );
      case "/permissions":
      case "/authorization":
        return (
          <ProtectedRoute>
            <PermissionsView />
          </ProtectedRoute>
        );
      case "/profile":
        return (
          <ProtectedRoute>
            <ProfileView />
          </ProtectedRoute>
        );
      case "/unauthorized":
        return (
          <ProtectedRoute>
            <UnauthorizedView />
          </ProtectedRoute>
        );
      case "/":
      default:
        if (user) {
          return <DashboardView />;
        }
        return <LandingView onNavigate={(path) => navigate(path.startsWith("/") ? path : `/${path}`)} />;
    }
  };

  return (
    <div className="app-layout">
      <Header />
      <main className="app-main-content">{renderRoute()}</main>
      <footer className="app-footer">
        <div className="footer-content">
          <span>Smart Inventory RBAC Foundation &bull; PostgreSQL 17 + Prisma Engine</span>
          <span className="footer-tag">Production Phase 1: Authentication, Tenants, Roles & Permissions</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <MainContent />
      </RouterProvider>
    </AuthProvider>
  );
}
