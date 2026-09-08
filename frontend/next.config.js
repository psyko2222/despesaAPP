/** @type {import('next').NextConfig} */
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://despesaapp.onrender.com';
const formattedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Ignora erros de TypeScript durante o build em produção na Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora avisos/erros do ESLint durante o build em produção na Vercel
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