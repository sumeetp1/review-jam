import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/brands/widgets", destination: "/brands/dashboard/widget-studio", permanent: true },
      { source: "/brands/carousel", destination: "/brands/dashboard/amazon-images", permanent: true },
    ];
  },
};

export default nextConfig;
