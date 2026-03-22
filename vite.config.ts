import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('phaser')) return 'phaser'
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'https://lys-267131866578.europe-west1.run.app',
        changeOrigin: true,
      },
    },
  },
})
