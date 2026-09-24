import { apiFetch } from './http.js';

export async function getRepayments(loanId) {
  return apiFetch(`/loans/${loanId}/repayments`);
}

export async function addRepayment(loanId, amount, paymentDate) {
  return apiFetch(`/loans/${loanId}/repayments`, {
    method: 'POST',
    body: JSON.stringify({ amount, paymentDate }),
  });
}
