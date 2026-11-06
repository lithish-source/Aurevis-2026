import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // transformers.js ships onnxruntime-node (native .node binaries) — keep it
  // external so the server bundles never try to pack it
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
