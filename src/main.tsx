import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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
