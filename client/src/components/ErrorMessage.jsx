import styles from './ErrorMessage.module.css';

/**
 * Affiche un message d'erreur cohérent.
 * @param {string} message - Message à afficher
 * @param {function} onRetry - Callback optionnel pour réessayer
 */
export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className={styles.wrapper} role="alert">
      <span className={styles.icon}>⚠</span>
      <p className={styles.message}>{message || 'Une erreur est survenue.'}</p>
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}
