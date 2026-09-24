// Fonctions utilitaires pour les appels API.
// Toutes les fonctions des autres fichiers api/ s'appuient sur celles-ci.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Retourne les en-têtes communs à toutes les requêtes authentifiées
export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Fonction de fetch centralisée.
// Lance la requête, vérifie la réponse, retourne les données ou lève une erreur.
export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const json = await response.json();

  if (!response.ok) {
    // On lève une erreur avec le message du serveur pour l'afficher dans l'UI
    const message = json?.error?.message || 'Une erreur est survenue.';
    const error = new Error(message);
    error.code = json?.error?.code;
    error.status = response.status;
    throw error;
  }

  return json.data;
}
