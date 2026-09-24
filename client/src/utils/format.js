// Fonctions de formatage pures — aucun effet de bord, aucun appel réseau.
// Utilisées dans tous les composants pour afficher les données de manière cohérente.

/**
 * Formate un montant en FCFA.
 * Ex : 32500 → "32 500 FCFA"
 */
export function formatFCFA(montant) {
  if (montant === null || montant === undefined) return '—';
  return new Intl.NumberFormat('fr-FR').format(montant) + ' FCFA';
}

/**
 * Formate une date ISO ou un objet Date en format lisible.
 * Ex : "2025-01-08" → "8 janv. 2025"
 */
export function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Formate une date et heure.
 * Ex : "2025-01-08T14:30:00Z" → "8 janv. 2025, 14:30"
 */
export function formatDateTime(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Formate un nombre de jours de retard.
 * Ex : 1 → "1 jour", 5 → "5 jours"
 */
export function formatJours(n) {
  if (!n || n <= 0) return '0 jour';
  return `${n} jour${n > 1 ? 's' : ''}`;
}

/**
 * Retourne le label lisible d'un statut de prêt.
 */
export function labelStatutPret(status) {
  const labels = {
    actif:     'Actif',
    en_retard: 'En retard',
    solde:     'Soldé',
    annule:    'Annulé',
  };
  return labels[status] || status;
}

/**
 * Retourne le label lisible d'un statut de client.
 */
export function labelStatutClient(status) {
  return status === 'suspendu' ? 'Suspendu' : 'Actif';
}

/**
 * Calcule le pourcentage de remboursement d'un prêt.
 * Ex : totalDu=32500, rembourse=10000 → 31
 */
export function pourcentageRembourse(totalDu, penalites, rembourse) {
  const total = totalDu + (penalites || 0);
  if (!total) return 0;
  return Math.min(100, Math.round((rembourse / total) * 100));
}
