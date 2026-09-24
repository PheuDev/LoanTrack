import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClients } from '../api/clients.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate } from '../utils/format.js';
import styles from './ClientsPage.module.css';

export default function ClientsPage() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    setError('');
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filtrage côté frontend
  const clientsFiltres = clients.filter((c) => {
    const matchStatus = !statusFilter || c.status === statusFilter;
    const terme = search.toLowerCase();
    const matchSearch = !search ||
      c.firstName.toLowerCase().includes(terme) ||
      c.lastName.toLowerCase().includes(terme) ||
      c.phone.includes(terme);
    return matchStatus && matchSearch;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Clients</h1>
          <p className={styles.subtitle}>
            {clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/clients/new" className={styles.btnPrimary}>
          + Nouveau client
        </Link>
      </div>

      {/* Filtres */}
      <div className={styles.filters}>
        <input
          type="search"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.select}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
        </select>
      </div>

      {/* Contenu */}
      {loading && <LoadingSpinner message="Chargement des clients…" />}
      {error   && <ErrorMessage message={error} onRetry={loadClients} />}

      {!loading && !error && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Inscrit le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clientsFiltres.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                clientsFiltres.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className={styles.clientName}>
                        <div className={styles.avatar}>
                          {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className={styles.fullName}>
                            {client.firstName} {client.lastName}
                          </div>
                          {client.address && (
                            <div className={styles.address}>{client.address}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={styles.phone}>{client.phone}</td>
                    <td>
                      <StatusBadge status={client.status} type="client" />
                    </td>
                    <td className={styles.date}>{formatDate(client.createdAt)}</td>
                    <td>
                      <Link to={`/clients/${client.id}`} className={styles.btnLink}>
                        Voir
                      </Link>
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
