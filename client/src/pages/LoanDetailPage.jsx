import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getLoan, cancelLoan } from '../api/loans.js';
import { addRepayment } from '../api/repayments.js';
import { applyPenalty } from '../api/penalties.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate, formatDateTime, formatJours, pourcentageRembourse } from '../utils/format.js';
import styles from './LoanDetailPage.module.css';

export default function LoanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('historique');

  // Formulaire remboursement
  const [repAmount, setRepAmount] = useState('');
  const [repDate, setRepDate]     = useState(new Date().toISOString().slice(0, 10));
  const [repLoading, setRepLoading] = useState(false);
  const [repError, setRepError]   = useState('');

  // Formulaire pénalité
  const [penLoading, setPenLoading] = useState(false);
  const [penError, setPenError]   = useState('');

  useEffect(() => { loadLoan(); }, [id]);

  async function loadLoan() {
    setLoading(true); setError('');
    try { setLoan(await getLoan(id)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleRepayment(e) {
    e.preventDefault();
    setRepError(''); setRepLoading(true);
    try {
      await addRepayment(id, parseInt(repAmount, 10), repDate);
      setRepAmount('');
      await loadLoan(); // Recharge pour voir le nouveau solde
    } catch (err) {
      setRepError(err.message);
    } finally {
      setRepLoading(false);
    }
  }

  async function handlePenalty() {
    if (!confirm(`Appliquer une pénalité de ${formatFCFA(loan.principal * 0.05 * loan.joursRetard)} pour ${loan.joursRetard} jours de retard ?`)) return;
    setPenError(''); setPenLoading(true);
    try {
      await applyPenalty(id);
      await loadLoan();
    } catch (err) {
      setPenError(err.message);
    } finally {
      setPenLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Annuler ce prêt ? Cette action est irréversible.')) return;
    try {
      await cancelLoan(id);
      await loadLoan();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <LoadingSpinner message="Chargement du prêt…" />;
  if (error)   return <ErrorMessage message={error} onRetry={loadLoan} />;
  if (!loan)   return null;

  const pourcent = pourcentageRembourse(loan.totalDue, loan.penalties, loan.totalRembourse);
  const peutRembourser = loan.status === 'actif' || loan.status === 'en_retard';
  const peutPenaliser  = loan.status === 'en_retard';
  const peutAnnuler    = loan.status === 'actif' && !loan.repayments?.length;

  // Solde restant après chaque remboursement (cumul progressif, ordre croissant).
  // NB : si des pénalités ont été appliquées après coup, le solde historique
  // affiché ici est indicatif — le solde courant est affiché en en-tête.
  const totalDuFinal = loan.totalDue + (loan.penalties || 0);
  let cumulRembourse = 0;
  const remboursementsAvecSolde = [...(loan.repayments || [])]
    .sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : a.paymentDate > b.paymentDate ? 1 : a.id - b.id))
    .map((r) => {
      cumulRembourse += r.amount;
      return { ...r, soldeRestantApres: Math.max(0, totalDuFinal - cumulRembourse) };
    });

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Retour</button>

      {/* En-tête */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.loanId}>Prêt #{loan.id}</div>
          <Link to={`/clients/${loan.client?.id}`} className={styles.clientLink}>
            {loan.client?.firstName} {loan.client?.lastName}
          </Link>
          <div className={styles.badges}>
            <span className={styles.levelBadge}>Niveau {loan.level}</span>
            <StatusBadge status={loan.status} />
          </div>
        </div>
        <div className={styles.headerActions}>
          {peutAnnuler && (
            <button onClick={handleCancel} className={styles.btnDanger}>Annuler le prêt</button>
          )}
        </div>
      </div>

      {/* Montants */}
      <div className={styles.amountsGrid}>
        <div className={styles.amountCard}>
          <div className={styles.amountLabel}>Capital</div>
          <div className={styles.amountValue}>{formatFCFA(loan.principal)}</div>
        </div>
        <div className={styles.amountCard}>
          <div className={styles.amountLabel}>Intérêts</div>
          <div className={styles.amountValue}>{formatFCFA(loan.interestAmount)}</div>
        </div>
        <div className={styles.amountCard}>
          <div className={styles.amountLabel}>Pénalités</div>
          <div className={`${styles.amountValue} ${loan.penalties > 0 ? styles.danger : ''}`}>
            {formatFCFA(loan.penalties)}
          </div>
        </div>
        <div className={`${styles.amountCard} ${styles.amountCardHighlight}`}>
          <div className={styles.amountLabel}>Montant restant dû</div>
          <div className={styles.amountValue}>{formatFCFA(loan.soldeRestant)}</div>
        </div>
      </div>

      {/* Barre de progression */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>
            Remboursé : {formatFCFA(loan.totalRembourse)} sur {formatFCFA(loan.totalDue + loan.penalties)}
          </span>
          <span className={styles.progressPercent}>{pourcent}%</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pourcent}%` }} />
        </div>
      </div>

      {/* Dates */}
      <div className={styles.datesRow}>
        <div className={styles.dateItem}>
          <span className={styles.dateLabel}>Date de début</span>
          <span className={styles.dateValue}>{formatDate(loan.startDate)}</span>
        </div>
        <div className={styles.dateItem}>
          <span className={styles.dateLabel}>Date d'échéance</span>
          <span className={`${styles.dateValue} ${loan.joursRetard > 0 ? styles.danger : ''}`}>
            {formatDate(loan.dueDate)}
          </span>
        </div>
        {loan.joursRetard > 0 && (
          <div className={styles.dateItem}>
            <span className={styles.dateLabel}>Retard</span>
            <span className={`${styles.dateValue} ${styles.danger}`}>
              {formatJours(loan.joursRetard)}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {peutRembourser && (
        <div className={styles.actionsCard}>
          <h2 className={styles.sectionTitle}>Effectuer un remboursement</h2>
          {repError && <ErrorMessage message={repError} />}
          <form onSubmit={handleRepayment} className={styles.repForm}>
            <div className={styles.repFields}>
              <div className={styles.field}>
                <label className={styles.label}>Montant (FCFA)</label>
                <input
                  type="number" min="1" max={loan.soldeRestant}
                  value={repAmount}
                  onChange={(e) => setRepAmount(e.target.value)}
                  className={styles.input}
                  placeholder={`Max: ${loan.soldeRestant}`}
                  required disabled={repLoading}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Date de paiement</label>
                <input type="date" value={repDate}
                  onChange={(e) => setRepDate(e.target.value)}
                  className={styles.input} disabled={repLoading} />
              </div>
            </div>
            <button type="submit" className={styles.btnPrimary}
              disabled={repLoading || !repAmount}>
              {repLoading ? 'Enregistrement…' : 'Enregistrer le paiement'}
            </button>
          </form>
        </div>
      )}

      {/* Pénalité */}
      {peutPenaliser && (
        <div className={styles.penaltyCard}>
          <h2 className={styles.sectionTitle}>Appliquer une pénalité</h2>
          <p className={styles.penaltyInfo}>
            Calcul : {formatFCFA(loan.principal)} × 5% × {formatJours(loan.joursRetard)} = {' '}
            <strong>{formatFCFA(Math.round(loan.principal * 0.05 * loan.joursRetard))}</strong>
          </p>
          {penError && <ErrorMessage message={penError} />}
          <button onClick={handlePenalty} className={styles.btnWarning} disabled={penLoading}>
            {penLoading ? 'Application…' : 'Appliquer la pénalité'}
          </button>
        </div>
      )}

      {/* Onglets historique */}
      <div className={styles.tabs}>
        {[
          { key: 'historique', label: `Remboursements (${loan.repayments?.length || 0})` },
          { key: 'penalites',  label: `Pénalités (${loan.penaltyLogs?.length || 0})` },
        ].map(({ key, label }) => (
          <button key={key}
            className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'historique' && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead><tr><th>Date</th><th>Montant</th><th>Solde restant</th></tr></thead>
            <tbody>
              {!loan.repayments?.length ? (
                <tr><td colSpan={3} className={styles.empty}>Aucun remboursement enregistré.</td></tr>
              ) : remboursementsAvecSolde.map((r) => (
                <tr key={r.id}>
                  <td className={styles.date}>{formatDate(r.paymentDate)}</td>
                  <td className={styles.amount}>{formatFCFA(r.amount)}</td>
                  <td className={styles.amount}>{formatFCFA(r.soldeRestantApres)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'penalites' && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead><tr><th>Date</th><th>Jours</th><th>Montant</th></tr></thead>
            <tbody>
              {!loan.penaltyLogs?.length ? (
                <tr><td colSpan={3} className={styles.empty}>Aucune pénalité appliquée.</td></tr>
              ) : loan.penaltyLogs.map((p) => (
                <tr key={p.id}>
                  <td className={styles.date}>{formatDate(p.appliedDate)}</td>
                  <td className={styles.date}>{formatJours(p.daysOverdue)}</td>
                  <td className={styles.amount}>{formatFCFA(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
