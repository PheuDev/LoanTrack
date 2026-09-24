import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from './Layout.jsx';

/**
 * Enveloppe les routes protégées.
 * - Si non authentifié : redirige vers /login
 * - Si authentifié : affiche la page dans le Layout
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}
