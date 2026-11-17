import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Mesh, type MeshStandardMaterial, type Object3D } from 'three';

/** Files live in public/twin-models/; see docs/TWIN_MODELS.md for the naming contract. */
export const twinModelUrl = (name: string) => `${import.meta.env.BASE_URL}twin-models/${name}.glb`;

/**
 * Per-instance copy of a contract model. Materials are shared by name inside the copy and
 * recoloured from `colors` (material name → colour) so every source matches the HESTA palette.
 */
export function useTwinModel(name: string, colors: Record<string, string>) {
  const { scene } = useGLTF(twinModelUrl(name));
  const invalidate = useThree((state) => state.invalidate);
  const model = useMemo(() => {
    const root: Object3D = scene.clone(true);
    const materials = new Map<string, MeshStandardMaterial>();
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const source = child.material as MeshStandardMaterial;
      let material = materials.get(source.name);
      if (!material) {
        material = source.clone();
        materials.set(source.name, material);
      }
      child.material = material;
    });
    return { root, materials };
  }, [scene]);
  useEffect(() => () => model.materials.forEach((material) => material.dispose()), [model]);
  const colorKey = JSON.stringify(colors);
  useLayoutEffect(() => {
    const next = JSON.parse(colorKey) as Record<string, string>;
    model.materials.forEach((material, materialName) => { if (next[materialName]) material.color.set(next[materialName]); });
    invalidate();
  }, [model, colorKey, invalidate]);
  return model.root;
}
