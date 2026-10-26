import type { ReactNode } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ApartmentPalette } from './apartmentPalette';

type Vec3 = [number, number, number];

type Palette = ApartmentPalette;
export function Block({ at, size, color, radius = .035, rotation = [0, 0, 0], metal = 0, children }: { at: Vec3; size: Vec3; color: string; radius?: number; rotation?: Vec3; metal?: number; children?: ReactNode }) {
  return <RoundedBox position={at} args={size} radius={Math.min(radius, ...size.map((v) => v / 3))} smoothness={2} rotation={rotation} castShadow receiveShadow>
    <meshStandardMaterial color={color} roughness={metal ? .35 : .82} metalness={metal} />{children}
  </RoundedBox>;
}
export function Cylinder({ at, radius, height, color, top }: { at: Vec3; radius: number; height: number; color: string; top?: number }) {
  return <mesh position={at} castShadow receiveShadow><cylinderGeometry args={[top ?? radius, radius, height, 32]} /><meshStandardMaterial color={color} roughness={.7} /></mesh>;
}
export function Plant({ at, p, scale = 1 }: { at: Vec3; p: Palette; scale?: number }) {
  return <group position={at} scale={scale}>
    <Cylinder at={[0, .23, 0]} radius={.24} top={.3} height={.46} color={p.wall} />
    <Cylinder at={[0, .48, 0]} radius={.25} height={.025} color={p.wood} />
    <Cylinder at={[0, .85, 0]} radius={.035} height={.8} color={p.wood} />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => <mesh key={i} position={[Math.sin(i * 2.4) * .2, .8 + i * .07, Math.cos(i * 2.4) * .2]} rotation={[.5, i * 2.4, .5]} scale={[.16, .4, .08]} castShadow><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={i % 2 ? p.leafDark : p.leaf} roughness={.9} /></mesh>)}
  </group>;
}
export function Sofa({ p }: { p: Palette }) {
  return <group>
    {[-1.25, 1.25].flatMap((x) => [-.46, .46].map((z) => <Cylinder key={`${x}:${z}`} at={[x, .16, z]} radius={.055} height={.3} color={p.wood} />))}
    <Block at={[0, .4, 0]} size={[3, .42, 1.25]} color={p.sofa} radius={.14} />
    <Block at={[0, .95, .49]} size={[3, .9, .27]} color={p.sofa} radius={.12} />
    {[-1.4, 1.4].map((x) => <Block key={x} at={[x, .72, 0]} size={[.26, .55, 1.3]} color={p.sofa} radius={.1} />)}
    {[-.88, 0, .88].map((x) => <group key={x}><Block at={[x, .66, -.07]} size={[.82, .22, .95]} color={p.fabric} radius={.1} /><Block at={[x, .98, .28]} size={[.8, .52, .25]} color={p.sofa} radius={.1} rotation={[-.16, 0, 0]} /></group>)}
    {[-1.02, 1.05].map((x) => <Block key={x} at={[x, 1, -.05]} size={[.46, .47, .15]} color={x < 0 ? p.cushion : p.wall} radius={.09} rotation={[-.2, 0, x < 0 ? .15 : -.15]} />)}
    <Block at={[.82, .79, -.45]} size={[.5, .045, .62]} color={p.rug} rotation={[.1, .1, 0]} />
  </group>;
}
export function LivingRoom({ p }: { p: Palette }) {
  return <group>
    <Block at={[-2.35, .025, .05]} size={[3.8, .04, 3.35]} color={p.rug} radius={.13} />
    {[-1, 1].map((i) => <Block key={i} at={[-2.35, .052, i * 1.48]} size={[3.6, .012, .025]} color={p.wall} />)}
    <group position={[-2.4, 0, 1.65]}><Sofa p={p} /></group>
    <group position={[-2.35, 0, -.25]}><CoffeeTable p={p} /></group>
    <group position={[-4, 0, -.85]} rotation={[0, .35, 0]}><Armchair p={p} /></group>
    <group position={[-2.5, 0, -2.95]}><TVBoard p={p} /></group>
    <Plant at={[-4.15, 0, -2.8]} p={p} scale={.8} />
    <Plant at={[-.45, 0, 2.65]} p={p} />
    <Block at={[-4.63, 1.8, -.2]} size={[.035, .85, 1.1]} color={p.wood} />
    <Block at={[-4.6, 1.8, -.2]} size={[.04, .72, .97]} color={p.wall} />
    <mesh position={[-4.57, 1.8, -.2]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[.23, 32]} /><meshStandardMaterial color={p.cushion} /></mesh>
  </group>;
}
export function Bedroom({ p }: { p: Palette }) {
  return <group>
    <Block at={[2.45, .024, -1.85]} size={[2.8, .04, 2.9]} color={p.cushion} radius={.1} />
    <group position={[2.45, 0, -1.85]}><Bed p={p} /></group>
    <Block at={[.97, .35, -2.8]} size={[.63, .65, .6]} color={p.woodLight} />
    <group position={[4.25, 0, -2.55]}><Wardrobe p={p} /></group>
    <Plant at={[4.13, 0, -.75]} p={p} scale={.65} />
  </group>;
}
export function Kitchen({ p }: { p: Palette }) {
  return <group>
    <group position={[2.8, 0, .25]}><KitchenUnit p={p} /></group>
    <group position={[2.75, 0, 2.05]}><DiningTable p={p} /></group>
    {[0, 1, 2].map((i) => <group key={i} position={[2.75 + Math.sin(i * Math.PI * 2 / 3) * 1.05, 0, 2.05 + Math.cos(i * Math.PI * 2 / 3) * 1.05]} rotation={[0, i * Math.PI * 2 / 3, 0]}>
      <DiningChair p={p} />
    </group>)}
    <Block at={[4.2, 1.75, -.14]} size={[.035, .58, .62]} color={p.wood} rotation={[0, -Math.PI / 2, 0]} />
  </group>;
}

