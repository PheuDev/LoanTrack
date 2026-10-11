import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAuthHeaders } from '../api/http.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate } from '../utils/format.js';
import styles from './TransactionsPage.module.css';

// Retourne la date du 1er du mois courant au format YYYY-MM-DD
function debutMoisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Retourne la date d'aujourd'hui au format YYYY-MM-DD
function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination]     = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [page, setPage]                 = useState(1);

  // Pré-remplis avec le mois courant par défaut
  const [dateFrom, setDateFrom] = useState(debutMoisCourant);
  const [dateTo, setDateTo]     = useState(aujourdhui);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (dateFrom) params.from = dateFrom;
      if (dateTo)   params.to   = dateTo;

      const response = await fetch(
        `${API_BASE}/transactions?${new URLSearchParams(params)}`,
        { headers: getAuthHeaders() }
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

  // Recharge automatiquement quand les filtres ou la page changent
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function resetFiltres() {
    setDateFrom(debutMoisCourant());
    setDateTo(aujourdhui());
    setPage(1);
  }

  const estFiltreMoisCourant =
    dateFrom === debutMoisCourant() && dateTo === aujourdhui();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Transactions</h1>
          <p className={styles.subtitle}>
            {pagination.total} remboursement{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filtres dates — réactifs, pas de bouton "Filtrer" */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="dateFrom" className={styles.filterLabel}>Du</label>
          <input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className={styles.input}
          />
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="dateTo" className={styles.filterLabel}>Au</label>
          <input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className={styles.input}
          />
        </div>
        {!estFiltreMoisCourant && (
          <button type="button" className={styles.btnReset} onClick={resetFiltres}>
            Réinitialiser
          </button>
        )}
      </div>

      {loading && <LoadingSpinner message="Chargement…" />}
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
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      Aucune transaction sur cette période.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id}>
                      <td className={styles.date}>{formatDate(t.paymentDate)}</td>
                      <td>
                        <Link to={`/clients/${t.loan?.client?.id}`} className={styles.clientLink}>
                          {t.loan?.client?.firstName} {t.loan?.client?.lastName}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/loans/${t.loanId}`} className={styles.loanLink}>
                          Prêt #{t.loanId} · Niv.&nbsp;{t.loan?.level}
                        </Link>
                      </td>
                      <td className={styles.amount}>{formatFCFA(t.amount)}</td>
                      <td className={styles.amount}>
                        {t.soldeRestantApres == null ? '—' : formatFCFA(t.soldeRestantApres)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                ← Précédent
              </button>
              <span className={styles.pageInfo}>
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
