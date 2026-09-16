import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

interface RouterContextType {
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialPath = () => {
    const path = window.location.pathname;
    return path || "/";
  };

  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || "/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((path: string, replace: boolean = false) => {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}

export function useNavigate() {
  const { navigate } = useRouter();
  return navigate;
}

export const Link: React.FC<{
  to: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ to, className, children, onClick }) => {
  const { navigate, currentPath } = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) onClick();
    navigate(to);
  };

  const isActive = currentPath === to;
  const combinedClass = `${className || ""} ${isActive ? "active" : ""}`.trim();

  return (
    <a href={to} className={combinedClass} onClick={handleClick}>
      {children}
    </a>
  );
};

/**
 * Route guard requiring authenticated session
 */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", true);
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

/**
 * Route guard requiring specific permission
 */
export const PermissionRoute: React.FC<{
  requiredPermission: string;
  children: React.ReactNode;
}> = ({ requiredPermission, children }) => {
  const { user, isLoading, hasPermission } = useAuth();
  const { navigate } = useRouter();

  const permitted = hasPermission(requiredPermission);

  useEffect(() => {
    if (!isLoading && user && !permitted) {
      navigate(`/unauthorized?required=${encodeURIComponent(requiredPermission)}`, true);
    }
  }, [user, isLoading, permitted, requiredPermission, navigate]);

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="spinner" />
        <p>Checking permissions...</p>
      </div>
    );
  }

  if (!permitted) {
    return null;
  }

  return <>{children}</>;
};
