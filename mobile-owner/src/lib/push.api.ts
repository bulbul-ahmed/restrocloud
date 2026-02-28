import { apiFetch } from './api'

export const pushApi = {
  register: (token: string, platform: string): Promise<{ registered: boolean }> =>
    apiFetch('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  deregister: (token: string): Promise<{ deregistered: boolean }> =>
    apiFetch('/push/deregister', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),
}
