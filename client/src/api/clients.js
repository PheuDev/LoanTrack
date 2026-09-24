import { apiFetch } from './http.js';

export async function getClients(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/clients${query ? `?${query}` : ''}`);
}

export async function getClient(id) {
  return apiFetch(`/clients/${id}`);
}

export async function createClient(data) {
  return apiFetch('/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClient(id, data) {
  return apiFetch(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
