import { memo, useContext, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Matrix4,
  MeshDepthMaterial, RGBADepthPacking, type InstancedMesh, type Mesh } from 'three';
import { pointInPolygon, type Room, type Vec2 } from '../neonplan/model';
import type { OpeningInfo } from '../neonplan/viewer/build';
import { makeFoldable } from '../neonplan/viewer/fold';
import { TwinCutawayContext } from '../scene/TwinCutawayContext';
import { themeMaterial } from '../scene/rendererTheme';
import { createOakFloorData, OAK_FLOOR_TOP } from './architecturalGeometry';
import { architecturalDetailPalette as colors } from './detailPalette';
import { SurfaceMaterial, type SurfaceKind } from './surfaces';

export interface ArchitecturalDetailsProps {
  rooms: readonly Room[];
  holes?: readonly (readonly Vec2[])[];
  /** Already resolved onto actual architecture walls. No extra windows are generated. */
  openings?: readonly OpeningInfo[];
}

const emptyHoles: readonly (readonly Vec2[])[] = [];
const emptyOpenings: readonly OpeningInfo[] = [];
const ignoreRaycast = () => undefined;

interface FinishBuffer { positions: number[]; normals: number[]; uvs: number[]; folds: number[] }
const finishBuffer = (): FinishBuffer => ({ positions: [], normals: [], uvs: [], folds: [] });

function finishGeometry(buffer: FinishBuffer) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffer.positions, 3));
  if (buffer.normals.length === buffer.positions.length) geometry.setAttribute('normal', new Float32BufferAttribute(buffer.normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(buffer.uvs, 2));
  geometry.setAttribute('fold', new Float32BufferAttribute(buffer.folds, 1));
  if (buffer.positions.length) { geometry.computeBoundingBox(); geometry.computeBoundingSphere(); }
  return geometry;
}

function appendOpeningBox(buffer: FinishBuffer, box: BufferGeometry, info: OpeningInfo,
  x: number, y: number, n: number, width: number, height: number, depth: number, fold: number) {
  const position = box.getAttribute('position'), normal = box.getAttribute('normal'), uv = box.getAttribute('uv');
  for (let index = 0; index < position.count; index++) {
    const mirrored = info.axis[0] * info.toRoom[1] - info.axis[1] * info.toRoom[0] < 0;
    const source = mirrored ? index % 3 === 1 ? index + 1 : index % 3 === 2 ? index - 1 : index : index;
    const along = x + position.getX(source) * width, inward = n + position.getZ(source) * depth;
    buffer.positions.push(info.start[0] + info.axis[0] * along + info.toRoom[0] * inward,
      y + position.getY(source) * height, info.start[1] + info.axis[1] * along + info.toRoom[1] * inward);
    buffer.normals.push(info.axis[0] * normal.getX(source) + info.toRoom[0] * normal.getZ(source),
      normal.getY(source), info.axis[1] * normal.getX(source) + info.toRoom[1] * normal.getZ(source));
    buffer.uvs.push(uv.getX(source), uv.getY(source));
    buffer.folds.push(fold);
  }
}

function appendCurtain(buffer: FinishBuffer, info: OpeningInfo, center: number, width: number, top: number) {
  const rows = 14, columns = 32, bottom = .095, height = top - bottom;
  const vertex = (column: number, row: number) => {
    const u = column / columns, v = row / rows;
    const along = center + (u - .5) * width;
    const fold = Math.sin(u * Math.PI * 10) * .034 * (1 + v * .12);
    const inward = info.faceRoom + .12 + fold;
    const y = top - v * height + Math.sin(u * Math.PI * 10) * .007 * v * v;
    return { position: [info.start[0] + info.axis[0] * along + info.toRoom[0] * inward,
      y, info.start[1] + info.axis[1] * along + info.toRoom[1] * inward], u, v };
  };
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = vertex(column, row), b = vertex(column + 1, row), c = vertex(column + 1, row + 1), d = vertex(column, row + 1);
      for (const point of [a, b, c, a, c, d]) {
        buffer.positions.push(...point.position);
        buffer.uvs.push(point.u, point.v);
        // The entire textile follows its host wall, including shadow rendering.
        buffer.folds.push(info.bucket);
      }
    }
  }
}

