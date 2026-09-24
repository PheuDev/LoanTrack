import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Pages — importées ici, créées dans les phases suivantes
import LoginPage        from './pages/LoginPage.jsx';
import DashboardPage    from './pages/DashboardPage.jsx';
import ClientsPage      from './pages/ClientsPage.jsx';
import ClientFormPage   from './pages/ClientFormPage.jsx';
import ClientDetailPage from './pages/ClientDetailPage.jsx';
import LoansPage        from './pages/LoansPage.jsx';
import LoanFormPage     from './pages/LoanFormPage.jsx';
import LoanDetailPage   from './pages/LoanDetailPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';
import SettingsPage     from './pages/SettingsPage.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Route publique */}
            <Route path="/login" element={<LoginPage />} />

            {/* Routes protégées — chacune est enveloppée dans Layout via ProtectedRoute */}
            <Route path="/" element={
              <ProtectedRoute><DashboardPage /></ProtectedRoute>
            } />
            <Route path="/clients" element={
              <ProtectedRoute><ClientsPage /></ProtectedRoute>
            } />
            <Route path="/clients/new" element={
              <ProtectedRoute><ClientFormPage /></ProtectedRoute>
            } />
            <Route path="/clients/:id" element={
              <ProtectedRoute><ClientDetailPage /></ProtectedRoute>
            } />
            <Route path="/clients/:id/edit" element={
              <ProtectedRoute><ClientFormPage /></ProtectedRoute>
            } />
            <Route path="/loans" element={
              <ProtectedRoute><LoansPage /></ProtectedRoute>
            } />
            <Route path="/loans/new" element={
              <ProtectedRoute><LoanFormPage /></ProtectedRoute>
            } />
            <Route path="/loans/:id" element={
              <ProtectedRoute><LoanDetailPage /></ProtectedRoute>
            } />
            <Route path="/transactions" element={
              <ProtectedRoute><TransactionsPage /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><SettingsPage /></ProtectedRoute>
            } />

            {/* Toute URL inconnue → accueil */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
