import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createLoan } from '../api/loans.js';
import { getClients } from '../api/clients.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { formatFCFA, formatDate } from '../utils/format.js';
import styles from './LoanFormPage.module.css';

const NIVEAUX = [
  { level: 1, capital: 25000, duree: 7,  taux: 30, interets: 7500,  total: 32500 },
  { level: 2, capital: 50000, duree: 10, taux: 25, interets: 12500, total: 62500 },
  { level: 3, capital: 75000, duree: 15, taux: 20, interets: 15000, total: 90000 },
];

function calcDateEcheance(duree) {
  const d = new Date();
  d.setDate(d.getDate() + duree);
  return d;
}

export default function LoanFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledClientId = searchParams.get('clientId');

  const [clients, setClients]     = useState([]);
  const [clientId, setClientId]   = useState(prefilledClientId || '');
  const [level, setLevel]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [error, setError]         = useState('');

  const niveauChoisi = NIVEAUX.find((n) => n.level === parseInt(level, 10));

  useEffect(() => {
    getClients({ status: 'actif' }).then((data) => {
      setClients(data);
      setLoadingClients(false);
    }).catch(() => setLoadingClients(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientId || !level) return;
    setError(''); setLoading(true);
    try {
      const loan = await createLoan(parseInt(clientId, 10), parseInt(level, 10));
      navigate(`/loans/${loan.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingClients) return <LoadingSpinner message="Chargement…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}>← Retour</button>
        <h1 className={styles.title}>Nouveau prêt</h1>
      </div>

      <div className={styles.layout}>
        {/* Formulaire */}
        <div className={styles.card}>
          {error && <ErrorMessage message={error} />}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="client" className={styles.label}>Client *</label>
              <select id="client" value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={styles.select} required disabled={loading}>
                <option value="">Sélectionner un client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} — {c.phone}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className={styles.hint}>Aucun client actif disponible.</p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Niveau de prêt *</label>
              <div className={styles.levelGrid}>
                {NIVEAUX.map((n) => (
                  <button
                    key={n.level}
                    type="button"
                    className={`${styles.levelCard} ${level === String(n.level) ? styles.levelCardActive : ''}`}
                    onClick={() => setLevel(String(n.level))}
                    disabled={loading}
                  >
                    <div className={styles.levelTitle}>Niveau {n.level}</div>
                    <div className={styles.levelCapital}>{formatFCFA(n.capital)}</div>
                    <div className={styles.levelDetails}>
                      {n.duree} jours · {n.taux}% d'intérêt
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary}
                onClick={() => navigate(-1)} disabled={loading}>Annuler</button>
              <button type="submit" className={styles.btnPrimary}
                disabled={loading || !clientId || !level}>
                {loading ? 'Création…' : 'Accorder le prêt'}
              </button>
            </div>
          </form>
        </div>

        {/* Récapitulatif */}
        {niveauChoisi && (
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}>Récapitulatif</h2>
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span>Capital</span>
                <strong>{formatFCFA(niveauChoisi.capital)}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Intérêts ({niveauChoisi.taux}%)</span>
                <strong>{formatFCFA(niveauChoisi.interets)}</strong>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total à rembourser</span>
                <strong>{formatFCFA(niveauChoisi.total)}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Durée</span>
                <strong>{niveauChoisi.duree} jours</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Date d'échéance</span>
                <strong>{formatDate(calcDateEcheance(niveauChoisi.duree))}</strong>
              </div>
            </div>
            <p className={styles.summaryNote}>
              Le montant total sera calculé définitivement à la création du prêt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
