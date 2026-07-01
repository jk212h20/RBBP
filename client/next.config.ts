import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Silence the multi-lockfile workspace-root warning by pinning the root.
    root: __dirname,
  },
};

export default nextConfig;
