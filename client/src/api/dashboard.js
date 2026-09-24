import { apiFetch } from './http.js';

export async function getDashboardData() {
  return apiFetch('/dashboard');
}
