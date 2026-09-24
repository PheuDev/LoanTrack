import { apiFetch } from './http.js';

export async function getTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/transactions${query ? `?${query}` : ''}`);
}
