import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getLoans } from '../api/loans.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate, formatJours } from '../utils/format.js';
import styles from './LoansPage.module.css';

const STATUTS = [
  { value: '',          label: 'Tous' },
  { value: 'actif',     label: 'Actif' },
  { value: 'en_retard', label: 'En retard' },
  { value: 'solde',     label: 'Soldé' },
  { value: 'annule',    label: 'Annulé' },
];

export default function LoansPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loans, setLoans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Le filtre actif vient de l'URL (?status=…) pour permettre les liens externes (ex: dashboard)
  const statusFilter = searchParams.get('status') || '';

  useEffect(() => {
    loadLoans();
  }, []);

  async function loadLoans() {
    setLoading(true);
    setError('');
    try {
      setLoans(await getLoans());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setFilter(value) {
    if (value) {
      setSearchParams({ status: value });
    } else {
      setSearchParams({});
    }
  }

  // Filtrage côté frontend — pas de rechargement serveur
  const loansFiltres = statusFilter
    ? loans.filter((l) => l.status === statusFilter)
    : loans;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Prêts</h1>
          <p className={styles.subtitle}>
            {loansFiltres.length} prêt{loansFiltres.length !== 1 ? 's' : ''}
            {statusFilter ? ` · filtre : ${STATUTS.find(s => s.value === statusFilter)?.label}` : ' au total'}
          </p>
        </div>
        <Link to="/loans/new" className={styles.btnPrimary}>+ Nouveau prêt</Link>
      </div>

      {/* Filtres statut — réactifs, changement instantané */}
      <div className={styles.filters} role="group" aria-label="Filtrer par statut">
        {STATUTS.map(({ value, label }) => (
          <button
            key={value}
            className={`${styles.filterBtn} ${statusFilter === value ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(value)}
          >
            {label}
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
                <tr>
                  <td colSpan={8} className={styles.empty}>Aucun prêt trouvé.</td>
                </tr>
              ) : (
                loansFiltres.map((loan) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
