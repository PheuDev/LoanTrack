import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getDashboardData } from '../api/dashboard.js';
import KpiCard from '../components/KpiCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { formatFCFA, formatDate, formatJours } from '../utils/format.js';
import styles from './DashboardPage.module.css';

// Lit les CSS custom properties pour que les graphiques suivent le thème
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function DashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError('');
    try { setData(await getDashboardData()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (loading) return <LoadingSpinner message="Chargement du tableau de bord…" />;
  if (error)   return <ErrorMessage message={error} onRetry={loadData} />;
  if (!data)   return null;

  const { kpis, repartitionStatuts, evolutionMensuelle, pretsEnRetard, derniersPrets, dernieresOperations } = data;

  const PIE_COLORS = [
    getCSSVar('--color-chart-actif')  || '#2563eb',
    getCSSVar('--color-chart-retard') || '#dc2626',
    getCSSVar('--color-chart-solde')  || '#16a34a',
  ];

  const pieData = repartitionStatuts.map((r, i) => ({
    name: r.statut === 'en_retard' ? 'En retard' : r.statut.charAt(0).toUpperCase() + r.statut.slice(1),
    value: r.count,
    color: PIE_COLORS[i],
  }));

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tableau de bord</h1>
          <p className={styles.subtitle}>Vue d'ensemble de votre activité · {today}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <KpiCard icon="📊" label="Prêts actifs" value={kpis.loansActifs} color="primary" />
        <KpiCard icon="📈" label="Prêts soldés" value={kpis.loansSoldes} color="success" />
        <KpiCard icon="💰" label="Montant total prêté" value={formatFCFA(kpis.montantTotalPrete)} color="success" />
        <KpiCard icon="✅" label="Montant récupéré" value={formatFCFA(kpis.montantRecupere)} color="success" />
        <KpiCard icon="⏳" label="Montant encore dû" value={formatFCFA(kpis.montantRestantTotal)} color="primary" />
        <KpiCard icon="⚠" label="Prêts en retard" value={kpis.loansEnRetard} color={kpis.loansEnRetard > 0 ? 'danger' : 'primary'} />
      </div>

      {/* Graphiques */}
      <div className={styles.chartsRow}>
        {/* Courbe évolution */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Évolution des prêts</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolutionMensuelle}>
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: getCSSVar('--color-text-muted') }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: getCSSVar('--color-text-muted') }} />
              <Tooltip
                contentStyle={{ backgroundColor: getCSSVar('--color-surface'), border: `1px solid ${getCSSVar('--color-border')}`, borderRadius: '8px' }}
                labelStyle={{ color: getCSSVar('--color-text') }}
              />
              <Line type="monotone" dataKey="count" name="Prêts" stroke={getCSSVar('--color-chart-line') || '#2563eb'} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut répartition */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Répartition des statuts</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="40%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                formatter={(value, entry) => (
                  <span style={{ color: getCSSVar('--color-text'), fontSize: '12px' }}>
                    {value} ({entry.payload.value})
                  </span>
                )}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prêts en retard */}
      {pretsEnRetard.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Prêts en retard</h2>
            <Link to="/loans?status=en_retard" className={styles.seeAll}>Voir tous</Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr><th>Client</th><th>Niveau</th><th>Échéance</th><th>Retard</th><th>Solde restant</th><th></th></tr>
              </thead>
              <tbody>
                {pretsEnRetard.map((l) => (
                  <tr key={l.id}>
                    <td className={styles.clientName}>{l.client.firstName} {l.client.lastName}</td>
                    <td>Niv. {l.level}</td>
                    <td className={styles.muted}>{formatDate(l.dueDate)}</td>
                    <td className={styles.retard}>{formatJours(l.joursRetard)}</td>
                    <td className={styles.solde}>{formatFCFA(l.soldeRestant)}</td>
                    <td><Link to={`/loans/${l.id}`} className={styles.link}>Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dernières opérations */}
      {dernieresOperations?.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Dernières opérations</h2>
            <Link to="/transactions" className={styles.seeAll}>Voir toutes</Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr><th>Client</th><th>Prêt</th><th>Montant</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {dernieresOperations.map((op) => (
                  <tr key={op.id}>
                    <td className={styles.clientName}>{op.loan?.client?.firstName} {op.loan?.client?.lastName}</td>
                    <td>Prêt #{op.loanId}</td>
                    <td>{formatFCFA(op.amount)}</td>
                    <td className={styles.muted}>{formatDate(op.paymentDate)}</td>
                    <td><Link to={`/loans/${op.loanId}`} className={styles.link}>Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Derniers prêts */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Derniers prêts</h2>
          <Link to="/loans" className={styles.seeAll}>Voir tous</Link>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr><th>Client</th><th>Niveau</th><th>Capital</th><th>Date</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {derniersPrets.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>Aucun prêt enregistré.</td></tr>
              ) : derniersPrets.map((l) => (
                <tr key={l.id}>
                  <td className={styles.clientName}>{l.client.firstName} {l.client.lastName}</td>
                  <td>Niv. {l.level}</td>
                  <td>{formatFCFA(l.principal)}</td>
                  <td className={styles.muted}>{formatDate(l.createdAt)}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td><Link to={`/loans/${l.id}`} className={styles.link}>Voir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
