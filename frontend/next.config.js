/** @type {import('next').NextConfig} */
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://despesaapp.onrender.com';
const formattedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

const nextConfig = {
  reactStrictMode: true,
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