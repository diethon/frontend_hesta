import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { bundleAnalysisPlugin } from './scripts/bundleAnalysisPlugin.js';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), bundleAnalysisPlugin()],
  server: { watch: { ignored: ['**/.tmp/**'] } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Async engine groups cannot include general app vendors (would eagerly load Three).
            { name: 'twin-three', test: /node_modules[\\/]three[\\/]/, priority: 30, includeDependenciesRecursively: false },
            { name: 'twin-r3f', test: /node_modules[\\/](@react-three|three-stdlib)[\\/]/, priority: 20, includeDependenciesRecursively: false },
            // Core React & State Vendor (cached long-term by browsers)
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-redux|redux|@reduxjs|scheduler)[\\/]/, priority: 15 },
            // UI Animation & Helpers
            { name: 'vendor-motion', test: /node_modules[\\/](framer-)?motion[\\/]/, priority: 10 },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 10 },
            { name: 'vendor-stomp', test: /node_modules[\\/]@stomp[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
