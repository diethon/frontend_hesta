import { memo, useEffect, useMemo, useRef } from 'react'
import { MeshReflectorMaterial, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Group, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector2, Vector3, type InstancedMesh, type Mesh } from 'three'
import { palette } from './materials'
import { SurfaceMaterial, type SurfaceKind } from './surfaces'
type V3 = [number, number, number]
interface BlockProps { position: V3; size: V3; color?: string; rotation?: V3; rounded?: boolean; roughness?: number; surface?: SurfaceKind }
function inferSurface(color: string): SurfaceKind {
  if ([palette.oak, palette.oakLight, palette.oakDark].includes(color)) return 'wood'
  if ([palette.fabric, palette.cushion, palette.sage].includes(color)) return 'fabric'
  if ([palette.wall, palette.wallEdge].includes(color)) return 'plaster'
  if (color === palette.metal) return 'metal'
  return 'matte'
}
export function Block({ position, size, color = palette.white, rotation, rounded = false, roughness, surface }: BlockProps) {
  const material = <SurfaceMaterial kind={surface ?? inferSurface(color)} color={color} roughness={roughness} />
  return rounded ? <RoundedBox args={size} radius={Math.min(.11, Math.min(...size) * .36)} smoothness={3} position={position} rotation={rotation} castShadow={surface !== 'glass'} receiveShadow>{material}</RoundedBox>
    : <mesh position={position} rotation={rotation} castShadow={surface !== 'glass'} receiveShadow><boxGeometry args={size} />{material}</mesh>
}
function Cylinder({ position, radius, height, color = palette.oak, top, surface, rotation }: { position: V3; radius: number; height: number; color?: string; top?: number; surface?: SurfaceKind; rotation?: V3 }) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[top ?? radius, radius, height, 32]} /><SurfaceMaterial kind={surface ?? inferSurface(color)} color={color} /></mesh>
}
function Rod({ from, to, radius = .018, color = palette.metal }: { from: V3; to: V3; radius?: number; color?: string }) {
  const shape = useMemo(() => { const a = new Vector3(...from); const b = new Vector3(...to); return { position: a.clone().add(b).multiplyScalar(.5), quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()), length: a.distanceTo(b) } }, [from, to])
  return <mesh position={shape.position} quaternion={shape.quaternion} castShadow><cylinderGeometry args={[radius, radius, shape.length, 10]} /><SurfaceMaterial kind={color === palette.metal ? 'metal' : 'matte'} color={color} /></mesh>
}
function Pipe({ points, radius = .006, color = palette.cushion, surface = 'fabric' }: { points: V3[]; radius?: number; color?: string; surface?: SurfaceKind }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(point => new Vector3(...point))), [points])
  return <mesh castShadow><tubeGeometry args={[curve, Math.max(16, points.length * 4), radius, 6, false]} /><SurfaceMaterial kind={surface} color={color} /></mesh>
}
function Ceramic({ profile, position, scale = [1, 1, 1], color = palette.white, surface = 'ceramic' }: { profile: [number, number][]; position: V3; scale?: V3; color?: string; surface?: SurfaceKind }) {
  const points = useMemo(() => profile.map(([radius, y]) => new Vector2(radius, y)), [profile])
  return <mesh position={position} scale={scale} castShadow receiveShadow><latheGeometry args={[points, 48]} /><SurfaceMaterial kind={surface} color={color} /></mesh>
}
function Cloth({ width, depth, color, position, drape = false, rotation, surface = 'fabric' }: { width: number; depth: number; color: string; position: V3; drape?: boolean; rotation?: V3; surface?: SurfaceKind }) {
  const mesh = useRef<Mesh>(null)
  useEffect(() => { const material = mesh.current?.material; if (material instanceof MeshStandardMaterial) { material.side = DoubleSide; material.needsUpdate = true } }, [color])
  const geometry = useMemo(() => {
    const result = new PlaneGeometry(width, depth, 36, 32)
    result.rotateX(-Math.PI / 2)
    const vertices = result.attributes.position
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i); const z = vertices.getZ(i)
      const edge = drape ? Math.pow(Math.max(0, (Math.abs(x) / (width / 2) - .79) / .21), 1.4) * .29 : 0
      const foot = drape ? Math.pow(Math.max(0, (z / (depth / 2) - .76) / .24), 1.2) * .29 : 0
      const fold = Math.sin(x * 18 + z * 4) * .013 + Math.sin(x * 7 - z * 9) * .017 + Math.cos(x * 24 + z * 11) * .006
      vertices.setY(i, fold - Math.max(edge, foot))
    }
    result.computeVertexNormals()
    return result
  }, [width, depth, drape])
  return <mesh ref={mesh} geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow><SurfaceMaterial kind={surface} color={color} /></mesh>
}
function Pillow({ position, size = [.55, .5, .19], color = palette.cushion, rotation = [0, 0, 0] }: { position: V3; size?: V3; color?: string; rotation?: V3 }) {
  const [w, h, d] = size
  const geometry = useMemo(() => {
    const result = new SphereGeometry(1, 28, 20); const vertices = result.attributes.position
    for (let i = 0; i < vertices.count; i++) {
      const values = [vertices.getX(i), vertices.getY(i), vertices.getZ(i)]
      vertices.setXYZ(i, Math.sign(values[0]) * Math.pow(Math.abs(values[0]), .5) * w / 2, Math.sign(values[1]) * Math.pow(Math.abs(values[1]), .5) * h / 2, Math.sign(values[2]) * Math.pow(Math.abs(values[2]), .72) * d / 2)
    }
    result.computeVertexNormals(); return result
  }, [w, h, d])
  return <group position={position} rotation={rotation}><mesh geometry={geometry} castShadow receiveShadow><SurfaceMaterial kind="fabric" color={color} /></mesh><Pipe color={color} radius={.004} points={[[-w * .42, -h * .42, d * .04], [w * .42, -h * .42, d * .04], [w * .49, -h * .26, d * .04], [w * .42, h * .42, d * .04], [-w * .42, h * .42, d * .04], [-w * .49, h * .25, d * .04], [-w * .42, -h * .42, d * .04]]} /></group>
}
function makeLeaf() {
  const vertices: number[] = []; const uvs: number[] = []; const indices: number[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12; const width = Math.pow(Math.sin(t * Math.PI), .85) * .15
    for (let side = 0; side < 3; side++) { vertices.push((side - 1) * width, t * .67, Math.sin(t * Math.PI) * .1 - Math.abs(side - 1) * width * .28); uvs.push(side / 2, t) }
    if (i < 12) for (let side = 0; side < 2; side++) { const a = i * 3 + side; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4) }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3)); geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry
}
export const Plant = memo(function Plant({ position, scale = 1 }: { position: V3; scale?: number }) {
  const leaf = useMemo(() => makeLeaf(), [])
  return <group position={position} scale={scale}>
    <Ceramic profile={[[0, 0], [.18, 0], [.2, .04], [.25, .38], [.255, .43], [.225, .43], [.21, .36], [0, .36]]} position={[0, 0, 0]} color="#dcd7c9" />
    <Cylinder position={[0, .38, 0]} radius={.218} height={.018} color="#514436" surface="matte" />
    {Array.from({ length: 9 }, (_, i) => <group key={i} rotation={[0, i * 2.4, 0]}><Rod from={[0, .38, 0]} to={[.09 + (i % 3) * .035, .65 + (i % 4) * .11, 0]} radius={.009} color={palette.leaf} /><mesh geometry={leaf} position={[.09 + (i % 3) * .035, .63 + (i % 4) * .11, 0]} rotation={[.08, 0, -.22 - (i % 3) * .27]} scale={[.8 + (i % 3) * .13, .7 + (i % 4) * .1, 1]} castShadow receiveShadow><meshStandardMaterial color={i % 3 ? palette.leaf : palette.leafLight} roughness={.66} side={DoubleSide} /></mesh></group>)}
  </group>
})
function Vase({ position, color = palette.terracotta }: { position: V3; color?: string }) {
  return <group position={position}><Ceramic profile={[[0, 0], [.075, 0], [.12, .07], [.12, .16], [.06, .25], [.055, .32], [.04, .32], [.04, .25]]} position={[0, 0, 0]} color={color} /><Rod from={[0, .27, 0]} to={[.02, .57, -.03]} radius={.005} color={palette.leaf} /><mesh position={[.07, .51, -.03]} rotation={[.2, 0, -.6]} scale={[.045, .13, .013]}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={palette.leaf} roughness={.7} /></mesh></group>
}
export const Sofa = memo(function Sofa({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    {[-1.15, 1.15].flatMap(x => [-.42, .42].map(z => <Block key={`${x}-${z}`} position={[x, .13, z]} size={[.09, .22, .09]} color={palette.oakDark} />))}
    <Block position={[0, .36, 0]} size={[2.9, .38, 1.13]} color={palette.fabric} rounded />
    <Block position={[0, .77, -.48]} size={[2.9, .69, .24]} color={palette.fabric} rounded />
    {[-1.38, 1.38].map(x => <Block key={x} position={[x, .64, 0]} size={[.28, .65, 1.2]} color={palette.fabric} rounded />)}
    {[-.86, 0, .86].map(x => <group key={x}><Pillow position={[x, .61, .06]} size={[.82, .94, .24]} rotation={[-Math.PI / 2, 0, 0]} /><Pillow position={[x, .93, -.31]} size={[.83, .61, .25]} rotation={[-.14, 0, 0]} color={palette.fabric} /></group>)}
    <Pillow position={[-.98, .98, -.02]} color={palette.sage} rotation={[.12, -.08, -.17]} />
    <Pillow position={[.94, .97, -.03]} color="#bea58b" rotation={[.1, .08, .18]} />
    <Cloth position={[1.32, 1.01, .03]} width={.64} depth={1.18} color="#a6b1a2" drape />
    <Pipe color="#d0cfc4" points={[[-1.2, .44, .575], [0, .44, .575], [1.2, .44, .575]]} radius={.007} />
  </group>
})
export const CoffeeTable = memo(function CoffeeTable({ position }: { position: V3 }) {
  return <group position={position}><Cylinder position={[0, .43, 0]} radius={.7} height={.09} color={palette.oakLight} />{[0, 1, 2].map(i => <group rotation={[0, i * Math.PI * 2 / 3, 0]} key={i}><Block position={[.4, .22, 0]} size={[.07, .42, .07]} color={palette.oakDark} rotation={[0, 0, -.15]} /></group>)}<Block position={[-.12, .49, .02]} size={[.35, .022, .24]} color={palette.sage} /><Block position={[-.12, .505, .02]} size={[.326, .015, .221]} color="#e8e3d5" /><Block position={[-.12, .518, .02]} size={[.35, .009, .24]} color={palette.sage} /><Block position={[-.1, .537, .02]} size={[.3, .024, .21]} color="#c2b297" rotation={[0, .1, 0]} /><Vase position={[.3, .48, -.15]} /><Cylinder position={[-.28, .485, .32]} radius={.1} height={.008} color={palette.oakDark} /><Mug position={[-.28, .491, .32]} /><Block position={[.19, .487, .36]} size={[.07, .025, .19]} color={palette.dark} rounded /></group>
})
export const Television = memo(function Television({ position, on }: { position: V3; on: boolean }) {
  return <group position={position} rotation={[0, Math.PI / 2, 0]}>
    <Block position={[0, .33, 0]} size={[2.5, .54, .48]} color={palette.oakLight} rounded />
    {Array.from({ length: 26 }, (_, i) => <Block key={i} position={[-1.18 + i * .094, .34, .251]} size={[.018, .39, .018]} color={palette.oakDark} />)}
    {[-.92, .92].map(x => <Rod key={x} from={[x, .04, -.14]} to={[x, .15, -.14]} radius={.025} color={palette.dark} />)}
    <Block position={[0, 1.16, -.05]} size={[1.9, 1.09, .08]} color={palette.dark} rounded />
    <mesh position={[0, 1.16, .003]}><planeGeometry args={[1.79, .98]} /><meshStandardMaterial color={on ? '#99c8c6' : palette.screen} emissive={on ? '#4d929a' : '#000000'} emissiveIntensity={on ? .6 : 0} roughness={.3} /></mesh>
    <Block position={[0, .64, .015]} size={[.5, .055, .16]} color={palette.dark} />
  </group>
})
function TableLamp({ position }: { position: V3 }) {
  return <group position={position}>
    <Ceramic position={[0, 0, 0]} profile={[[0, 0], [.12, 0], [.13, .025], [.08, .06], [.065, .17], [.04, .23]]} color="#c4b599" />
    <Cylinder position={[0, .25, 0]} radius={.012} height={.15} color={palette.metal} />
    <mesh position={[0, .38, 0]} castShadow><cylinderGeometry args={[.15, .22, .26, 32, 1, true]} /><meshStandardMaterial color={palette.cushion} roughness={.92} side={DoubleSide} /></mesh>
    <mesh position={[0, .255, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.208, .22, 32]} /><SurfaceMaterial kind="fabric" color="#d7ccba" /></mesh>
    <mesh position={[0, .508, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.14, .15, 32]} /><SurfaceMaterial kind="fabric" color="#d7ccba" /></mesh>
  </group>
}
export const Bed = memo(function Bed({ accent = '#a5b8ae' }: { accent?: string }) {
  return <group position={[-3.8, 0, -3.1]}>
    <Block position={[0, .27, .02]} size={[2.35, .38, 2.8]} color={palette.oak} rounded />
    <Block position={[0, .55, 0]} size={[2.2, .38, 2.65]} color={palette.white} surface="fabric" rounded />
    <Block position={[0, .8, -1.35]} size={[2.5, 1.3, .19]} color={palette.fabric} rounded />
    {Array.from({ length: 7 }, (_, i) => <Block key={i} position={[-1.02 + i * .34, .89, -1.235]} size={[.32, 1.1, .11]} color={palette.fabric} rounded />)}
    <Pipe color="#e5e2d8" radius={.008} points={[[-1.03, .67, -1.25], [1.03, .67, -1.25], [1.1, .67, -1.14], [1.1, .67, 1.19], [1.02, .67, 1.31], [-1.03, .67, 1.31], [-1.1, .67, 1.17], [-1.1, .67, -1.16], [-1.03, .67, -1.25]]} />
    <Cloth position={[0, .84, .42]} width={2.48} depth={2.12} color={accent} drape />
    <Cloth position={[0, .865, -.48]} width={2.19} depth={.34} color={palette.white} />
    <Cloth position={[0, .875, .98]} width={2.17} depth={.43} color="#e7dfce" />
    {[-.55, .55].map(x => <group key={x}><Pillow position={[x, .87, -.95]} size={[.96, .58, .25]} color={palette.white} rotation={[-Math.PI / 2 + .1, 0, 0]} /><Pillow position={[x, .985, -.64]} size={[.78, .46, .23]} color={palette.cushion} rotation={[-Math.PI / 2 + .22, 0, 0]} /></group>)}
    <Pillow position={[0, 1.0, -.36]} size={[.61, .3, .18]} color="#b9a184" rotation={[-.95, 0, 0]} />
    {[-1.67, 1.67].map(x => <group key={x}><Block position={[x, .39, -.98]} size={[.57, .67, .57]} color={palette.oakLight} rounded />{[.28, .53].map(y => <group key={y}><Block position={[x, y, -.686]} size={[.49, .21, .025]} color={palette.oakLight} /><Rod from={[x - .09, y + .03, -.665]} to={[x + .09, y + .03, -.665]} radius={.008} color={palette.oakDark} /></group>)}{x > 0 ? <TableLamp position={[x, .735, -.98]} /> : null}</group>)}
  </group>
})
function Chair({ position, rotation = 0, color = palette.sage }: { position: V3; rotation?: number; color?: string }) {
  return <group position={position} rotation={[0, rotation, 0]}><Pillow position={[0, .51, 0]} size={[.56, .57, .14]} color={color} rotation={[-Math.PI / 2, 0, 0]} /><Pillow position={[0, .86, -.24]} size={[.57, .6, .14]} color={color} rotation={[-.12, 0, 0]} />{[-.21, .21].flatMap(x => [-.2, .2].map(z => <Rod key={`${x}-${z}`} from={[x * 1.15, .045, z * 1.15]} to={[x, .49, z]} radius={.026} color={palette.oakDark} />))}</group>
}
function Mug({ position, color = palette.cushion }: { position: V3; color?: string }) {
  return <group position={position}><Ceramic position={[0, 0, 0]} color={color} profile={[[0, 0], [.055, 0], [.067, .03], [.069, .13], [.06, .135], [.057, .03], [0, .025]]} /><mesh position={[.07, .075, 0]} rotation={[0, Math.PI / 2, 0]} castShadow><torusGeometry args={[.038, .009, 8, 16]} /><SurfaceMaterial kind="ceramic" color={color} /></mesh><Cylinder position={[0, .108, 0]} radius={.055} height={.003} color="#5e4534" surface="matte" /></group>
}
function Glass({ position }: { position: V3 }) {
  return <Ceramic position={position} surface="glass" color="#e3eeea" profile={[[0, 0], [.052, 0], [.057, .015], [.064, .15], [.058, .15], [.049, .025], [0, .025]]} />
}
function PlaceSetting({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Cylinder position={[0, .005, 0]} radius={.22} height={.008} color="#b9ad94" surface="fabric" />
    <Ceramic position={[0, .011, 0]} profile={[[0, 0], [.1, 0], [.15, .008], [.185, .026], [.182, .035], [.14, .019], [0, .015]]} />
    <Block position={[0, .04, .015]} size={[.12, .015, .17]} color="#d6d8c9" surface="fabric" rounded />
    <Rod from={[-.235, .025, -.08]} to={[-.235, .025, .09]} radius={.006} />
    <Rod from={[.235, .025, -.08]} to={[.235, .025, .09]} radius={.005} />
    <Block position={[.235, .029, -.065]} size={[.026, .007, .07]} color={palette.metal} surface="metal" rounded />
    <Glass position={[.19, .014, -.16]} />
  </group>
}
export const Kitchen = memo(function Kitchen() {
  return <group>
    <group position={[3.25, 0, .16]}>
      <Block position={[0, .48, -.3]} size={[3.9, .9, .04]} color="#aab7a1" />
      <Block position={[0, .13, 0]} size={[3.9, .12, .58]} color="#75836c" />
      {[-1.95, 1.95].map(x => <Block key={x} position={[x, .48, 0]} size={[.035, .88, .65]} color="#b1c0ac" />)}
      <Block position={[-.74, .96, 0]} size={[2.52, .09, .73]} color="#ece9dd" surface="stone" />
      <Block position={[1.66, .96, 0]} size={[.68, .09, .73]} color="#ece9dd" surface="stone" />
      {[-.302, .302].map(z => <Block key={z} position={[.92, .96, z]} size={[.8, .09, .126]} color="#ece9dd" surface="stone" />)}
      <Block position={[0, 1.17, -.29]} size={[3.93, .33, .025]} color="#e1ded1" surface="stone" />
      {Array.from({ length: 10 }, (_, i) => <Block key={i} position={[-1.8 + i * .4, 1.17, -.272]} size={[.009, .3, .004]} color="#c7c5b9" />)}
      <Block position={[0, 1.17, -.27]} size={[3.92, .009, .005]} color="#c7c5b9" />
      {[-1.5, -.75, 0, .75, 1.5].map((x, index) => <group key={x}>{(index < 2 ? [.33, .65, .84] : [.53]).map((y, i) => <group key={y}><Block position={[x, y, .334]} size={[.72, index < 2 ? i === 2 ? .14 : .28 : .7, .035]} color="#a7b59f" /><Rod from={[x - .12, index < 2 ? y + .04 : .78, .365]} to={[x + .12, index < 2 ? y + .04 : .78, .365]} radius={.009} color={palette.metal} /></group>)}</group>)}
      <Block position={[-1.1, 1.012, 0]} size={[.82, .025, .47]} color={palette.dark} rounded />
      {[-1.3, -.93].flatMap(x => [-.13, .13].map(z => <mesh key={`${x}-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 1.03, z]}><ringGeometry args={[.075, .085, 24]} /><SurfaceMaterial kind="metal" color={palette.metal} /></mesh>))}
      <Cylinder position={[-1.3, 1.12, -.13]} radius={.135} height={.18} color={palette.metal} /><Cylinder position={[-1.3, 1.22, -.13]} radius={.142} height={.024} color={palette.metal} /><Cylinder position={[-1.3, 1.25, -.13]} radius={.035} height={.035} color={palette.dark} surface="matte" />
      {[-1.49, -1.11].map(x => <group key={x}><Rod from={[x, 1.16, -.2]} to={[x, 1.16, -.06]} radius={.014} color={palette.dark} /><Rod from={[x, 1.16, -.13]} to={[x < -1.3 ? -1.42 : -1.18, 1.16, -.13]} radius={.013} color={palette.dark} /></group>)}
      <Block position={[-1.1, 1.92, -.08]} size={[1.04, .085, .62]} color={palette.metal} surface="metal" rounded /><Block position={[-1.1, 2.17, -.2]} size={[.34, .46, .28]} color={palette.metal} surface="metal" />
      <Block position={[-1.1, 1.868, -.08]} size={[.7, .015, .32]} color={palette.dark} />
      <Ceramic position={[.92, .815, 0]} scale={[1.28, 1, .84]} color="#a4afab" surface="metal" profile={[[0, 0], [.16, 0], [.23, .035], [.28, .18], [.285, .202], [.256, .202], [.215, .045], [0, .035]]} />
      <Pipe points={[[1.1, 1.01, -.21], [1.1, 1.34, -.21], [1.03, 1.42, -.18], [.95, 1.4, -.09], [.95, 1.32, -.02]]} radius={.018} color={palette.metal} surface="metal" />
      <Rod from={[1.2, 1.05, -.2]} to={[1.2, 1.15, -.16]} radius={.014} />
      <Block position={[-.1, 1.019, .07]} size={[.44, .027, .32]} color={palette.oakLight} rounded /><Cylinder position={[-.1, 1.037, .08]} radius={.11} height={.018} color="#b86c42" surface="matte" />
      <Block position={[.08, 1.045, .09]} size={[.18, .012, .025]} color={palette.metal} surface="metal" rotation={[0, .35, 0]} />
      <Vase position={[1.7, 1.015, 0]} />
    </group>
    <Block position={[5.35, 1.1, .2]} size={[.8, 2.1, .8]} color="#d5dedb" rounded /><Block position={[5.35, 1.22, .612]} size={[.74, .025, .02]} color={palette.metal} /><Rod from={[5.06, 1.36, .645]} to={[5.06, 1.74, .645]} radius={.018} /><Rod from={[5.06, .68, .645]} to={[5.06, .98, .645]} radius={.018} />
    <group position={[3.15, 0, 2.55]}>
      <Block position={[0, .84, 0]} size={[2.45, .12, 1.1]} color={palette.oakLight} rounded />
      {[-.94, .94].flatMap(x => [-.33, .33].map(z => <Block key={`${x}-${z}`} position={[x, .42, z]} size={[.08, .82, .08]} color={palette.oak} />))}
      {[-.7, .7].map(x => <group key={x}><Chair position={[x, 0, -.95]} /><Chair position={[x, 0, .95]} rotation={Math.PI} /></group>)}
      <Vase position={[0, .91, 0]} color={palette.white} />
      {[-.7, .7].flatMap(x => [-.29, .29].map(z => <PlaceSetting key={`${x}-${z}`} position={[x, .906, z]} rotation={z > 0 ? 0 : Math.PI} />))}
    </group>
  </group>
})
export const Bathroom = memo(function Bathroom({ detailed = false }: { detailed?: boolean }) {
  return <group>
    {/* One continuous lathed shell creates a real open oval tub, including the
        inner wall, rounded rim and recessed floor. */}
    <Ceramic position={[-.18, .14, -3.92]} scale={[.85, 1, 1.25]} profile={[[0, 0], [.34, 0], [.47, .05], [.58, .18], [.67, .49], [.7, .62], [.685, .665], [.65, .68], [.61, .64], [.57, .49], [.48, .23], [.34, .17], [0, .17]]} />
    <mesh position={[-.18, .64, -3.92]} rotation={[-Math.PI / 2, 0, 0]} scale={[.85, 1.25, 1]}><circleGeometry args={[.525, 48]} /><meshPhysicalMaterial color="#b7d5d1" roughness={.12} transparent opacity={.45} metalness={.05} clearcoat={.9} /></mesh>
    <Cylinder position={[.59, .17, -4.45]} radius={.085} height={.045} color={palette.metal} /><Pipe points={[[.59, .17, -4.45], [.59, .92, -4.45], [.52, 1.04, -4.43], [.31, 1.04, -4.4], [.27, .97, -4.4]]} radius={.021} color={palette.metal} surface="metal" />
    <Rod from={[.59, .79, -4.43]} to={[.69, .84, -4.4]} radius={.012} />
    <Block position={[-.88, .55, -1.38]} size={[.68, .76, .7]} color={palette.oakLight} rounded />
    {Array.from({ length: 9 }, (_, i) => <Block key={i} position={[-1.17 + i * .071, .56, -1.02]} size={[.025, .65, .027]} color={palette.oakDark} />)}
    <Block position={[-.88, .95, -1.38]} size={[.73, .065, .75]} color="#ddd7c6" surface="stone" rounded />
    <Ceramic position={[-.88, .986, -1.38]} scale={[1, .85, 1]} profile={[[0, 0], [.14, 0], [.2, .035], [.28, .13], [.29, .17], [.27, .19], [.25, .15], [.18, .06], [0, .05]]} />
    <Cylinder position={[-.88, 1.03, -1.38]} radius={.027} height={.005} color={palette.metal} />
    <Pipe points={[[-1.08, .99, -1.61], [-1.08, 1.29, -1.61], [-1.01, 1.34, -1.58], [-.91, 1.33, -1.51], [-.91, 1.26, -1.48]]} radius={.014} color={palette.metal} surface="metal" />
    <Cylinder position={[-.61, 1.06, -1.62]} radius={.036} height={.16} color="#c2ac8b" surface="ceramic" /><Block position={[-.61, 1.148, -1.62]} size={[.06, .015, .025]} color={palette.dark} />
    <mesh position={[-1.445, 1.48, -1.44]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[.315, 48]} />{detailed ? <MeshReflectorMaterial resolution={256} blur={[0, 0]} mirror={.9} mixStrength={1} metalness={.2} roughness={.08} color="#d3dfe0" /> : <meshStandardMaterial color="#d3dfe0" roughness={.12} metalness={.45} />}</mesh>
    <mesh position={[-1.44, 1.48, -1.44]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.32, .014, 8, 48]} /><SurfaceMaterial kind="metal" color="#b2a184" /></mesh>
    {/* Compact wall-facing WC with a pedestal, open seat and rounded cistern. */}
    <Ceramic position={[.65, .14, -1.43]} scale={[.8, 1, 1.07]} profile={[[0, 0], [.17, 0], [.19, .06], [.17, .2], [.24, .29], [.33, .37], [.35, .43], [.33, .46], [.29, .45], [.24, .36], [.14, .31], [0, .31]]} />
    <mesh position={[.65, .614, -1.43]} rotation={[-Math.PI / 2, 0, 0]} scale={[.82, 1.05, 1]} castShadow><torusGeometry args={[.3, .038, 10, 48]} /><SurfaceMaterial kind="ceramic" color={palette.white} /></mesh>
    <Block position={[.65, .64, -1.9]} size={[.56, .73, .25]} color={palette.white} surface="ceramic" rounded /><Cylinder position={[.65, 1.015, -1.9]} radius={.038} height={.007} color={palette.metal} />
    {/* Clear glass and chrome shower hardware keep the compact wet zone open. */}
    <Block position={[.91, 1.22, -3.94]} size={[.012, 2.13, 1.58]} color="#dce9e7" surface="glass" />
    <Rod from={[.91, .16, -3.15]} to={[.91, 2.29, -3.15]} radius={.012} /><Rod from={[.91, 2.29, -3.15]} to={[.91, 2.29, -4.73]} radius={.012} />
    <Rod from={[1.04, .85, -4.55]} to={[1.04, 2.19, -4.55]} radius={.017} /><Pipe points={[[1.04, 2.19, -4.55], [.98, 2.3, -4.55], [.76, 2.3, -4.55]]} radius={.017} color={palette.metal} surface="metal" /><Cylinder position={[.73, 2.27, -4.55]} radius={.13} height={.023} color={palette.metal} />
    <Rod from={[1.08, 1.19, -2.82]} to={[1.08, 1.19, -2.08]} radius={.014} />
    <Cloth position={[1.055, .98, -2.6]} rotation={[0, 0, Math.PI / 2]} width={.42} depth={.3} color="#d6d8ce" /><Cloth position={[1.055, 1.04, -2.23]} rotation={[0, 0, Math.PI / 2]} width={.3} depth={.23} color={palette.white} />
    <Block position={[-.02, .145, -2.6]} size={[.87, .022, .9]} color="#b8c0b1" surface="fabric" rounded />
    <Plant position={[-.88, .14, -2.7]} scale={.43} />
  </group>
})
function Keyboard({ position }: { position: V3 }) {
  const keys = useRef<InstancedMesh>(null)
  useEffect(() => {
    if (!keys.current) return
    const matrix = new Matrix4()
    for (let row = 0; row < 4; row++) for (let col = 0; col < 11; col++) { matrix.makeTranslation(-.247 + col * .0465, .023, -.068 + row * .045); keys.current.setMatrixAt(row * 11 + col, matrix) }
    keys.current.instanceMatrix.needsUpdate = true
  }, [])
  return <group position={position}><Block position={[0, .008, 0]} size={[.57, .025, .22]} color="#c3cbc8" rounded /><instancedMesh ref={keys} args={[undefined, undefined, 44]} castShadow receiveShadow><boxGeometry args={[.037, .013, .032]} /><SurfaceMaterial kind="matte" color={palette.white} /></instancedMesh></group>
}
function OfficeChair() {
  return <group position={[3.45, .045, -3.03]} rotation={[0, Math.PI, 0]}>
    <Pillow position={[0, .53, 0]} size={[.62, .58, .17]} color="#8f9e9b" rotation={[-Math.PI / 2, 0, 0]} />
    <Pillow position={[0, .93, -.26]} size={[.58, .77, .14]} color="#8f9e9b" rotation={[-.1, 0, 0]} />
    <Cylinder position={[0, .28, 0]} radius={.045} height={.4} color={palette.metal} />
    {[0, 1, 2, 3, 4].map(i => <group key={i} rotation={[0, i * Math.PI * 2 / 5, 0]}><Rod from={[0, .13, 0]} to={[.34, .08, 0]} radius={.018} color={palette.dark} /><Cylinder position={[.34, .045, 0]} radius={.045} height={.04} color={palette.dark} rotation={[Math.PI / 2, 0, 0]} /></group>)}
    {[-.32, .32].map(x => <group key={x}><Rod from={[x, .55, -.18]} to={[x, .77, -.18]} radius={.014} color={palette.dark} /><Block position={[x, .785, -.06]} size={[.055, .035, .35]} color={palette.dark} rounded /></group>)}
  </group>
}
export const Office = memo(function Office() {
  return <group>
    <Block position={[3.45, .82, -4.1]} size={[2.8, .1, .85]} color={palette.oakLight} rounded />
    {[-1.1, 1.1].map(x => <Block key={x} position={[3.45 + x, .4, -4.1]} size={[.09, .8, .55]} color={palette.white} />)}
    <Block position={[3.45, 1.31, -4.3]} size={[1.1, .65, .045]} color={palette.dark} rounded /><Block position={[3.45, 1.31, -4.271]} size={[1.035, .572, .008]} color="#96b1b0" /><Block position={[3.19, 1.31, -4.265]} size={[.19, .47, .004]} color="#b2c7c0" /><Block position={[3.58, 1.42, -4.265]} size={[.49, .13, .004]} color="#d2d9d0" /><Block position={[3.58, 1.23, -4.265]} size={[.49, .16, .004]} color="#839d96" />
    <Rod from={[3.45, .88, -4.25]} to={[3.45, 1.02, -4.25]} radius={.025} /><Block position={[3.45, .884, -4.2]} size={[.35, .018, .2]} color={palette.metal} />
    <Keyboard position={[3.43, .884, -3.94]} /><mesh position={[3.9, .905, -3.93]} scale={[.045, .024, .065]} castShadow><sphereGeometry args={[1, 16, 10]} /><SurfaceMaterial kind="matte" color={palette.white} /></mesh>
    <group position={[2.53, .89, -4.07]} rotation={[0, -.18, 0]}><Block position={[0, .015, 0]} size={[.55, .028, .37]} color={palette.metal} rounded /><Block position={[0, .209, -.177]} size={[.55, .37, .018]} color={palette.dark} rotation={[-.12, 0, 0]} rounded /><Block position={[0, .209, -.164]} size={[.49, .3, .005]} color="#a4b6b1" rotation={[-.12, 0, 0]} /><Block position={[0, .033, -.01]} size={[.43, .008, .19]} color="#7a8582" /><Block position={[0, .035, .125]} size={[.17, .005, .07]} color="#b4bebb" /></group>
    <Mug position={[4.28, .88, -3.88]} color="#aebca4" />
    <OfficeChair />
    <group position={[5.2, 0, -3.7]}><Block position={[0, .93, -.22]} size={[.8, 1.86, .04]} color={palette.oak} />{[-.395, .395].map(x => <Block key={x} position={[x, .94, .015]} size={[.045, 1.86, .52]} color={palette.oakLight} />)}{[.15, .71, 1.27, 1.83].map(y => <Block key={y} position={[0, y, .015]} size={[.83, .04, .52]} color={palette.oakLight} />)}{Array.from({ length: 14 }, (_, i) => { const x = -.27 + (i % 5) * .12; const y = .39 + Math.floor(i / 5) * .56; return <group key={i} position={[x, y, .1]} rotation={[0, 0, i % 5 === 0 ? .12 : 0]}><Block position={[0, 0, 0]} size={[.088, .39 - (i % 3) * .04, .25]} color={[palette.sage, palette.cushion, palette.oakDark, '#96aebb', '#b9a183'][i % 5]} /><Block position={[0, .08, .13]} size={[.058, .008, .005]} color="#e2d5b4" /><Block position={[0, -.08, .13]} size={[.058, .008, .005]} color="#e2d5b4" /></group> })}<Vase position={[.17, 1.86, 0]} /></group>
    <Plant position={[1.85, 0, -4.3]} scale={1.1} />
    <Block position={[4.1, .07, -1.6]} size={[2.5, .025, 1.2]} color="#d3c8b5" surface="fabric" rounded />
    <Chair position={[4.8, 0, -1.8]} rotation={-.4} color={palette.fabric} />
    <Cylinder position={[3.7, .45, -1.6]} radius={.36} height={.06} color={palette.oakLight} /><Cylinder position={[3.7, .23, -1.6]} radius={.06} height={.43} color={palette.oak} />
    <Block position={[3.7, .495, -1.6]} size={[.25, .025, .19]} color="#b4bfab" rotation={[0, .17, 0]} /><Mug position={[3.62, .515, -1.53]} />
  </group>
})
export function StandingLamp({ position, on, brightness = 75, warmth = 'warm', variant = 'floor' }: { position: V3; on: boolean; brightness?: number; warmth?: 'warm' | 'neutral' | 'cool'; variant?: 'floor' | 'pendant' | 'table' }) {
  const shade = useRef<Mesh>(null)
  const light = useRef<import('three').PointLight>(null)
  const color = warmth === 'cool' ? '#c7e8ff' : warmth === 'neutral' ? '#fff6df' : '#ffd293'
  const shadeY = variant === 'table' ? .38 : variant === 'pendant' ? 2.12 : 1.85
  const shadeSize: [number, number, number] = variant === 'table' ? [.15, .22, .26] : variant === 'pendant' ? [.11, .42, .34] : [.22, .37, .42]
  useFrame((_, delta) => {
    const target = on ? brightness / 100 : 0
    if (shade.current?.material instanceof MeshStandardMaterial) { const material = shade.current.material; material.emissive.set(color); material.emissiveIntensity += (target * 1.15 - material.emissiveIntensity) * Math.min(1, delta * 7); material.side = DoubleSide }
    if (light.current) light.current.intensity += (target * (variant === 'table' ? 3.5 : variant === 'pendant' ? 12 : 8) - light.current.intensity) * Math.min(1, delta * 7)
  })
  return <group position={position}>
    {variant === 'table' ? <><Ceramic position={[0, 0, 0]} profile={[[0, 0], [.12, 0], [.13, .025], [.08, .06], [.065, .17], [.04, .23]]} color="#c4b599" /><Cylinder position={[0, .25, 0]} radius={.012} height={.15} color={palette.metal} /></> : variant === 'pendant' ? <><Cylinder position={[0, 2.94, 0]} radius={.085} height={.04} color={palette.dark} /><Cylinder position={[0, 2.62, 0]} radius={.008} height={.64} color={palette.dark} /></> : <><Cylinder position={[0, .04, 0]} radius={.27} height={.06} color={palette.dark} /><Cylinder position={[0, .9, 0]} radius={.019} height={1.8} color={palette.dark} /></>}
    <mesh ref={shade} position={[0, shadeY, 0]} castShadow receiveShadow><cylinderGeometry args={[...shadeSize, 40, 1, true]} /><SurfaceMaterial kind="fabric" color={palette.cushion} /></mesh>
    <mesh position={[0, shadeY - shadeSize[2] / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[shadeSize[1] - .012, shadeSize[1], 40]} /><SurfaceMaterial kind="fabric" color="#d5cbbb" /></mesh>
    <pointLight ref={light} position={[0, shadeY - shadeSize[2] * .35, 0]} color={color} intensity={0} distance={variant === 'table' ? 3.8 : 5.5} decay={2} />
  </group>
}
export function CeilingFan({ on, speed = 2, reducedMotion }: { on: boolean; speed?: number; reducedMotion: boolean }) {
  const rotor = useRef<Group>(null)
  useFrame((_, delta) => { if (rotor.current && on && !reducedMotion) rotor.current.rotation.y += Math.min(delta, .05) * speed * 2.5 })
  return <group position={[-2.6, 2.6, 1.6]}><Cylinder position={[0, 0, 0]} radius={.08} height={.28} color={palette.metal} /><group ref={rotor}><Cylinder position={[0, -.2, 0]} radius={.19} height={.12} color={palette.white} />{[0, 1, 2].map(i => <group key={i} rotation={[0, i * Math.PI * 2 / 3, 0]}><Block position={[.42, -.16, 0]} size={[.93, .035, .17]} color={palette.oakLight} rounded /></group>)}</group></group>
}
export const Garden = memo(function Garden({ upperFloor = false }: { upperFloor?: boolean }) {
  return <group>
    <Block position={[7.8, -.04, 0]} size={[3.45, .16, 9.85]} color="#cad7bf" />
    <Block position={[7.8, .055, 2.55]} size={[3.05, .06, 3.5]} color="#d4d4cc" />
    {Array.from({ length: 5 }, (_, i) => <Block key={i} position={[7.6, .08, -2.4 + i * .65]} size={[.8, .08, .42]} color={palette.white} />)}
    {[-4.25, -2.4, -.5].map(z => <Plant key={z} position={[8.95, .06, z]} scale={z === -4.25 ? 1.8 : 1.15} />)}
    <Plant position={[6.65, .06, -4.35]} scale={1.3} />
    {upperFloor ? <group><Chair position={[7.1, .1, 3.2]} rotation={.3} color={palette.fabric} /><Chair position={[8.45, .1, 3.2]} rotation={-.3} color={palette.fabric} /><Cylinder position={[7.8, .48, 2.3]} radius={.43} height={.08} color={palette.oakLight} /><Cylinder position={[7.8, .27, 2.3]} radius={.05} height={.42} color={palette.oak} /><Vase position={[7.8, .52, 2.3]} /></group> : <group position={[7.85, .13, 2.6]}>
      <Block position={[0, .49, 0]} size={[1.53, .49, 2.8]} color="#dbe4e5" rounded /><Block position={[0, .84, -.18]} size={[1.34, .53, 1.55]} color="#c8d4d6" rounded />
      <Block position={[0, .85, .62]} size={[1.23, .43, .025]} color="#6b8991" rotation={[-.2, 0, 0]} rounded /><Block position={[0, .85, -.96]} size={[1.23, .4, .025]} color="#6b8991" rotation={[.2, 0, 0]} rounded />
      {[-.79, .79].flatMap(x => [-.83, .83].map(z => <mesh key={`${x}-${z}`} position={[x, .31, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.29, .29, .16, 24]} /><meshStandardMaterial color={palette.dark} /></mesh>))}
      {[-.5, .5].map(x => <Block key={x} position={[x, .53, 1.42]} size={[.32, .12, .03]} color={palette.white} rounded />)}
      <Block position={[0, .37, 1.42]} size={[.49, .11, .025]} color={palette.dark} />
    </group>}
    <Block position={[9.5, .37, 0]} size={[.12, .8, 9.8]} color={palette.wall} />
    <Block position={[7.8, .37, -4.9]} size={[3.4, .8, .12]} color={palette.wall} />
  </group>
})
