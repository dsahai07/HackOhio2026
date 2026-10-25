import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, devIndicators: false, serverExternalPackages: ['unpdf'], turbopack: { root: process.cwd() } };
export default config;
