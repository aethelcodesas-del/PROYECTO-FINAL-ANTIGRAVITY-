import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      minify: 'esbuild',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalizedId)) return 'vendor-react';
            if (normalizedId.includes('/node_modules/@supabase/')) return 'vendor-supabase';
            if (normalizedId.includes('/node_modules/@firebase/')) {
              const firebasePackage = normalizedId.split('/node_modules/@firebase/')[1]?.split('/')[0] || 'core';
              return `vendor-firebase-${firebasePackage}`;
            }
            if (normalizedId.includes('/node_modules/firebase/')) return 'vendor-firebase-entry';
            if (normalizedId.includes('/node_modules/recharts/') || normalizedId.includes('/node_modules/d3-')) return 'vendor-charts';
            if (normalizedId.includes('/node_modules/jspdf/')) return 'vendor-pdf';
            if (normalizedId.includes('/node_modules/html2canvas/')) return 'vendor-canvas';
            if (normalizedId.includes('/node_modules/xlsx/')) return 'vendor-excel';
            if (normalizedId.includes('/node_modules/leaflet/') || normalizedId.includes('/node_modules/react-leaflet/')) return 'vendor-maps';
            if (normalizedId.includes('/node_modules/lucide-react/')) return 'vendor-icons';
            if (normalizedId.includes('/node_modules/motion/')) return 'vendor-motion';
            return undefined;
          },
        },
      },
    },
  };
});
