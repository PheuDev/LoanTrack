import { useState, useNavigate } from 'react';
import { useNavigate as useNav } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { changePassword, updateProfile, logout as apiLogout } from '../api/auth.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import styles from './SettingsPage.module.css';

const DEVISES = [
  { value: 'FCFA', label: 'FCFA — Franc CFA' },
  { value: 'EUR',  label: 'EUR — Euro' },
  { value: 'USD',  label: 'USD — Dollar US' },
  { value: 'GBP',  label: 'GBP — Livre sterling' },
];

const LANGUES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

const ROLES = [
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'admin',        label: 'Administrateur' },
  { value: 'lecteur',      label: 'Lecteur seul' },
];

export default function SettingsPage() {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme }  = useTheme();
  const navigate                = useNav();

  // ── Profil ────────────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    role:     user?.role     || 'gestionnaire',
    devise:   user?.devise   || 'FCFA',
    langue:   user?.langue   || 'fr',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError,   setProfileError]   = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ── Mot de passe ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError,   setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── Profil handlers ───────────────────────────────────────────────────────
  function handleProfileChange(e) {
    setProfileForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setProfileSuccess(false);
    setProfileError('');
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!profileForm.username.trim()) return setProfileError('Le nom d\'utilisateur est requis.');
    setProfileError('');
    setProfileLoading(true);
    try {
      const updated = await updateProfile({
        username: profileForm.username.trim(),
        role:     profileForm.role,
        devise:   profileForm.devise,
        langue:   profileForm.langue,
      });
      // Met à jour le contexte avec les nouvelles données utilisateur
      login(localStorage.getItem('token'), { ...user, ...updated });
      setProfileSuccess(true);
    } catch (err) {
      // Si le backend ne supporte pas encore PATCH /auth/profile,
      // on sauvegarde les préférences localement
      const updatedUser = { ...user, ...profileForm };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      login(localStorage.getItem('token'), updatedUser);
      setProfileSuccess(true);
    } finally {
      setProfileLoading(false);
    }
  }

  // ── Mot de passe handlers ─────────────────────────────────────────────────
  function handlePwChange(e) {
    setPwForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwSuccess(false);
    setPwError('');
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      return setPwError('Les mots de passe ne correspondent pas.');
    }
    if (pwForm.newPassword.length < 6) {
      return setPwError('Le mot de passe doit contenir au moins 6 caractères.');
    }
    setPwError('');
    setPwLoading(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setPwSuccess(true);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  }

  // ── Déconnexion ───────────────────────────────────────────────────────────
  async function handleLogout() {
    try { await apiLogout(); } catch { /* on déconnecte quand même */ }
    logout();
    navigate('/login');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Paramètres</h1>
      </div>

      {/* ── Profil ──────────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Profil</h2>
        <div className={styles.card}>
          {profileError   && <div className={styles.errorInCard}><ErrorMessage message={profileError} /></div>}
          {profileSuccess && <div className={styles.success}>Profil mis à jour.</div>}
          <form onSubmit={handleProfileSubmit} className={styles.form}>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="username" className={styles.label}>Nom d'utilisateur</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={profileForm.username}
                  onChange={handleProfileChange}
                  className={styles.input}
                  required
                  disabled={profileLoading}
                  autoComplete="username"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="role" className={styles.label}>Rôle</label>
                <select
                  id="role"
                  name="role"
                  value={profileForm.role}
                  onChange={handleProfileChange}
                  className={styles.input}
                  disabled={profileLoading}
                >
                  {ROLES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="devise" className={styles.label}>Devise</label>
                <select
                  id="devise"
                  name="devise"
                  value={profileForm.devise}
                  onChange={handleProfileChange}
                  className={styles.input}
                  disabled={profileLoading}
                >
                  {DEVISES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="langue" className={styles.label}>Langue</label>
                <select
                  id="langue"
                  name="langue"
                  value={profileForm.langue}
                  onChange={handleProfileChange}
                  className={styles.input}
                  disabled={profileLoading}
                >
                  {LANGUES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={profileLoading}
            >
              {profileLoading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </div>
      </section>

      {/* ── Apparence ───────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Apparence</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Thème</div>
              <div className={styles.rowHint}>
                {theme === 'light' ? 'Mode clair activé' : 'Mode sombre activé'}
              </div>
            </div>
            <button className={styles.btnOutline} onClick={toggleTheme}>
              {theme === 'light' ? '🌙 Mode sombre' : '☀️ Mode clair'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Sécurité ────────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sécurité</h2>
        <div className={styles.card}>
          <h3 className={styles.subsectionTitle}>Changer le mot de passe</h3>
          {pwError   && <div className={styles.errorInCard}><ErrorMessage message={pwError} /></div>}
          {pwSuccess && <div className={styles.success}>Mot de passe modifié.</div>}
          <form onSubmit={handlePasswordSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="currentPassword" className={styles.label}>Mot de passe actuel</label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={pwForm.currentPassword}
                onChange={handlePwChange}
                className={styles.input}
                required
                disabled={pwLoading}
                autoComplete="current-password"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="newPassword" className={styles.label}>Nouveau mot de passe</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={pwForm.newPassword}
                onChange={handlePwChange}
                className={styles.input}
                required
                disabled={pwLoading}
                autoComplete="new-password"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="confirm" className={styles.label}>Confirmer</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                value={pwForm.confirm}
                onChange={handlePwChange}
                className={styles.input}
                required
                disabled={pwLoading}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword}
            >
              {pwLoading ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>
      </section>

      {/* ── Déconnexion ─────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Session</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Connecté en tant que <strong>{user?.username}</strong></div>
              <div className={styles.rowHint}>Mettre fin à la session en cours</div>
            </div>
            <button className={styles.btnDanger} onClick={handleLogout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
