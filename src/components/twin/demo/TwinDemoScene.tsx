import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox, useCursor } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, Color, Group, MathUtils, MeshStandardMaterial, PointLight, Sprite, type SpriteMaterial } from 'three';
import { readTwin3DPalette } from '../twin3dPalette';
import { demoLightLevel, demoLights, type DemoLightColor, type DemoLightId, type TwinDemoState } from './twinDemoState';

type Vec3 = [number, number, number];
interface SceneProps {
  state: TwinDemoState; daylight: boolean; reducedMotion: boolean; selected: DemoLightId | 'ac';
  onLight: (id: DemoLightId) => void; onAC: () => void; onReady: () => void;
}
function readPalette() {
  const p = readTwin3DPalette();
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string) => styles.getPropertyValue(`--color-twin-demo-${name}`).trim();
  return { ...p, wall: get('wall'), floor: get('floor'), sofa: get('sofa'), cushion: get('cushion'), rug: get('rug'), brass: get('brass'), night: get('night'), warm: get('warm'), rose: styles.getPropertyValue('--color-error').trim() };
}
type Palette = ReturnType<typeof readPalette>;
const lightColors = (p: Palette): Record<DemoLightColor, string> => ({ warm: p.warm, cool: p.glass, mint: p.mint, rose: p.rose });

