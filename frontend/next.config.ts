import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: false, // 禁用CSS优化避免critters依赖
  },
};

export default nextConfig;