export function Bed({ p }: { p: Palette }) {
  return <group position={[-2.45, 0, 1.85]}>
    <Block at={[2.45, .27, -1.9]} size={[2, .4, 2.5]} color={p.woodLight} radius={.07} />
    <Block at={[2.45, .53, -1.85]} size={[1.95, .28, 2.35]} color={p.surface} radius={.1} />
    <Block at={[2.45, .72, -3.1]} size={[2.12, 1.15, .16]} color={p.sofa} radius={.07} />
    <Block at={[2.45, .72, -1.4]} size={[1.98, .15, 1.4]} color={p.fabricAccent} radius={.07} />
    <Block at={[2.45, .81, -.98]} size={[1.99, .03, .45]} color={p.rug} />
    {[-.5, .5].map((x) => <Block key={x} at={[2.45 + x, .78, -2.65]} size={[.83, .18, .46]} color={p.wall} radius={.07} rotation={[.05, 0, x * .1]} />)}
  </group>;
}

export function CoffeeTable({ p }: { p: Palette }) {
  return <group position={[0, 0, 0]}>
      <Block at={[0, .5, 0]} size={[1.65, .12, .85]} color={p.woodLight} radius={.15} />
      {[-.6, .6].map((x) => <Block key={x} at={[x, .25, 0]} size={[.1, .5, .55]} color={p.wood} />)}
      <Block at={[-.35, .59, -.1]} size={[.45, .05, .32]} color={p.wall} rotation={[0, .18, 0]} />
      <Block at={[-.32, .63, -.1]} size={[.4, .025, .3]} color={p.sofa} rotation={[0, .08, 0]} />
      <Cylinder at={[.38, .64, .08]} radius={.1} height={.16} color={p.surface} />
      <Cylinder at={[.38, .73, .08]} radius={.075} height={.012} color={p.wood} />
    </group>;
}

