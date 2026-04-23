// WHY THIS FILE EXISTS
// --------------------
// Wraps routes that should only be accessible when logged in, and optionally
// only for a specific role. Redirects to /login (or home, on role mismatch).

import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth, Role } from './AuthContext';

interface Props {
  children: ReactNode;
  requiredRole?: Role;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Send them to /login; remember where they were going so we can return after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
