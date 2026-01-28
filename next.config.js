/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore canvas module in serverless environment
      config.resolve.alias.canvas = false;
      config.resolve.alias['@napi-rs/canvas'] = false;
    }
    return config;
  },
}

module.exports = nextConfig
