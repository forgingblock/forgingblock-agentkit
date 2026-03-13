/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  serverExternalPackages: [
    "viem",
    "@noble/hashes",
    "@coinbase/agentkit"
  ]
};

export default nextConfig;