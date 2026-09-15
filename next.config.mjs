/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, far too small for phone camera photos/videos
      // uploaded through Server Actions (this app's monitoring visit
      // uploads, task media, property documents, etc.).
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
