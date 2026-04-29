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
  }
};

export default config;
