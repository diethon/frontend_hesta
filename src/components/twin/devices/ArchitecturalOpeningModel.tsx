import { useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, type BufferGeometry, type Mesh } from 'three';
import { buildOpeningParts } from '../neonplan/viewer/openings';
import type { OpeningInfo } from '../neonplan/viewer/build';
import type { DeviceModelProps } from './models';
import { openingFraction } from './deviceVisualState';
import { useReducedMotion } from '../useTwinMotion';
import { TwinCutawayContext } from '../scene/TwinCutawayContext';
import { makeFoldable, type FoldMasks } from '../neonplan/viewer/fold';
import { themeMaterial } from '../scene/rendererTheme';

/** MIT opening geometry rebuilt for this moving device only; house topology is stable. */
export function ArchitecturalOpeningModel({ device, palette, opening, kind }: DeviceModelProps & { kind: 'door' | 'window' | 'blind' }) {
  const frames = useRef<Mesh>(null), glass = useRef<Mesh>(null), blinds = useRef<Mesh>(null);
  const context = useContext(TwinCutawayContext);
  const themeUniform = context?.themeUniform;
  const fallback = useMemo<FoldMasks>(() => ({ standing: { value: 0xffff }, glass: { value: 0 } }), []);
  const masks = context?.masks ?? fallback;
  const previousOpening = useRef<OpeningInfo | undefined>(undefined);
  const allocated = useRef<BufferGeometry[]>([]);
  const current = useRef({ open: 0, tilt: 0, cover: kind === 'blind' ? 1 : null as number | null });
  const invalidate = useThree((state) => state.invalidate), reduced = useReducedMotion();
  const desired = openingFraction(device), tilted = device.online && (device.state.tilt === true || device.state.state === 'TILTED');
  const info = useMemo<OpeningInfo>(() => ({ opening: { id: device.id, room_id: device.roomId ?? '', edge: 0, offset: 0, width: kind === 'door' ? .85 : 1.6, type: kind === 'door' ? 'door' : 'window', sill: kind === 'door' ? 0 : .65, height: kind === 'door' ? 2.05 : 1.4, hinge: 'left', swing: 'in', leaves: 1 }, bucket: -1, start: [kind === 'door' ? -.425 : -.8, 0], axis: [1, 0], width: kind === 'door' ? .85 : 1.6, toRoom: [0, 1], faceRoom: .08, faceOut: .08, sill: kind === 'door' ? 0 : .65, top: 2.05, hingeAtStart: true, exterior: false }), [device.id, device.roomId, kind]);
  const materials = useMemo(() => ({ frame: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .7 }), masks), glass: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, transparent: true, opacity: .25, depthWrite: false }), masks), blind: makeFoldable(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide }), masks) }), [masks]);
  useEffect(() => {
    if (themeUniform) Object.values(materials).forEach((material) => {
      themeMaterial(material, themeUniform);
      material.needsUpdate = true;
    });
  }, [materials, themeUniform]);
  const depth = useMemo(() => makeFoldable(new MeshDepthMaterial({ side: DoubleSide, depthPacking: RGBADepthPacking }), masks), [masks]);
  useEffect(() => { invalidate(); }, [desired, tilted, opening, invalidate]);
  useEffect(() => () => { Object.values(materials).forEach((m) => m.dispose()); }, [materials]);
  useEffect(() => () => { depth.dispose(); }, [depth]);
  useEffect(() => { const geometries = allocated.current; return () => { geometries.forEach((geometry) => geometry.dispose()); }; }, []);
  useFrame((_, delta) => {
    const state = current.current, blend = reduced ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 14);
    const target = kind === 'blind' ? 1 - desired : desired;
    const moving = Math.abs((kind === 'blind' ? state.cover ?? 1 : state.open) - target) > .001 || Math.abs(state.tilt - Number(tilted)) > .001;
    if (!moving && previousOpening.current === opening && frames.current?.geometry.getAttribute('position')) return;
    previousOpening.current = opening;
    state.open += ((kind === 'blind' ? 0 : desired) - state.open) * blend;
    state.tilt += (Number(tilted) - state.tilt) * blend;
    if (kind === 'blind') state.cover = (state.cover ?? 1) + (target - (state.cover ?? 1)) * blend;
    const effective = opening ?? info;
    const parts = buildOpeningParts([effective], new Map([[effective.opening.id, state]]), opening ? context?.cutHeight ?? 3 : 3);
    allocated.current.splice(0, allocated.current.length, parts.frames, parts.glass, parts.blinds);
    for (const [ref, geometry] of [[frames, parts.frames], [glass, parts.glass], [blinds, parts.blinds]] as const) { if (ref.current) { ref.current.geometry.dispose(); ref.current.geometry = geometry; } else geometry.dispose(); }
    if (moving) invalidate();
  });
  return <group><mesh ref={frames} material={materials.frame} customDepthMaterial={depth} material-color={device.online ? palette.surface : palette.off} castShadow receiveShadow /><mesh ref={glass} material={materials.glass} /><mesh ref={blinds} material={materials.blind} /></group>;
}
