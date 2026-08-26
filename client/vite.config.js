import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    // Source maps are uploaded for debugging but not referenced from the
    // bundle, so they cost nothing at runtime.
    sourcemap: 'hidden',
    cssCodeSplit: true,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // React changes a few times a year; my code changes daily. Splitting
        // them means a deploy only invalidates my chunk — the vendor chunk
        // stays in the returning visitor's cache.
        // Matching on the resolved module path rather than the package name:
        // `react-dom/client` is a subpath export and does not match a bare
        // 'react-dom' entry, which silently left react-dom in the app chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/]node_modules[\\/]zustand[\\/]/.test(id)) return 'state';
          return 'vendor';
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
