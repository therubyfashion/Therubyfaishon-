import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_RAZORPAY_KEY_ID': JSON.stringify(env.VITE_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_ScBsqG0Z4iTmAG'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom']
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async', 'recharts', 'framer-motion', 'lucide-react', 'sonner'],
      exclude: ['swiper'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
