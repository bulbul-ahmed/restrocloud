import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/auth.store'

const WS_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api')
  .replace('/api', '')   // strip /api — WS connects to base host

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket   // return existing instance regardless of connection state

  const token = useAuthStore.getState().accessToken

  socket = io(`${WS_URL}/realtime`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
