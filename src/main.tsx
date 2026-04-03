import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
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
  console.error(
    `[Canopy] FATAL: Missing required environment variables: ${missingRequired.join(', ')}\n` +
    'The app will not function correctly. Check your .env file.'
  );
}

if (missingOptional.length > 0) {
  console.warn(
    `[Canopy] Missing optional environment variables: ${missingOptional.join(', ')}\n` +
    'Some features (weather, AI assistant) may be unavailable.'
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove splash loader after React mounts
const loader = document.getElementById('app-loader');
if (loader) {
  loader.classList.add('fade-out');
  setTimeout(() => loader.remove(), 300);
}
