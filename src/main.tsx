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

if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: '987019399933-uda5bcfbav0ag272b4r47rrn624gdkei.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);
