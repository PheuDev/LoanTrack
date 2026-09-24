import styles from './LoadingSpinner.module.css';

export default function LoadingSpinner({ message = 'Chargement…' }) {
  return (
    <div className={styles.wrapper} role="status" aria-label={message}>
      <div className={styles.spinner} />
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
