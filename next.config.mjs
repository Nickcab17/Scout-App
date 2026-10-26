/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.PLAYWRIGHT_E2E === "1" ? ".next-e2e" : ".next",
};
export default nextConfig;
