import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Fully static export: nginx serves `out/` directly, no Node runtime on the server.
  output: 'export',
  // Emits `<route>/index.html`, which pairs with nginx `try_files $uri $uri/index.html`.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Dev only. `next export` ignores rewrites; production uses nginx.
  // `beforeFiles` so POST /check is not 308'd to /check/ by trailingSlash.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/e', destination: 'http://127.0.0.1:8787/e' },
        { source: '/box', destination: 'http://127.0.0.1:8787/box' },
        { source: '/check', destination: 'http://127.0.0.1:8787/check' },
        { source: '/check/', destination: 'http://127.0.0.1:8787/check' },
        { source: '/credential', destination: 'http://127.0.0.1:8787/credential' },
        { source: '/credential/', destination: 'http://127.0.0.1:8787/credential' },
        { source: '/api/v1/:path*', destination: 'http://127.0.0.1:8787/api/v1/:path*' },
        { source: '/api/v1/:path*/', destination: 'http://127.0.0.1:8787/api/v1/:path*' },
      ],
    }
  },
}

export default nextConfig
