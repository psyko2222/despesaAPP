/** @type {import('next').NextConfig} */

// Remove barras no final e garante que o protocolo está correto
let rawUrl = process.env.NEXT_PUBLIC_API_URL || 'https://despesaapp.onrender.com';
rawUrl = rawUrl.replace(/\/+$/, ''); // Remove / do final se existir
const formattedUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

// Data e hora do build formatada em hora de Portugal (Europe/Lisbon)
const buildTime = new Date().toLocaleString('pt-PT', {
  timeZone: 'Europe/Lisbon',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

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
    NEXT_PUBLIC_BUILD_TIME: buildTime,
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