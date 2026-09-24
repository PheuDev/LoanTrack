import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { changePassword } from '../api/auth.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [pwForm, setPwForm]   = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  // Préférences de notifications (UI uniquement — pas de backend en v1)
  const [notifEmail, setNotifEmail] = useState(() =>
    localStorage.getItem('notif_email') === 'true'
  );
  const [notifSystem, setNotifSystem] = useState(() =>
    localStorage.getItem('notif_system') !== 'false' // true par défaut
  );

  function handlePwChange(e) {
    setPwForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError(''); setPwSuccess(false);
    if (pwForm.newPassword !== pwForm.confirm) {
      return setPwError('Les mots de passe ne correspondent pas.');
    }
    if (pwForm.newPassword.length < 6) {
      return setPwError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
    }
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

  function toggleNotifEmail(val) {
    setNotifEmail(val);
    localStorage.setItem('notif_email', val);
  }

  function toggleNotifSystem(val) {
    setNotifSystem(val);
    localStorage.setItem('notif_system', val);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Paramètres</h1>
      </div>

      {/* Informations générales */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Informations générales</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Nom d'utilisateur</span>
            <span className={styles.rowValue}>{user?.username}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Rôle</span>
            <span className={styles.rowValue}>Gestionnaire</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Devise</span>
            <span className={styles.rowValue}>FCFA (Franc CFA)</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Langue</span>
            <span className={styles.rowValue}>Français</span>
          </div>
        </div>
      </div>

      {/* Apparence */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Apparence</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Thème</div>
              <div className={styles.rowHint}>
                {theme === 'light' ? 'Mode clair activé' : 'Mode sombre activé'}
              </div>
            </div>
            <button className={styles.toggle} onClick={toggleTheme}>
              {theme === 'light' ? '🌙 Passer en sombre' : '☀️ Passer en clair'}
            </button>
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Sécurité</h2>
        <div className={styles.card}>
          <h3 className={styles.subsectionTitle}>Changer le mot de passe</h3>
          {pwError   && <ErrorMessage message={pwError} />}
          {pwSuccess && <div className={styles.success}>Mot de passe modifié avec succès.</div>}
          <form onSubmit={handlePasswordSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Mot de passe actuel</label>
              <input type="password" name="currentPassword" value={pwForm.currentPassword}
                onChange={handlePwChange} className={styles.input}
                required disabled={pwLoading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Nouveau mot de passe</label>
              <input type="password" name="newPassword" value={pwForm.newPassword}
                onChange={handlePwChange} className={styles.input}
                required disabled={pwLoading} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Confirmer le nouveau mot de passe</label>
              <input type="password" name="confirm" value={pwForm.confirm}
                onChange={handlePwChange} className={styles.input}
                required disabled={pwLoading} />
            </div>
            <button type="submit" className={styles.btnPrimary}
              disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword}>
              {pwLoading ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>
      </div>

      {/* Notifications */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Notifications</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Alertes par email</div>
              <div className={styles.rowHint}>Recevoir les notifications par email</div>
            </div>
            <label className={styles.toggleSwitch}>
              <input type="checkbox" checked={notifEmail}
                onChange={(e) => toggleNotifEmail(e.target.checked)} />
              <span className={styles.slider} />
            </label>
          </div>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>Notifications système</div>
              <div className={styles.rowHint}>Afficher les alertes dans l'interface</div>
            </div>
            <label className={styles.toggleSwitch}>
              <input type="checkbox" checked={notifSystem}
                onChange={(e) => toggleNotifSystem(e.target.checked)} />
              <span className={styles.slider} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
