import { createContext, useContext, useState, useEffect } from 'react';

// Contexte de thème — gère le basculement clair/sombre.
// Le thème est persisté dans localStorage et respecte prefers-color-scheme au premier chargement.

const ThemeContext = createContext(null);

function getThemeInitial() {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // Respecte la préférence système si aucune préférence enregistrée
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getThemeInitial);

  // Applique data-theme sur <html> à chaque changement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  return ctx;
}
