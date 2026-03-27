import type { NextConfig } from 'next'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'
const backendBase = apiUrl.replace(/\/api$/, '')

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.onrender.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendBase}/uploads/:path*`,
      },
    ]
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
}

export default nextConfig
