import { createContext, useContext, useState } from 'react';

// Contexte d'authentification — partagé entre toutes les pages.
// Expose : user, token, login(token, user), logout(), isAuthenticated

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Relit le token et l'utilisateur depuis localStorage au démarrage
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  function login(newToken, newUser) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personnalisé — évite d'importer useContext + AuthContext dans chaque composant
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
