import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  base: '/LoomLarge/', // GitHub Pages repo name
  plugins: [
    react(),
    {
      name: 'exclude-large-assets',
      writeBundle() {
        // Remove large GLB file from dist after build (hosted externally)
        const filePath = path.join(process.cwd(), 'dist', 'characters', 'jonathan.glb');
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Removed large GLB file from dist (hosted via GitHub Release)');
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { open: true },
});
