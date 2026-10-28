import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: { manualChunks: id => /node_modules[\\/](three|three-stdlib|@react-three)[\\/]/.test(id) ? 'three-vendor' : undefined },
    },
  },
})
