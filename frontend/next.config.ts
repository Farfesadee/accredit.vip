import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "http://localhost:8000/uploads/:path*" },
    ];
  },
};

export default nextConfig;
