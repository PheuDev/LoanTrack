import { apiFetch } from './http.js';

export async function getLoans(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/loans${query ? `?${query}` : ''}`);
}

export async function getLoan(id) {
  return apiFetch(`/loans/${id}`);
}

export async function createLoan(clientId, level) {
  return apiFetch('/loans', {
    method: 'POST',
    body: JSON.stringify({ clientId, level }),
  });
}

export async function cancelLoan(id) {
  return apiFetch(`/loans/${id}/cancel`, { method: 'PATCH' });
}
