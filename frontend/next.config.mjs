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
  // 在容器环境中，使用环境变量 BACKEND_URL（默认为 app:8008，即 Docker 服务名）
  // 在本地开发环境中，使用 localhost:8008
  async rewrites() {
    // 从环境变量获取后端地址
    // 优先级：BACKEND_URL 环境变量 > 生产环境默认值 > 开发环境默认值
    let backendUrl = process.env.BACKEND_URL
    
    if (!backendUrl) {
      // 如果没有设置环境变量，根据 NODE_ENV 判断
      // 在 Docker 容器中，NODE_ENV 通常是 production
      backendUrl = process.env.NODE_ENV === 'production' 
        ? 'http://app:8008'  // Docker 服务名
        : 'http://localhost:8008'  // 本地开发
    }
    
    console.log(`[Next.js Config] Backend URL for API proxy: ${backendUrl}`)
    
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
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