function Block({ at, size, color, radius = .035, rotation = [0, 0, 0], metal = 0, children }: { at: Vec3; size: Vec3; color: string; radius?: number; rotation?: Vec3; metal?: number; children?: ReactNode }) {
  return <RoundedBox position={at} args={size} radius={Math.min(radius, ...size.map((v) => v / 3))} smoothness={2} rotation={rotation} castShadow receiveShadow>
    <meshStandardMaterial color={color} roughness={metal ? .35 : .82} metalness={metal} />{children}
  </RoundedBox>;
}
function Cylinder({ at, radius, height, color, top }: { at: Vec3; radius: number; height: number; color: string; top?: number }) {
  return <mesh position={at} castShadow receiveShadow><cylinderGeometry args={[top ?? radius, radius, height, 32]} /><meshStandardMaterial color={color} roughness={.7} /></mesh>;
}
function Plant({ at, p, scale = 1 }: { at: Vec3; p: Palette; scale?: number }) {
  return <group position={at} scale={scale}>
    <Cylinder at={[0, .23, 0]} radius={.24} top={.3} height={.46} color={p.wall} />
    <Cylinder at={[0, .48, 0]} radius={.25} height={.025} color={p.wood} />
    <Cylinder at={[0, .85, 0]} radius={.035} height={.8} color={p.wood} />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => <mesh key={i} position={[Math.sin(i * 2.4) * .2, .8 + i * .07, Math.cos(i * 2.4) * .2]} rotation={[.5, i * 2.4, .5]} scale={[.16, .4, .08]} castShadow><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={i % 2 ? p.leafDark : p.leaf} roughness={.9} /></mesh>)}
  </group>;
}
function Sofa({ p }: { p: Palette }) {
  return <group position={[-2.4, 0, 1.65]}>
    {[-1.25, 1.25].flatMap((x) => [-.46, .46].map((z) => <Cylinder key={`${x}:${z}`} at={[x, .16, z]} radius={.055} height={.3} color={p.wood} />))}
    <Block at={[0, .4, 0]} size={[3, .42, 1.25]} color={p.sofa} radius={.14} />
    <Block at={[0, .95, .49]} size={[3, .9, .27]} color={p.sofa} radius={.12} />
    {[-1.4, 1.4].map((x) => <Block key={x} at={[x, .72, 0]} size={[.26, .55, 1.3]} color={p.sofa} radius={.1} />)}
    {[-.88, 0, .88].map((x) => <group key={x}><Block at={[x, .66, -.07]} size={[.82, .22, .95]} color={p.fabric} radius={.1} /><Block at={[x, .98, .28]} size={[.8, .52, .25]} color={p.sofa} radius={.1} rotation={[-.16, 0, 0]} /></group>)}
    {[-1.02, 1.05].map((x) => <Block key={x} at={[x, 1, -.05]} size={[.46, .47, .15]} color={x < 0 ? p.cushion : p.wall} radius={.09} rotation={[-.2, 0, x < 0 ? .15 : -.15]} />)}
    <Block at={[.82, .79, -.45]} size={[.5, .045, .62]} color={p.rug} rotation={[.1, .1, 0]} />
  </group>;
}
function LivingRoom({ p }: { p: Palette }) {
  return <group>
    <Block at={[-2.35, .025, .05]} size={[3.8, .04, 3.35]} color={p.rug} radius={.13} />
    {[-1, 1].map((i) => <Block key={i} at={[-2.35, .052, i * 1.48]} size={[3.6, .012, .025]} color={p.wall} />)}
    <Sofa p={p} />
    <group position={[-2.35, 0, -.25]}>
      <Block at={[0, .5, 0]} size={[1.65, .12, .85]} color={p.woodLight} radius={.15} />
      {[-.6, .6].map((x) => <Block key={x} at={[x, .25, 0]} size={[.1, .5, .55]} color={p.wood} />)}
      <Block at={[-.35, .59, -.1]} size={[.45, .05, .32]} color={p.wall} rotation={[0, .18, 0]} />
      <Block at={[-.32, .63, -.1]} size={[.4, .025, .3]} color={p.sofa} rotation={[0, .08, 0]} />
      <Cylinder at={[.38, .64, .08]} radius={.1} height={.16} color={p.surface} />
      <Cylinder at={[.38, .73, .08]} radius={.075} height={.012} color={p.wood} />
    </group>
    <group position={[-4, 0, -.85]} rotation={[0, .35, 0]}>
      <Block at={[0, .53, 0]} size={[.85, .3, .9]} color={p.cushion} radius={.1} />
      <Block at={[0, .95, -.32]} size={[.85, .7, .2]} color={p.cushion} radius={.1} />
      {[-.35, .35].map((x) => <Block key={x} at={[x, .4, 0]} size={[.08, .7, .8]} color={p.wood} />)}
    </group>
    <Block at={[-2.5, .3, -2.95]} size={[3.1, .5, .55]} color={p.woodLight} radius={.06} />
    {[-3.5, -2.5, -1.5].map((x) => <Block key={x} at={[x, .3, -2.66]} size={[.92, .4, .025]} color={p.wall} />)}
    <Plant at={[-4.15, 0, -2.8]} p={p} scale={.8} />
    <Plant at={[-.45, 0, 2.65]} p={p} />
    <Block at={[-4.63, 1.8, -.2]} size={[.035, .85, 1.1]} color={p.wood} />
    <Block at={[-4.6, 1.8, -.2]} size={[.04, .72, .97]} color={p.wall} />
    <mesh position={[-4.57, 1.8, -.2]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[.23, 32]} /><meshStandardMaterial color={p.cushion} /></mesh>
  </group>;
}
function Bedroom({ p }: { p: Palette }) {
  return <group>
    <Block at={[2.45, .024, -1.85]} size={[2.8, .04, 2.9]} color={p.cushion} radius={.1} />
    <Block at={[2.45, .27, -1.9]} size={[2, .4, 2.5]} color={p.woodLight} radius={.07} />
    <Block at={[2.45, .53, -1.85]} size={[1.95, .28, 2.35]} color={p.surface} radius={.1} />
    <Block at={[2.45, .72, -3.1]} size={[2.12, 1.15, .16]} color={p.sofa} radius={.07} />
    <Block at={[2.45, .72, -1.4]} size={[1.98, .15, 1.4]} color={p.fabricAccent} radius={.07} />
    <Block at={[2.45, .81, -.98]} size={[1.99, .03, .45]} color={p.rug} />
    {[-.5, .5].map((x) => <Block key={x} at={[2.45 + x, .78, -2.65]} size={[.83, .18, .46]} color={p.wall} radius={.07} rotation={[.05, 0, x * .1]} />)}
    <Block at={[.97, .35, -2.8]} size={[.63, .65, .6]} color={p.woodLight} />
    <Block at={[4.25, 1.1, -2.55]} size={[.7, 2.2, 1.3]} color={p.wall} radius={.03} />
    <Block at={[3.89, 1.1, -2.55]} size={[.025, 2.1, .025]} color={p.wood} />
    <Block at={[3.87, 1.2, -2.42]} size={[.03, .25, .035]} color={p.brass} />
    <Plant at={[4.13, 0, -.75]} p={p} scale={.65} />
  </group>;
}
function Kitchen({ p }: { p: Palette }) {
  return <group>
    <Block at={[2.8, .5, .25]} size={[3.7, 1, .7]} color={p.sofa} />
    <Block at={[2.8, 1.04, .25]} size={[3.8, .09, .77]} color={p.wall} />
    {[1.25, 2, 2.8, 3.6, 4.35].map((x) => <group key={x}><Block at={[x, .5, .61]} size={[.66, .85, .025]} color={p.sofa} /><Block at={[x, .83, .64]} size={[.28, .025, .03]} color={p.brass} /></group>)}
    <Block at={[3.9, 1.095, .27]} size={[.8, .02, .5]} color={p.dark} />
    {[-.2, .2].flatMap((x) => [-.12, .12].map((z) => <mesh key={`${x}:${z}`} position={[3.9 + x, 1.11, .27 + z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.045, .07, 24]} /><meshStandardMaterial color={p.metal} /></mesh>))}
    <Block at={[1.65, 1.09, .27]} size={[.72, .025, .45]} color={p.metal} radius={.08} />
    <Block at={[1.65, 1.11, .27]} size={[.57, .025, .32]} color={p.dark} radius={.08} />
    <Cylinder at={[1.65, 1.27, .02]} radius={.025} height={.36} color={p.metal} />
    <Block at={[1.65, 1.45, .13]} size={[.045, .045, .25]} color={p.metal} />
    <Cylinder at={[2.75, .83, 2.05]} radius={.83} height={.11} color={p.woodLight} />
    <Cylinder at={[2.75, .4, 2.05]} radius={.13} height={.8} color={p.wood} />
    <Cylinder at={[2.75, .07, 2.05]} radius={.45} height={.08} color={p.wood} />
    {[0, 1, 2].map((i) => <group key={i} position={[2.75 + Math.sin(i * Math.PI * 2 / 3) * 1.05, 0, 2.05 + Math.cos(i * Math.PI * 2 / 3) * 1.05]} rotation={[0, i * Math.PI * 2 / 3, 0]}>
      <Block at={[0, .45, 0]} size={[.6, .12, .55]} color={p.wall} radius={.08} />
      <Block at={[0, .8, .22]} size={[.6, .6, .09]} color={p.wall} radius={.07} />
      {[-.22, .22].map((x) => <Block key={x} at={[x, .22, 0]} size={[.045, .45, .4]} color={p.wood} />)}
    </group>)}
    <Plant at={[2.75, .9, 2.05]} p={p} scale={.25} />
    <Block at={[4.2, 1.75, -.14]} size={[.035, .58, .62]} color={p.wood} rotation={[0, -Math.PI / 2, 0]} />
  </group>;
}
function Architecture({ p }: { p: Palette }) {
  return <group>
    <Block at={[0, -.25, 0]} size={[10, .42, 7.5]} color={p.wall} radius={.12} />
    <Block at={[0, -.48, 0]} size={[9.65, .12, 7.15]} color={p.wood} radius={.08} />
    {Array.from({ length: 46 }, (_, i) => <Block key={i} at={[-4.7 + i % 23 * .416, -.018, i < 23 ? -1.75 : 1.75]} size={[.408, .055, 3.48]} color={i % 4 === 0 ? p.woodLight : p.floor} radius={.005} />)}
    <Block at={[0, 1.3, -3.55]} size={[9.7, 2.6, .15]} color={p.wall} />
    <Block at={[-4.83, 1.3, -1.8]} size={[.15, 2.6, 3.5]} color={p.wall} />
    <Block at={[-4.83, .3, 1.78]} size={[.15, .6, 3.65]} color={p.wall} />
    <Block at={[4.83, .3, 0]} size={[.15, .6, 7.2]} color={p.wall} />
    <Block at={[0, .1, 3.55]} size={[9.7, .2, .15]} color={p.wall} />
    <Block at={[.42, .42, -2.1]} size={[.14, .84, 2.8]} color={p.wall} />
    <Block at={[.42, .42, 2.8]} size={[.14, .84, 1.4]} color={p.wall} />
    <Block at={[2.65, .38, -.3]} size={[4.3, .76, .14]} color={p.wall} />
    <Block at={[0, .08, -3.44]} size={[9.4, .12, .035]} color={p.surface} />
    <Block at={[.3, 1.52, -3.44]} size={[.45, .9, .035]} color={p.wood} />
    <Block at={[.3, 1.52, -3.41]} size={[.37, .8, .035]} color={p.cushion} />
    <Block at={[2.4, 1.75, -3.45]} size={[1.7, .75, .04]} color={p.glass} />
    {[-.83, 0, .83].map((x) => <Block key={x} at={[2.4 + x, 1.75, -3.4]} size={[.045, .81, .035]} color={p.surface} />)}
    <Block at={[2.4, 1.34, -3.34]} size={[1.85, .06, .18]} color={p.surface} />
    <Block at={[1.4, 1.8, -3.28]} size={[.25, 1.35, .1]} color={p.wall} />
    <Block at={[3.42, 1.8, -3.28]} size={[.25, 1.35, .1]} color={p.wall} />
  </group>;
}
function Interactive({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onClick(); };
  return <group onClick={click} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>{children}</group>;
}
function FitApartment() {
  const { camera, size } = useThree();
  useEffect(() => {
    const factor = Math.max(1, 1.15 / (size.width / Math.max(1, size.height)));
    camera.position.set(10.5 * factor, 10.5 * factor, 13 * factor);
    camera.lookAt(0, .3, 0);
  }, [camera, size.width, size.height]);
  return null;
}
const fixturePositions: Record<DemoLightId, Vec3> = { ceiling: [-2.35, 2.3, -.15], floor: [-4.12, 1.75, 2.7], tv: [-2.5, 1.4, -3.25], bedroom: [.97, 1.1, -2.8], kitchen: [2.75, 2.1, 2.05] };

