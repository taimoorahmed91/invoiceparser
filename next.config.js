/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore canvas module in serverless environment
      config.resolve.alias.canvas = false;
    }
    return config;
  },
}

module.exports = nextConfig
