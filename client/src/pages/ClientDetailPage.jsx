import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getClient } from '../api/clients.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate, formatJours } from '../utils/format.js';
import styles from './ClientDetailPage.module.css';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => { loadClient(); }, [id]);

  async function loadClient() {
    setLoading(true); setError('');
    try { setClient(await getClient(id)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (loading) return <LoadingSpinner message="Chargement du client…" />;
  if (error)   return <ErrorMessage message={error} onRetry={loadClient} />;
  if (!client) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}>← Retour</button>
        <div className={styles.headerMain}>
          <div className={styles.clientInfo}>
            <div className={styles.avatar}>
              {client.firstName.charAt(0)}{client.lastName.charAt(0)}
            </div>
            <div>
              <h1 className={styles.name}>{client.firstName} {client.lastName}</h1>
              <p className={styles.phone}>{client.phone}</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <StatusBadge status={client.status} type="client" />
            <Link to={`/clients/${id}/edit`} className={styles.btnSecondary}>Modifier</Link>
            <Link to={`/loans/new?clientId=${id}`} className={styles.btnPrimary}>+ Nouveau prêt</Link>
          </div>
        </div>
      </div>

      {/* Informations */}
      <div className={styles.infoCard}>
        <h2 className={styles.sectionTitle}>Informations</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Inscrit le</span>
            <span className={styles.infoValue}>{formatDate(client.createdAt)}</span>
          </div>
          {client.address && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Adresse</span>
              <span className={styles.infoValue}>{client.address}</span>
            </div>
          )}
          {client.notes && (
            <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
              <span className={styles.infoLabel}>Notes</span>
              <span className={styles.infoValue}>{client.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Prêts */}
      <div className={styles.loansSection}>
        <h2 className={styles.sectionTitle}>
          Prêts ({client.loans?.length || 0})
        </h2>
        {!client.loans?.length ? (
          <p className={styles.empty}>Aucun prêt pour ce client.</p>
        ) : (
          <div className={styles.loansList}>
            {client.loans.map((loan) => (
              <Link key={loan.id} to={`/loans/${loan.id}`} className={styles.loanCard}>
                <div className={styles.loanTop}>
                  <span className={styles.loanLevel}>Niveau {loan.level}</span>
                  <StatusBadge status={loan.status} />
                </div>
                <div className={styles.loanAmounts}>
                  <div>
                    <div className={styles.amountLabel}>Capital</div>
                    <div className={styles.amountValue}>{formatFCFA(loan.principal)}</div>
                  </div>
                  <div>
                    <div className={styles.amountLabel}>Restant dû</div>
                    <div className={styles.amountValue}>{formatFCFA(loan.soldeRestant)}</div>
                  </div>
                </div>
                <div className={styles.loanDates}>
                  <span>Échéance : {formatDate(loan.dueDate)}</span>
                  {loan.joursRetard > 0 && (
                    <span className={styles.retard}>
                      {formatJours(loan.joursRetard)} de retard
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
