import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Fully static export: nginx serves `out/` directly, no Node runtime on the server.
  output: 'export',
  // Emits `<route>/index.html`, which pairs with nginx `try_files $uri $uri/index.html`.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default nextConfig
