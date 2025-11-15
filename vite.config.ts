import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/LoomLarge/' : '/', // GitHub Pages repo name for production only
  plugins: [
    react(),
    // Exclude large uncompressed GLB from production build
    mode === 'production' && {
      name: 'exclude-large-glb',
      writeBundle() {
        const glbPath = path.join(process.cwd(), 'dist', 'characters', 'jonathan.glb');
        if (fs.existsSync(glbPath)) {
          fs.unlinkSync(glbPath);
          console.log('Removed jonathan.glb from dist (over 100MB limit)');
        }
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-core',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-backend-cpu',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow-models/blazeface',
      '@tensorflow-models/facemesh',
    ],
  },
  build: {
    sourcemap: true,
  },
  server: {
    open: true,
  },
}));