function LightFixture({ id, state, p, selected, onClick, reducedMotion }: { id: DemoLightId; state: TwinDemoState; p: Palette; selected: boolean; onClick: () => void; reducedMotion: boolean }) {
  const light = state.lights[id];
  const level = demoLightLevel(light);
  const bulb = useRef<MeshStandardMaterial>(null);
  const source = useRef<PointLight>(null);
  const color = lightColors(p)[light.color];
  const targetColor = useMemo(() => new Color(color), [color]);
  useFrame((_, delta) => {
    if (source.current) { source.current.intensity = reducedMotion ? level * 15 : MathUtils.damp(source.current.intensity, level * 15, 8, delta); source.current.color.lerp(targetColor, reducedMotion ? 1 : 1 - Math.exp(-8 * delta)); }
    if (bulb.current) { bulb.current.emissiveIntensity = reducedMotion ? level * 3 : MathUtils.damp(bulb.current.emissiveIntensity, level * 3, 8, delta); bulb.current.emissive.lerp(targetColor, reducedMotion ? 1 : 1 - Math.exp(-8 * delta)); }
  });
  const at = fixturePositions[id];
  const label = demoLights.find((item) => item.id === id)!.name;
  return <group position={at} name={`demo-light-${id}`} userData={{ on: light.on, brightness: light.brightness, color: light.color }}>
    <Interactive onClick={onClick}>
      {id === 'tv' ? <>
        <Block at={[0, 0, 0]} size={[2.15, 1.22, .1]} color={p.dark} radius={.04} />
        <mesh position={[0, 0, .057]}><planeGeometry args={[2.02, 1.1]} /><meshStandardMaterial color={p.sofa} emissive={p.glass} emissiveIntensity={.15 + level * .35} roughness={.3} /></mesh>
        <mesh position={[0, 0, -.06]}><boxGeometry args={[2.2, 1.25, .03]} /><meshStandardMaterial ref={bulb} color={color} emissive={color} toneMapped={false} /></mesh>
      </> : <>
        {id === 'ceiling' || id === 'kitchen' ? <>
          <Cylinder at={[0, .18, 0]} radius={.018} height={.6} color={p.brass} />
          <Cylinder at={[0, .48, 0]} radius={.12} height={.05} color={p.brass} />
        </> : <>
          <Cylinder at={[0, -at[1] / 2, 0]} radius={id === 'floor' ? .025 : .035} height={id === 'floor' ? at[1] : .45} color={p.brass} />
          <Cylinder at={[0, id === 'floor' ? -at[1] + .07 : -.4, 0]} radius={id === 'floor' ? .25 : .15} height={.07} color={p.brass} />
        </>}
        <mesh castShadow><cylinderGeometry args={[id === 'bedroom' ? .15 : .24, id === 'bedroom' ? .23 : .4, .3, 40, 1, true]} /><meshStandardMaterial color={p.wall} roughness={.7} side={2} /></mesh>
        <mesh position={[0, -.13, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[id === 'bedroom' ? .22 : .39, 40]} /><meshStandardMaterial ref={bulb} color={p.wall} emissive={color} toneMapped={false} side={2} /></mesh>
      </>}
      <mesh visible={false}><sphereGeometry args={[.45, 12, 12]} /><meshBasicMaterial /></mesh>
    </Interactive>
    <pointLight ref={source} position={id === 'tv' ? [0, 0, -.13] : [0, -.25, 0]} color={color} intensity={level * 15} distance={id === 'tv' ? 4 : 6} decay={2} />
    {id === 'tv' ? <pointLight position={[0, .2, .2]} color={color} intensity={level * 3} distance={4} decay={2} /> : null}
    <Html position={[0, id === 'floor' ? .35 : .25, .1]} center distanceFactor={15} zIndexRange={[20, 0]}>
      <button type="button" aria-label={`Bật/tắt ${label} trên mô hình`} aria-pressed={light.on} onClick={onClick} className={`twin-demo-hotspot ${selected ? 'is-selected' : ''} ${light.on && light.brightness > 0 ? 'is-on' : ''}`}><span className="twin-demo-hotspot-dot" /><span className="twin-demo-hotspot-label">{label}</span></button>
    </Html>
  </group>;
}
function AirConditioner({ state, p, reducedMotion, selected, onClick }: { state: TwinDemoState; p: Palette; reducedMotion: boolean; selected: boolean; onClick: () => void }) {
  const stream = useRef<Group>(null);
  const mist = useRef<Group>(null);
  const flap = useRef<Group>(null);
  const active = state.ac.on;
  const flowColor = state.ac.mode === 'dry' ? p.mint : p.primary;
  const speed = state.ac.fan === 'high' ? 1.5 : state.ac.fan === 'low' ? .6 : 1;
  const mistTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, p.surface);
    gradient.addColorStop(.25, p.glass);
    gradient.addColorStop(1, 'transparent');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, [p]);
  useEffect(() => () => mistTexture.dispose(), [mistTexture]);
  useFrame(({ clock }) => {
    if (flap.current) flap.current.rotation.x = active ? -.45 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * .7) * .08) : 0;
    if (stream.current) stream.current.children.forEach((child, index) => {
      const progress = reducedMotion ? .4 : ((clock.elapsedTime * speed * .6 + index / 12) % 1);
      child.position.set((index % 4 - 1.5) * .18 * (1 + progress), -.25 - progress * .7, .08 + progress * 2.4);
      child.scale.setScalar(Math.sin(progress * Math.PI) * .7 + .3);
    });
    if (mist.current) mist.current.children.forEach((child, index) => {
      const progress = reducedMotion ? (index + 1) / 29 : (clock.elapsedTime * speed * .3 + index * .618) % 1;
      child.position.set((index % 5 - 2) * .12 * (1 + progress * 1.7) + Math.sin(progress * 8 + index) * .035,
        -.2 - progress * .7, .08 + progress * 2.6);
      child.scale.set(.18 + progress * .85, .14 + progress * .46, 1);
      if (child instanceof Sprite) (child.material as SpriteMaterial).opacity = Math.sin(progress * Math.PI) * (state.ac.fan === 'high' ? .24 : .16);
    });
  });
  return <group position={[-.95, 2.12, -3.29]} name="demo-ac" userData={{ ...state.ac }}>
    <Interactive onClick={onClick}>
      <Block at={[0, 0, 0]} size={[1.42, .45, .32]} color={p.surface} radius={.08} />
      <Block at={[0, -.13, .17]} size={[1.2, .065, .025]} color={p.dark} radius={.01} />
      <group ref={flap} position={[0, -.14, .18]}><Block at={[0, 0, .02]} size={[1.22, .045, .12]} color={p.wall} radius={.01} /></group>
      <Block at={[.48, .01, .165]} size={[.035, .035, .008]} color={active ? p.mint : p.off} radius={.005} />
      <Html position={[.2, .04, .18]} transform distanceFactor={4} zIndexRange={[10, 0]}><span className="pointer-events-none text-[8px] font-semibold text-muted">{active ? `${state.ac.temperature}°` : '—'}</span></Html>
    </Interactive>
    {active ? <>
      <group ref={stream} name="demo-ac-airflow">{Array.from({ length: 12 }, (_, i) => <mesh key={i} rotation={[1.88, 0, 0]}><capsuleGeometry args={[.009, .24, 2, 6]} /><meshBasicMaterial color={flowColor} transparent opacity={.4} depthWrite={false} blending={AdditiveBlending} /></mesh>)}</group>
      <group ref={mist} name="demo-ac-mist">{Array.from({ length: 28 }, (_, i) => <sprite key={i}><spriteMaterial map={mistTexture} color={flowColor} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} /></sprite>)}</group>
    </> : null}
    <Html position={[0, .45, .2]} center distanceFactor={15} zIndexRange={[20, 0]}><button type="button" aria-label="Chọn điều hòa trên mô hình" onClick={onClick} className={`twin-demo-hotspot ${selected ? 'is-selected' : ''} ${active ? 'is-on' : ''}`}><span className="twin-demo-hotspot-dot" /><span className="twin-demo-hotspot-label">Điều hòa · {active ? `${state.ac.temperature}°` : 'Tắt'}</span></button></Html>
  </group>;
}
export default function TwinDemoScene({ state, daylight, reducedMotion, selected, onLight, onAC, onReady }: SceneProps) {
  const p = useMemo(() => readPalette(), []);
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [10.5, 10.5, 13], fov: 38, near: .1, far: 80 }} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => { gl.setClearColor(daylight ? p.infoSoft : p.night); onReady(); }} aria-label="Căn hộ 3D tương tác với đèn và điều hòa mô phỏng">
    <color attach="background" args={[daylight ? p.infoSoft : p.night]} />
    <ambientLight intensity={daylight ? .8 : .17} color={p.glass} />
    <hemisphereLight args={[p.surface, p.floor, daylight ? 1.1 : .35]} />
    <directionalLight position={[-3, 9, 5]} intensity={daylight ? 2.2 : .45} color={p.warm} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-normalBias={.04} />
    <directionalLight position={[7, 4, -5]} intensity={daylight ? .7 : .35} color={p.glass} />
    <group position={[0, -.1, 0]}>
      <Architecture p={p} /><LivingRoom p={p} /><Bedroom p={p} /><Kitchen p={p} />
      {demoLights.map(({ id }) => <LightFixture key={id} id={id} state={state} p={p} selected={selected === id} onClick={() => onLight(id)} reducedMotion={reducedMotion} />)}
      <AirConditioner state={state} p={p} selected={selected === 'ac'} reducedMotion={reducedMotion} onClick={onAC} />
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.7, 0]} receiveShadow><planeGeometry args={[200, 200]} /><shadowMaterial transparent opacity={.18} /></mesh>
    <FitApartment />
    <OrbitControls makeDefault target={[0, .3, 0]} enablePan={false} minDistance={10} maxDistance={42} minPolarAngle={.4} maxPolarAngle={Math.PI / 2.4} enableDamping={!reducedMotion} />
  </Canvas>;
}
