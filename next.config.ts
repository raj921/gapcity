import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  poweredByHeader: false,
  serverExternalPackages: [],
  async headers() {
    return [{source: '/(.*)', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=()'}
    ]}];
  }
};
export default config;
