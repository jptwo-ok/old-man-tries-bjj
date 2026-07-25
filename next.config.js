/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "cdn.oldmantriesbjj.com" },
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

module.exports = nextConfig;