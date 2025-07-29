/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 优化热重载配置
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // 减少热重载时的错误
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.git', '**/.next'],
      }
    }
    return config
  },
  // 开发环境优化
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
