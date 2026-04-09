/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

// Upload source maps to Sentry only when an auth token is available.
// Local builds without a token and CI forks without secrets skip the
// upload silently. Token / org / project are read from env — from
// `.env.sentry-build-plugin` locally (gitignored) or from the host env
// in Vercel/CI.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    react(),
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG || 'canopy-home',
            project: process.env.SENTRY_PROJECT || 'canopy-web',
            authToken: sentryAuthToken,
            // Source maps are emitted as "hidden" below so the browser
            // can't fetch them, but Sentry still gets them via upload.
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: 'hidden',
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
