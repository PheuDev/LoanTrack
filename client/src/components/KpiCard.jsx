import styles from './KpiCard.module.css';

/**
 * Carte d'indicateur clé pour le tableau de bord.
 * @param {string} label     - Libellé de l'indicateur
 * @param {string} value     - Valeur principale (déjà formatée)
 * @param {string} [color]   - Variante de couleur : 'primary' | 'success' | 'danger' | 'warning'
 * @param {string} [icon]    - Emoji ou caractère à afficher
 */
export default function KpiCard({ label, value, color = 'primary', icon }) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
    </div>
  );
}
