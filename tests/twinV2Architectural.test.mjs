import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
function loadSource(path) {
  const filename = resolve(root, path);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  const sourceRequire = name => {
    if (!name.startsWith('.')) return require(name);
    const dependency = resolve(dirname(filename), name) + '.ts';
    assert.ok(existsSync(dependency));
    return loadSource(dependency);
  };
  new Function('require', 'module', 'exports', outputText)(sourceRequire, module, module.exports);
  return module.exports;
}

const { createOakFloorData } = loadSource('src/components/twin/v2/architecturalGeometry.ts');
const { pointInPolygon, polygonArea } = loadSource('src/components/twin/neonplan/model.ts');

function onBoundary(point, polygon) {
  return polygon.some((a, index) => {
    const b = polygon[(index + 1) % polygon.length], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz);
    return t >= -1e-5 && t <= 1 + 1e-5
      && Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz) < 1e-5;
  });
}

const fixtures = [
  { name: 'rectangle', points: [[0, 0], [6, 0], [6, 5], [0, 5]], holes: [] },
  { name: 'concave L', points: [[0, 0], [6, 0], [6, 2], [2, 2], [2, 5], [0, 5]], holes: [] },
  { name: 'concave U', points: [[0, 0], [6, 0], [6, 5], [4, 5], [4, 2], [2, 2], [2, 5], [0, 5]], holes: [] },
  { name: 'diagonal boundary', points: [[0, 0], [6, 0], [4.5, 4.8], [0, 5]], holes: [] },
  { name: 'stairwell', points: [[0, 0], [6, 0], [6, 5], [0, 5]], holes: [[[1.13, 1.03], [2.27, 1.03], [2.27, 3.54], [1.13, 3.54]]] },
  { name: 'clockwise room and hole', points: [[0, 5], [6, 5], [6, 0], [0, 0]], holes: [[[1, 1], [1, 3], [2, 3], [2, 1]]] },
];

for (const fixture of fixtures) test(`oak board geometry preserves ${fixture.name}`, () => {
  const floor = createOakFloorData([{ id: fixture.name, name: fixture.name, points: fixture.points, floor_material: 'wood' }], fixture.holes);
  const checkPoint = point => {
    assert.ok(pointInPolygon(point, fixture.points) || onBoundary(point, fixture.points), `Outside room: ${point}`);
    for (const hole of fixture.holes) assert.ok(!pointInPolygon(point, hole) || onBoundary(point, hole), `Inside stairwell: ${point}`);
  };
  let coveredArea = 0;
  try {
    assert.ok(floor.boards.length > 0, 'The reusable interior should use instancing');
    for (const board of floor.boards) {
      coveredArea += board.width * board.depth;
      for (const x of [-.5, 0, .5]) for (const z of [-.5, 0, .5]) checkPoint([board.x + x * board.width, board.z + z * board.depth]);
    }
    for (const geometry of floor.edges) {
      const position = geometry.getAttribute('position');
      for (let index = 0; index < position.count; index += 3) {
        const triangle = [0, 1, 2].map(offset => [position.getX(index + offset), position.getZ(index + offset)]);
        coveredArea += polygonArea(triangle);
        triangle.forEach(checkPoint);
        checkPoint([(triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3, (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3]);
      }
    }
    const area = polygonArea(fixture.points) - fixture.holes.reduce((sum, hole) => sum + polygonArea(hole), 0);
    assert.ok(coveredArea <= area + 1e-4, 'Wood must not fill outside the authored footprint');
    assert.ok(coveredArea >= area * .92, 'Only narrow physical joints may leave the original floor visible');
  } finally { floor.edges.forEach(geometry => geometry.dispose()); }
});

test('tile floors retain their own architectural material', () => {
  const floor = createOakFloorData([{ id: 'bathroom', name: 'Bathroom', points: fixtures[0].points, floor_material: 'tiles' }]);
  try {
    assert.equal(floor.boards.length, 0);
    assert.ok(floor.edges.every(geometry => geometry.getAttribute('position').count === 0));
  } finally { floor.edges.forEach(geometry => geometry.dispose()); }
});
