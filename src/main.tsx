import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CookieConsent from './components/CookieConsent';
import logger from './utils/logger';
import { initGA } from './utils/analytics';
import { initSentry } from './utils/sentry';
import './index.css';

// ─── Validate required environment variables on startup ───
const REQUIRED_ENV_VARS: Record<string, string | undefined> = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

const OPTIONAL_ENV_VARS: Record<string, string | undefined> = {
  VITE_WEATHER_API_KEY: import.meta.env.VITE_WEATHER_API_KEY,
  VITE_AI_API_KEY: import.meta.env.VITE_AI_API_KEY,
};

const missingRequired = Object.entries(REQUIRED_ENV_VARS)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const missingOptional = Object.entries(OPTIONAL_ENV_VARS)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingRequired.length > 0) {
  logger.error(
    `[Canopy] FATAL: Missing required environment variables: ${missingRequired.join(', ')}\n` +
    'The app will not function correctly. Check your .env file.'
  );
}

if (missingOptional.length > 0) {
  logger.warn(
    `[Canopy] Missing optional environment variables: ${missingOptional.join(', ')}\n` +
    'Some features (weather, AI assistant) may be unavailable.'
  );
}

// Initialize Google Analytics 4 (no-op if VITE_GA_MEASUREMENT_ID is not set)
initGA();

// Initialize Sentry error tracking (no-op if VITE_SENTRY_DSN is not set)
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <CookieConsent />
  </React.StrictMode>
);

// Remove splash loader after React mounts
const loader = document.getElementById('app-loader');
if (loader) {
  loader.classList.add('fade-out');
  setTimeout(() => loader.remove(), 300);
}

// ─── Register Service Worker for Web Push (production only) ───
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        logger.info('[Web Push] Service Worker registered successfully');
      })
      .catch((error) => {
        logger.warn('[Web Push] Service Worker registration failed:', error);
      });
  });
}
