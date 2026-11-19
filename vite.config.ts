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
            // Every runtime dep of @react-three/fiber + drei must live here too; one left out lands in an app chunk and
            // forms a chunk cycle ("u is not a function" in prod). Re-check with scripts/check-chunk-cycles.mjs after upgrades.
            { name: 'twin-r3f', test: /node_modules[\\/](@react-three|three-stdlib|@babel[\\/]runtime|@dimforge|@mediapipe|@monogrid|@tweenjs|@use-gesture|base64-js|bidi-js|buffer|camera-controls|detect-gpu|draco3d|fflate|glsl-noise|hls\.js|ieee754|immediate|is-promise|its-fine|lie|maath|meshline|meshoptimizer|potpack|promise-worker-transferable|react-reconciler|react-use-measure|require-from-string|stats-gl|stats\.js|suspend-react|three-mesh-bvh|troika-[^\\/]+|tunnel-rat|utility-types|webgl-constants|webgl-sdf-generator|zustand)[\\/]/, priority: 20, includeDependenciesRecursively: false },
            // Core React & State Vendor (cached long-term by browsers); use-sync-external-store is shared by react-redux and r3f.
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-redux|redux|@reduxjs|scheduler|use-sync-external-store)[\\/]/, priority: 15 },
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
