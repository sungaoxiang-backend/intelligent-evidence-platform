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
  // API代理配置
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8008/api/v1/:path*',
      },
    ]
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
  // 修复React Server Components bundler问题
  serverExternalPackages: [],
  // 修复模块解析问题
  transpilePackages: [],
  // 确保客户端组件正确识别
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

export default nextConfig
