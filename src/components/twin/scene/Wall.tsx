import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import type { Group } from 'three';
import type { Ref } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Twin3DPalette } from '../twin3dPalette';
import type { TwinSceneObject } from '../twinDrafting';
import { wallSegments } from './wallGeometry';

export function Wall({ length, height, thickness, openings, palette, selected, x, z, rotation, ref, onClick }: {
  length: number; height: number; thickness: number; openings: { center: number; object: TwinSceneObject }[];
  palette: Twin3DPalette; selected: boolean; x: number; z: number; rotation: number;
  ref?: Ref<Group>; onClick: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const segments = useMemo(() => wallSegments(length, height, openings), [length, height, openings]);
  return <group ref={ref} position={[x, 0, z]} rotation={[0, rotation, 0]}>{segments.map((part, index) => <mesh key={index} castShadow receiveShadow onClick={onClick} position={[part.x, part.y, 0]}><boxGeometry args={[part.width, part.height, thickness]} /><meshStandardMaterial color={palette.wall} emissive={palette.primary} roughness={.82} /><Edges color={selected ? palette.primaryHover : palette.line} threshold={25} /></mesh>)}</group>;
}
