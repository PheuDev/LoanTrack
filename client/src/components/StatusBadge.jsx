import styles from './StatusBadge.module.css';
import { labelStatutPret, labelStatutClient } from '../utils/format.js';

/**
 * Badge coloré pour afficher un statut de prêt ou de client.
 * Les couleurs sont définies dans theme.css via --color-status-*.
 *
 * @param {string} status   - Valeur du statut ('actif', 'en_retard', 'solde', 'annule', 'suspendu')
 * @param {'loan'|'client'} type - Type de ressource (détermine le label affiché)
 */
export default function StatusBadge({ status, type = 'loan' }) {
  const label = type === 'client' ? labelStatutClient(status) : labelStatutPret(status);

  return (
    <span className={`${styles.badge} ${styles[status?.replace('_', '-')]}`}>
      {label}
    </span>
  );
}
