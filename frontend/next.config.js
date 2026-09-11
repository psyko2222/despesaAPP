/** @type {import('next').NextConfig} */

// Remove barras no final e garante que o protocolo está correto
let rawUrl = process.env.NEXT_PUBLIC_API_URL || 'https://despesaapp.onrender.com';
rawUrl = rawUrl.replace(/\/+$/, ''); // Remove / do final se existir
const formattedUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: formattedUrl,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${formattedUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;