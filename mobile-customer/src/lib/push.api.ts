import { apiFetch, slugPath } from './api'

export const pushApi = {
  register: (token: string, platform: string): Promise<void> =>
    apiFetch(slugPath('/auth/device-token'), {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  deregister: (token: string): Promise<void> =>
    apiFetch(slugPath('/auth/device-token'), {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),
}
