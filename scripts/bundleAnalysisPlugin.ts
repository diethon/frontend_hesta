import type { Plugin } from 'vite';

/** Dependency-free module/chunk analyzer; excludes dynamic edges from initial load. */
export function bundleAnalysisPlugin(): Plugin {
  return { name: 'hesta-bundle-analysis', generateBundle(_options, bundle) {
    const chunks = Object.values(bundle).filter((item) => item.type === 'chunk').map((chunk) => ({
      file: chunk.fileName, entry: chunk.isEntry, imports: chunk.imports, dynamicImports: chunk.dynamicImports,
      modules: Object.entries(chunk.modules).map(([id, info]) => ({ id: id.replaceAll('\\', '/').replace(/^.*\/node_modules\//, 'node_modules/').replace(/^.*\/src\//, 'src/'), bytes: info.renderedLength })),
    }));
    this.emitFile({ type: 'asset', fileName: 'bundle-analysis.json', source: JSON.stringify(chunks, null, 2) });
  } };
}
