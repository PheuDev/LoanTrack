import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getTransactions } from '../api/transactions.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate } from '../utils/format.js';
import styles from './TransactionsPage.module.css';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination]     = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [page, setPage]                 = useState(1);
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const loadTransactions = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (dateFrom) params.from = dateFrom;
      if (dateTo)   params.to   = dateTo;
      // getTransactions retourne { data, pagination } — on doit lire la réponse brute
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/transactions?${new URLSearchParams(params)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || 'Erreur');
      setTransactions(json.data);
      setPagination(json.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  function handleFilter(e) {
    e.preventDefault();
    setPage(1);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Transactions</h1>
          <p className={styles.subtitle}>
            {pagination.total} remboursement{pagination.total !== 1 ? 's' : ''} au total
          </p>
        </div>
      </div>

      {/* Filtres dates */}
      <form onSubmit={handleFilter} className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Du</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={styles.input} />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Au</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={styles.input} />
        </div>
        <button type="submit" className={styles.btnFilter}>Filtrer</button>
        {(dateFrom || dateTo) && (
          <button type="button" className={styles.btnReset}
            onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
            Réinitialiser
          </button>
        )}
      </form>

      {loading && <LoadingSpinner message="Chargement des transactions…" />}
      {error   && <ErrorMessage message={error} onRetry={loadTransactions} />}

      {!loading && !error && (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Prêt</th>
                  <th>Montant payé</th>
                  <th>Solde restant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className={styles.empty}>Aucune transaction trouvée.</td></tr>
                ) : transactions.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.date}>{formatDate(t.paymentDate)}</td>
                    <td>
                      <Link to={`/clients/${t.loan?.client?.id}`} className={styles.clientLink}>
                        {t.loan?.client?.firstName} {t.loan?.client?.lastName}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/loans/${t.loanId}`} className={styles.loanLink}>
                        Prêt #{t.loanId} · Niv. {t.loan?.level}
                      </Link>
                    </td>
                    <td className={styles.amount}>{formatFCFA(t.amount)}</td>
                    <td className={styles.amount}>
                      {t.soldeRestantApres === null || t.soldeRestantApres === undefined
                        ? '—'
                        : formatFCFA(t.soldeRestantApres)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}>← Précédent</button>
              <span className={styles.pageInfo}>
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}>Suivant →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
