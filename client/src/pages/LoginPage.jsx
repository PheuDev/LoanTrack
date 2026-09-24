import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { login as apiLogin } from '../api/auth.js';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiLogin(username, password);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Panneau gauche : branding ─────────────────────────────────────── */}
      <div className={styles.branding}>
        <div className={styles.brandingContent}>
          <div className={styles.brandLogo}>
            <span className={styles.brandIcon}>💰</span>
            <span className={styles.brandName}>LoanTrack</span>
          </div>
          <h1 className={styles.brandTagline}>
            Suivez chaque prêt,<br />du déblocage au solde.
          </h1>
          <p className={styles.brandDescription}>
            Une solution simple et sécurisée pour suivre les prêts,
            remboursements et transactions de vos clients.
          </p>
          <ul className={styles.brandFeatures}>
            {['Processus rapide', 'Gestion facile', 'Suivi en temps réel', 'Sécurité garantie'].map((f) => (
              <li key={f} className={styles.brandFeature}>
                <span className={styles.featureCheck}>✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Panneau droit : formulaire ────────────────────────────────────── */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Connexion</h2>
            <p className={styles.formSubtitle}>
              Accédez à votre espace de gestion sécurisé.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {error && (
              <div className={styles.errorBanner} role="alert">
                {error}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>
                Nom d'utilisateur
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                placeholder="ex: admin"
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Mot de passe
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !username || !password}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          <p className={styles.footer}>
            LoanTrack · Suivi de prêts
          </p>
        </div>
      </div>
    </div>
  );
}
