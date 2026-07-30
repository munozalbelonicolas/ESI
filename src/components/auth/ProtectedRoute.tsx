import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireVerified?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireVerified = false }: Props) {
  const { firebaseUser, isAdmin, isEmailVerified, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireVerified && !isEmailVerified) {
    return <Navigate to="/verificar-email" replace />;
  }

  return <>{children}</>;
}
