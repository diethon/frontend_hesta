import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { bundleAnalysisPlugin } from './scripts/bundleAnalysisPlugin.js';
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), bundleAnalysisPlugin()],
  server: { watch: { ignored: ['**/.tmp/**'] } },
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    // Async engine groups cannot include general app vendors (would eagerly load Three).
    { name:'twin-three',test:/node_modules[\\/]three[\\/]/,priority:30,includeDependenciesRecursively:false },
    { name:'twin-r3f',test:/node_modules[\\/](@react-three|three-stdlib)[\\/]/,priority:20,includeDependenciesRecursively:false },
  ] } } } },
});
