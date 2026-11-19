// Fails when built JS chunks import each other in a cycle (breaks lazy chunks at runtime, e.g. "u is not a function").
// Usage: node scripts/check-chunk-cycles.mjs [dist/assets]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist/assets';
const graph = new Map();
for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(dir, file), 'utf8');
  graph.set(file, [...src.matchAll(/from"\.\/([^"]+\.js)"/g)].map((m) => m[1]));
}

const cycles = new Set();
const visit = (node, stack) => {
  for (const next of graph.get(node) ?? []) {
    const i = stack.indexOf(next);
    if (i >= 0) cycles.add([...stack.slice(i), next].join(' -> '));
    else visit(next, [...stack, next]);
  }
};
for (const node of graph.keys()) visit(node, [node]);

if (cycles.size) {
  console.error(`Chunk import cycles:\n${[...cycles].join('\n')}`);
  process.exit(1);
}
console.log(`No chunk import cycles in ${graph.size} chunks.`);
