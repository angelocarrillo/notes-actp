import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Allow the AIO dashboard to embed this app in an iframe
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://aio-actp.vercel.app",
          },
        ],
      },
    ]
  },
}

export default nextConfig
