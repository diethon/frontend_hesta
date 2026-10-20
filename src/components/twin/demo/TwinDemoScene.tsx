import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useCursor } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, Color, Group, MathUtils, MeshStandardMaterial, PointLight, Sprite, type SpriteMaterial } from 'three';
import { Block, Cylinder, LivingRoom, Bedroom, Kitchen } from '../interior/ApartmentInterior';
import { readApartmentPalette, type ApartmentPalette as Palette } from '../interior/apartmentPalette';
import { demoLightLevel, demoLights, type DemoLightColor, type DemoLightId, type TwinDemoState } from './twinDemoState';
import { ApartmentLighting } from '../interior/ApartmentLighting';

type Vec3 = [number, number, number];
interface SceneProps {
  state: TwinDemoState; daylight: boolean; reducedMotion: boolean; selected: DemoLightId | 'ac';
  onLight: (id: DemoLightId) => void; onAC: () => void; onReady: () => void;
}
const lightColors = (p: Palette): Record<DemoLightColor, string> => ({ warm: p.warm, cool: p.glass, mint: p.mint, rose: p.rose });

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
  const p = useMemo(() => readApartmentPalette(), []);
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [10.5, 10.5, 13], fov: 38, near: .1, far: 80 }} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => { gl.setClearColor(daylight ? p.infoSoft : p.night); onReady(); }} aria-label="Căn hộ 3D tương tác với đèn và điều hòa mô phỏng">
    <color attach="background" args={[daylight ? p.infoSoft : p.night]} />
    <ApartmentLighting palette={p} daylight={daylight} />
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
