import { api } from './api'

function unwrap<T>(res: { data: { success: boolean; data: T } }): T {
  return res.data.data
}

export async function getMySubscription() {
  return unwrap(await api.get('/billing'))
}

export async function upgradePlan(plan: string, billingCycle: string) {
  return unwrap(await api.post('/billing/upgrade', { plan, billingCycle }))
}

export async function cancelSubscription() {
  return unwrap(await api.post('/billing/cancel'))
}

export async function reactivateSubscription() {
  return unwrap(await api.post('/billing/reactivate'))
}

export async function pauseSubscription() {
  return unwrap(await api.post('/billing/pause'))
}

export async function resumeSubscription() {
  return unwrap(await api.post('/billing/resume'))
}

export async function listInvoices(page = 1, limit = 20) {
  return unwrap(await api.get('/billing/invoices', { params: { page, limit } }))
}
