import { apiFetch } from './http.js';

export async function login(username, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export async function changePassword(currentPassword, newPassword) {
  return apiFetch('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