function buildWindowFinishes(rooms: readonly Room[], openings: readonly OpeningInfo[], cutHeight: number) {
  const curtains = finishBuffer(), sills = finishBuffer(), rods = finishBuffer();
  const indexedBox = new BoxGeometry();
  const box = indexedBox.toNonIndexed();
  indexedBox.dispose();
  for (const info of openings) {
    if (info.opening.type !== 'window' || !info.exterior || info.width < .55) continue;
    const room = rooms.find(item => item.id === info.opening.room_id);
    if (!room || room.points.length < 3) continue;
    const wallHeight = room.wall_heights?.[info.opening.edge] ?? Math.max(2.5, info.top + .25);
    const top = Math.min(info.top + .13, wallHeight - .08);
    const width = Math.min(.53, Math.max(.22, info.width * .2));
    if (top < .9 || info.top - info.sill < .35) continue;
    // Long curtains belong to dry living spaces. A real bathroom opening still gets its sill.
    const textile = !['tiles', 'concrete', 'stone'].includes(room.floor_material.toLowerCase());
    if (textile) {
      for (const center of [width / 2 + .025, info.width - width / 2 - .025]) {
        const corners: Vec2[] = [center - width / 2, center + width / 2].flatMap(along => [.075, .17].map(inset =>
          [info.start[0] + info.axis[0] * along + info.toRoom[0] * (info.faceRoom + inset),
            info.start[1] + info.axis[1] * along + info.toRoom[1] * (info.faceRoom + inset)] as Vec2));
        if (corners.every(point => pointInPolygon(point, room.points))) appendCurtain(curtains, info, center, width, top);
      }
      appendOpeningBox(rods, box, info, info.width / 2, top + .025, info.faceRoom + .12, info.width + .06, .025, .025, info.bucket);
    }
    appendOpeningBox(sills, box, info, info.width / 2, info.sill + .018, info.faceRoom + .085,
      info.width + .09, .036, .235, info.sill + .036 <= cutHeight ? 32 + info.bucket : info.bucket);
  }
  box.dispose();
  const curtainGeometry = finishGeometry(curtains);
  curtainGeometry.computeVertexNormals();
  return { curtains: curtainGeometry, sills: finishGeometry(sills), rods: finishGeometry(rods) };
}

/** Apply existing GPU wall masks; no per-frame React work and no floating cutaway curtains. */
function FinishMesh({ geometry, color, kind, shadow = false }: {
  geometry: BufferGeometry; color: string; kind: SurfaceKind; shadow?: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const cutaway = useContext(TwinCutawayContext);
  const invalidate = useThree(state => state.invalidate);
  const depth = useMemo(() => {
    const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
    return cutaway ? makeFoldable(material, cutaway.masks, 'solid') : material;
  }, [cutaway]);
  useEffect(() => () => depth.dispose(), [depth]);
  useEffect(() => {
    if (!mesh.current || !cutaway) return;
    const materials = Array.isArray(mesh.current.material) ? mesh.current.material : [mesh.current.material];
    for (const material of materials) {
      if (material.userData.twinFoldMasks !== cutaway.masks) makeFoldable(material, cutaway.masks, 'solid');
      themeMaterial(material, cutaway.themeUniform);
      if (kind === 'fabric') { material.side = DoubleSide; }
      material.needsUpdate = true;
    }
    invalidate();
  }, [cutaway, kind, invalidate]);
  return geometry.getAttribute('position').count ? <mesh ref={mesh} geometry={geometry} customDepthMaterial={depth}
    castShadow={shadow} receiveShadow raycast={ignoreRaycast}>
    <SurfaceMaterial kind={kind} color={color} roughness={kind === 'fabric' ? .96 : undefined} />
  </mesh> : null;
}

export const ArchitecturalDetails = memo(function ArchitecturalDetails({ rooms, holes = emptyHoles, openings = emptyOpenings }: ArchitecturalDetailsProps) {
  const floor = useMemo(() => createOakFloorData(rooms, holes), [rooms, holes]);
  const cutaway = useContext(TwinCutawayContext);
  const finishes = useMemo(() => buildWindowFinishes(rooms, openings, cutaway?.cutHeight ?? .85), [rooms, openings, cutaway?.cutHeight]);
  const instances = useRef<InstancedMesh>(null);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => () => { floor.edges.forEach(geometry => geometry.dispose()); }, [floor]);
  useEffect(() => () => { Object.values(finishes).forEach(geometry => geometry.dispose()); }, [finishes]);
  useEffect(() => {
    const mesh = instances.current;
    if (!mesh) return;
    const matrix = new Matrix4(), color = new Color();
    floor.boards.forEach((board, index) => {
      matrix.makeScale(board.width, OAK_FLOOR_TOP, board.depth);
      matrix.setPosition(board.x, OAK_FLOOR_TOP / 2, board.z);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(board.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    invalidate();
  }, [floor, invalidate]);
  return <group name="v2-architectural-details">
    {floor.boards.length ? <instancedMesh key={floor.boards.length} name="v2-oak-boards" ref={instances}
      args={[undefined, undefined, floor.boards.length]} receiveShadow raycast={ignoreRaycast}>
      <boxGeometry />
      <SurfaceMaterial kind="wood" color={colors.neutral} roughness={.62} />
    </instancedMesh> : null}
    {floor.edges.map((geometry, index) => geometry.getAttribute('position').count ? <mesh key={index}
      name="v2-oak-perimeter" geometry={geometry} receiveShadow raycast={ignoreRaycast}>
      <SurfaceMaterial kind="wood" color={colors.oakBoards[index]} roughness={.62} />
    </mesh> : null)}
    <FinishMesh geometry={finishes.curtains} color={colors.curtain} kind="fabric" shadow />
    <FinishMesh geometry={finishes.sills} color={colors.sill} kind="wood" />
    <FinishMesh geometry={finishes.rods} color={colors.rod} kind="wood" />
  </group>;
});
