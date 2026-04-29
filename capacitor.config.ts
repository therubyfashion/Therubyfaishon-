import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theruby.app',
  appName: 'The Ruby',
  webDir: 'dist',
  server: {
    allowNavigation: [
      '*.firebaseapp.com',
      '*.googleapis.com',
      'accounts.google.com',
      'therubyfaishon.shop'
    ]
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '987019399933-uda5bcfbav0ag272b4r47rrn624gdkei.apps.googleusercontent.com',
      androidClientId: '987019399933-aourine4sa26kefv0k6jv5a0tfdqf05p.apps.googleusercontent.com',
      forceCodeForRefreshToken: false
    }
  }
};

export default config;
