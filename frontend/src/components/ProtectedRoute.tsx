import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "citizen" | "admin";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    console.debug("ProtectedRoute: no user - redirecting to /signin", { location });
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    console.debug(`ProtectedRoute: user role ${user.role} doesn't match required ${requiredRole} - redirecting to /`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
