import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

// Suppress recharts legacy defaultProps warnings in React 18+
// This is a known issue in the library that doesn't affect functionality
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('Support for defaultProps will be removed from function components')) {
    return;
  }
  originalError.call(console, ...args);
};

// Register Service Worker for PWA (Install Prompt)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: '987019399933-uda5bcfbav0ag272b4r47rrn624gdkei.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}

// Global fetch interceptor to support relative /api paths on native platforms and local hosts
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const origin = window.location.origin;
      let baseUrl = origin;
      if (
        origin.includes('localhost') || 
        origin.startsWith('capacitor://') || 
        origin.startsWith('http://localhost')
      ) {
        baseUrl = 'https://therubyfashion.shop';
      }
      // Ensure no double slashes when joining base URL and api path
      input = `${baseUrl.replace(/\/$/, '')}${input}`;
    }
    return originalFetch.call(this, input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
