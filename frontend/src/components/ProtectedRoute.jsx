import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null; // swap for a spinner later
  return isAuthenticated ? <Outlet /> : <Navigate to="/signin" replace />;
}
