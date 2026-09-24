import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClient, getClient, updateClient } from '../api/clients.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import styles from './ClientFormPage.module.css';

export default function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', address: '', notes: '' });
  const [loading, setLoading]     = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!isEdit) return;
    getClient(id).then((data) => {
      setForm({
        firstName: data.firstName || '',
        lastName:  data.lastName  || '',
        phone:     data.phone     || '',
        address:   data.address   || '',
        notes:     data.notes     || '',
      });
      setLoadingData(false);
    }).catch((err) => { setError(err.message); setLoadingData(false); });
  }, [id, isEdit]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        phone:     form.phone.trim(),
        ...(form.address ? { address: form.address.trim() } : {}),
        ...(form.notes   ? { notes:   form.notes.trim()   } : {}),
      };
      if (isEdit) {
        await updateClient(id, payload);
        navigate(`/clients/${id}`);
      } else {
        const client = await createClient(payload);
        navigate(`/clients/${client.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) return <LoadingSpinner message="Chargement du client…" />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}>← Retour</button>
        <h1 className={styles.title}>{isEdit ? 'Modifier le client' : 'Nouveau client'}</h1>
      </div>

      <div className={styles.card}>
        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="firstName" className={styles.label}>Prénom *</label>
              <input id="firstName" name="firstName" value={form.firstName}
                onChange={handleChange} required className={styles.input}
                placeholder="ex: Kofi" disabled={loading} />
            </div>
            <div className={styles.field}>
              <label htmlFor="lastName" className={styles.label}>Nom *</label>
              <input id="lastName" name="lastName" value={form.lastName}
                onChange={handleChange} required className={styles.input}
                placeholder="ex: Mensah" disabled={loading} />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="phone" className={styles.label}>Téléphone *</label>
            <input id="phone" name="phone" value={form.phone} type="tel"
              onChange={handleChange} required className={styles.input}
              placeholder="ex: 0700000001" disabled={loading} />
          </div>

          <div className={styles.field}>
            <label htmlFor="address" className={styles.label}>Adresse</label>
            <input id="address" name="address" value={form.address}
              onChange={handleChange} className={styles.input}
              placeholder="ex: Abidjan, Cocody" disabled={loading} />
          </div>

          <div className={styles.field}>
            <label htmlFor="notes" className={styles.label}>Notes</label>
            <textarea id="notes" name="notes" value={form.notes}
              onChange={handleChange} className={styles.textarea}
              placeholder="Informations complémentaires…" rows={3} disabled={loading} />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondary}
              onClick={() => navigate(-1)} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className={styles.btnPrimary}
              disabled={loading || !form.firstName || !form.lastName || !form.phone}>
              {loading ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer le client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
