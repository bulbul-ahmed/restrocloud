import { io, type Socket } from 'socket.io-client'

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api')
  .replace('/api', '')

let socket: Socket | null = null

export function getOrderingSocket(): Socket {
  if (socket?.connected) return socket

  socket = io(`${WS_URL}/realtime`, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
  })

  return socket
}

export function disconnectOrderingSocket() {
  socket?.disconnect()
  socket = null
}
