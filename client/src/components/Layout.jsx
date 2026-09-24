import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { logout as apiLogout } from '../api/auth.js';
import styles from './Layout.module.css';

// Éléments de navigation de la sidebar
const NAV_ITEMS = [
  { path: '/',             label: 'Tableau de bord', icon: '◉' },
  { path: '/clients',      label: 'Clients',         icon: '👥' },
  { path: '/loans',        label: 'Prêts',           icon: '💳' },
  { path: '/transactions', label: 'Transactions',    icon: '📋' },
  { path: '/settings',     label: 'Paramètres',      icon: '⚙' },
];

/**
 * Layout principal : sidebar fixe à gauche + zone de contenu à droite.
 * Sur mobile (< 768px), la sidebar devient une barre de navigation en bas.
 */
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await apiLogout();
    } catch {
      // Même si l'appel échoue, on déconnecte localement
    }
    logout();
    navigate('/login');
  }

  return (
    <div className={styles.root}>
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>💰</span>
          <span className={styles.logoText}>LoanTrack</span>
        </div>

        {/* Navigation */}
        <nav className={styles.nav} aria-label="Navigation principale">
          {NAV_ITEMS.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bas de sidebar : profil + thème */}
        <div className={styles.sidebarFooter}>
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
            title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
            <span>{theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>
          </button>

          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.username || 'Admin'}</span>
              <span className={styles.userRole}>Gestionnaire</span>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenu principal ───────────────────────────────────────────── */}
      <main className={styles.main}>
        {children}
      </main>

      {/* ── Navigation mobile (bottom nav) ──────────────────────────────── */}
      <nav className={styles.bottomNav} aria-label="Navigation mobile">
        {NAV_ITEMS.slice(0, 5).map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`
            }
          >
            <span className={styles.bottomNavIcon}>{icon}</span>
            <span className={styles.bottomNavLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
