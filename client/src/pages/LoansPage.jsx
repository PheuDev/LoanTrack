import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLoans } from '../api/loans.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate, formatJours } from '../utils/format.js';
import styles from './LoansPage.module.css';

const STATUTS = ['actif', 'en_retard', 'solde', 'annule'];

export default function LoansPage() {
  const [loans, setLoans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [statusFilter, setFilter] = useState('');

  useEffect(() => { loadLoans(); }, []);

  async function loadLoans() {
    setLoading(true); setError('');
    try { setLoans(await getLoans()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const loansFiltres = statusFilter
    ? loans.filter((l) => l.status === statusFilter)
    : loans;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Prêts</h1>
          <p className={styles.subtitle}>{loans.length} prêt{loans.length !== 1 ? 's' : ''} au total</p>
        </div>
        <Link to="/loans/new" className={styles.btnPrimary}>+ Nouveau prêt</Link>
      </div>

      {/* Filtres statut */}
      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${!statusFilter ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('')}
        >Tous</button>
        {STATUTS.map((s) => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(s)}
          >
            <StatusBadge status={s} />
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner message="Chargement des prêts…" />}
      {error   && <ErrorMessage message={error} onRetry={loadLoans} />}

      {!loading && !error && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Niveau</th>
                <th>Capital</th>
                <th>Restant dû</th>
                <th>Échéance</th>
                <th>Retard</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loansFiltres.length === 0 ? (
                <tr><td colSpan={8} className={styles.empty}>Aucun prêt trouvé.</td></tr>
              ) : loansFiltres.map((loan) => (
                <tr key={loan.id}>
                  <td>
                    <Link to={`/clients/${loan.client.id}`} className={styles.clientLink}>
                      {loan.client.firstName} {loan.client.lastName}
                    </Link>
                  </td>
                  <td className={styles.center}>Niv. {loan.level}</td>
                  <td>{formatFCFA(loan.principal)}</td>
                  <td className={loan.soldeRestant > 0 ? styles.soldePositif : ''}>
                    {formatFCFA(loan.soldeRestant)}
                  </td>
                  <td className={styles.date}>{formatDate(loan.dueDate)}</td>
                  <td className={loan.joursRetard > 0 ? styles.retard : styles.date}>
                    {loan.joursRetard > 0 ? formatJours(loan.joursRetard) : '—'}
                  </td>
                  <td><StatusBadge status={loan.status} /></td>
                  <td>
                    <Link to={`/loans/${loan.id}`} className={styles.btnLink}>Voir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