export function KitchenUnit({ p }: { p: Palette }) {
  return <group position={[-2.8, 0, -.25]}>
    <Block at={[2.8, .5, .25]} size={[3.7, 1, .7]} color={p.sofa} />
    <Block at={[2.8, 1.04, .25]} size={[3.8, .09, .77]} color={p.wall} />
    {[1.25, 2, 2.8, 3.6, 4.35].map((x) => <group key={x}><Block at={[x, .5, .61]} size={[.66, .85, .025]} color={p.sofa} /><Block at={[x, .83, .64]} size={[.28, .025, .03]} color={p.brass} /></group>)}
    <Block at={[3.9, 1.095, .27]} size={[.8, .02, .5]} color={p.dark} />
    {[-.2, .2].flatMap((x) => [-.12, .12].map((z) => <mesh key={`${x}:${z}`} position={[3.9 + x, 1.11, .27 + z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.045, .07, 24]} /><meshStandardMaterial color={p.metal} /></mesh>))}
    <Block at={[1.65, 1.09, .27]} size={[.72, .025, .45]} color={p.metal} radius={.08} />
    <Block at={[1.65, 1.11, .27]} size={[.57, .025, .32]} color={p.dark} radius={.08} />
    <Cylinder at={[1.65, 1.27, .02]} radius={.025} height={.36} color={p.metal} />
    <Block at={[1.65, 1.45, .13]} size={[.045, .045, .25]} color={p.metal} />
  </group>;
}

export function Armchair({ p }: { p: Palette }) { return <group position={[0, 0, 0]}>
      <Block at={[0, .53, 0]} size={[.85, .3, .9]} color={p.cushion} radius={.1} />
      <Block at={[0, .95, -.32]} size={[.85, .7, .2]} color={p.cushion} radius={.1} />
      {[-.35, .35].map((x) => <Block key={x} at={[x, .4, 0]} size={[.08, .7, .8]} color={p.wood} />)}
    </group>; }

export function TVBoard({ p }: { p: Palette }) { return <group position={[2.5, 0, 2.95]}>
    <Block at={[-2.5, .3, -2.95]} size={[3.1, .5, .55]} color={p.woodLight} radius={.06} />
    {[-3.5, -2.5, -1.5].map((x) => <Block key={x} at={[x, .3, -2.66]} size={[.92, .4, .025]} color={p.wall} />)}
  </group>; }

export function Wardrobe({ p }: { p: Palette }) { return <group position={[-4.25, 0, 2.55]}>
    <Block at={[4.25, 1.1, -2.55]} size={[.7, 2.2, 1.3]} color={p.wall} radius={.03} />
    <Block at={[3.89, 1.1, -2.55]} size={[.025, 2.1, .025]} color={p.wood} />
    <Block at={[3.87, 1.2, -2.42]} size={[.03, .25, .035]} color={p.brass} />
  </group>; }

export function DiningTable({ p }: { p: Palette }) { return <group position={[-2.75, 0, -2.05]}>
    <Cylinder at={[2.75, .83, 2.05]} radius={.83} height={.11} color={p.woodLight} />
    <Cylinder at={[2.75, .4, 2.05]} radius={.13} height={.8} color={p.wood} />
    <Cylinder at={[2.75, .07, 2.05]} radius={.45} height={.08} color={p.wood} />
    <Plant at={[2.75, .9, 2.05]} p={p} scale={.25} />
  </group>; }

export function DiningChair({ p }: { p: Palette }) { return <group>
      <Block at={[0, .45, 0]} size={[.6, .12, .55]} color={p.wall} radius={.08} />
      <Block at={[0, .8, .22]} size={[.6, .6, .09]} color={p.wall} radius={.07} />
      {[-.22, .22].map((x) => <Block key={x} at={[x, .22, 0]} size={[.045, .45, .4]} color={p.wood} />)}
  </group>; }
