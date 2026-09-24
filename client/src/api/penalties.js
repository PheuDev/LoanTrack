import { apiFetch } from './http.js';

export async function getPenalties(loanId) {
  return apiFetch(`/loans/${loanId}/penalties`);
}

export async function applyPenalty(loanId, { joursRetard, appliedDate } = {}) {
  return apiFetch(`/loans/${loanId}/penalties`, {
    method: 'POST',
    body: JSON.stringify({ joursRetard, appliedDate }),
  });
}
