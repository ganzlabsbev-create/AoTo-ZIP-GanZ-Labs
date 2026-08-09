/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["adm-zip"],
  },
};

export default nextConfig;
