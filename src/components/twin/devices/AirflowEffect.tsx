import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, DataTexture, Group, LinearFilter, Sprite } from 'three';
import { useReducedMotion } from '../useTwinMotion';
import { useTwinResource } from '../hooks/useTwinResource';

function createMistMask() {
  const size = 32, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
    const offset = (y * size + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = 255;
    data[offset + 3] = Math.round(Math.max(0, 1 - distance) ** 2 * 255);
  }
  const texture = new DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
export function AirflowEffect({ active, color, speed = 1 }: { active: boolean; color: string; speed?: number }) {
  const mist = useRef<Group>(null), streaks = useRef<Group>(null), elapsed = useRef(0);
  const texture = useTwinResource('device-airflow-mask', createMistMask);
  const reduced = useReducedMotion(), invalidate = useThree((state) => state.invalidate);
  useEffect(() => { invalidate(); }, [active, reduced, speed, color, invalidate]);
  useFrame((_, delta) => {
    if (!active) return;
    if (!reduced) elapsed.current += Math.min(delta, .05) * speed;
    mist.current?.children.forEach((child, index) => {
      const progress = reduced ? (index + 1) / 21 : (elapsed.current * .35 + index * .618) % 1;
      child.position.set((index % 5 - 2) * .09 * (1 + progress), -.18 - progress * .55, .16 + progress * 1.85);
      child.scale.set(.15 + progress * .7, .12 + progress * .38, 1);
      if (child instanceof Sprite) child.material.opacity = Math.sin(progress * Math.PI) * .2;
    });
    streaks.current?.children.forEach((child, index) => {
      const progress = reduced ? .5 : (elapsed.current * .65 + index / 8) % 1;
      child.position.set((index % 4 - 1.5) * .16 * (1 + progress), -.18 - progress * .55, .16 + progress * 1.85);
      child.scale.setScalar(.2 + Math.sin(progress * Math.PI) * .65);
    });
    if (!reduced) invalidate();
  });
  if (!active) return null;
  return <group name="device-airflow" raycast={() => undefined}>
    <group ref={mist} name="device-cold-mist">{Array.from({ length: 20 }, (_, index) => <sprite key={index} raycast={() => undefined}><spriteMaterial map={texture} color={color} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} /></sprite>)}</group>
    <group ref={streaks}>{Array.from({ length: 8 }, (_, index) => <mesh key={index} rotation={[1.86, 0, 0]} raycast={() => undefined}><capsuleGeometry args={[.008, .2, 2, 6]} /><meshBasicMaterial color={color} transparent opacity={.35} depthWrite={false} blending={AdditiveBlending} /></mesh>)}</group>
  </group>;
}
