import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Exclude Supabase Edge Functions from Next.js build
  serverExternalPackages: ["supabase"],
};

export default nextConfig;
