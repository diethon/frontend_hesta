// Individual assets extracted from the approved standalone V2 demo. No mock rooms or device state.
import { memo, useEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector2, Vector3, type InstancedMesh, type Mesh } from 'three'
import { palette, detail } from './materials'
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
export function Cylinder({ position, radius, height, color = palette.oak, top, surface, rotation }: { position: V3; radius: number; height: number; color?: string; top?: number; surface?: SurfaceKind; rotation?: V3 }) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[top ?? radius, radius, height, 32]} /><SurfaceMaterial kind={surface ?? inferSurface(color)} color={color} /></mesh>
}
export function Rod({ from, to, radius = .018, color = palette.metal }: { from: V3; to: V3; radius?: number; color?: string }) {
  const shape = useMemo(() => { const a = new Vector3(...from); const b = new Vector3(...to); return { position: a.clone().add(b).multiplyScalar(.5), quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()), length: a.distanceTo(b) } }, [from, to])
  return <mesh position={shape.position} quaternion={shape.quaternion} castShadow><cylinderGeometry args={[radius, radius, shape.length, 10]} /><SurfaceMaterial kind={color === palette.metal ? 'metal' : 'matte'} color={color} /></mesh>
}
export function Pipe({ points, radius = .006, color = palette.cushion, surface = 'fabric' }: { points: V3[]; radius?: number; color?: string; surface?: SurfaceKind }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(point => new Vector3(...point))), [points])
  return <mesh castShadow><tubeGeometry args={[curve, Math.max(16, points.length * 4), radius, 6, false]} /><SurfaceMaterial kind={surface} color={color} /></mesh>
}
export function Ceramic({ profile, position, scale = [1, 1, 1], color = palette.white, surface = 'ceramic' }: { profile: [number, number][]; position: V3; scale?: V3; color?: string; surface?: SurfaceKind }) {
  const points = useMemo(() => profile.map(([radius, y]) => new Vector2(radius, y)), [profile])
  return <mesh position={position} scale={scale} castShadow receiveShadow><latheGeometry args={[points, 48]} /><SurfaceMaterial kind={surface} color={color} /></mesh>
}
export function Cloth({ width, depth, color, position, drape = false, rotation, surface = 'fabric' }: { width: number; depth: number; color: string; position: V3; drape?: boolean; rotation?: V3; surface?: SurfaceKind }) {
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
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh ref={mesh} geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow><SurfaceMaterial kind={surface} color={color} /></mesh>
}
export function Pillow({ position, size = [.55, .5, .19], color = palette.cushion, rotation = [0, 0, 0] }: { position: V3; size?: V3; color?: string; rotation?: V3 }) {
  const [w, h, d] = size
  const geometry = useMemo(() => {
    const result = new SphereGeometry(1, 28, 20); const vertices = result.attributes.position
    for (let i = 0; i < vertices.count; i++) {
      const values = [vertices.getX(i), vertices.getY(i), vertices.getZ(i)]
      vertices.setXYZ(i, Math.sign(values[0]) * Math.pow(Math.abs(values[0]), .5) * w / 2, Math.sign(values[1]) * Math.pow(Math.abs(values[1]), .5) * h / 2, Math.sign(values[2]) * Math.pow(Math.abs(values[2]), .72) * d / 2)
    }
    result.computeVertexNormals(); return result
  }, [w, h, d])
  useEffect(() => () => geometry.dispose(), [geometry])
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
  useEffect(() => () => leaf.dispose(), [leaf])
  return <group position={position} scale={scale}>
    <Ceramic profile={[[0, 0], [.18, 0], [.2, .04], [.25, .38], [.255, .43], [.225, .43], [.21, .36], [0, .36]]} position={[0, 0, 0]} color={detail.pot} />
    <Cylinder position={[0, .38, 0]} radius={.218} height={.018} color={detail.soil} surface="matte" />
    {Array.from({ length: 9 }, (_, i) => <group key={i} rotation={[0, i * 2.4, 0]}><Rod from={[0, .38, 0]} to={[.09 + (i % 3) * .035, .65 + (i % 4) * .11, 0]} radius={.009} color={palette.leaf} /><mesh geometry={leaf} position={[.09 + (i % 3) * .035, .63 + (i % 4) * .11, 0]} rotation={[.08, 0, -.22 - (i % 3) * .27]} scale={[.8 + (i % 3) * .13, .7 + (i % 4) * .1, 1]} castShadow receiveShadow><meshStandardMaterial color={i % 3 ? palette.leaf : palette.leafLight} roughness={.66} side={DoubleSide} /></mesh></group>)}
  </group>
})
export function Vase({ position, color = palette.terracotta }: { position: V3; color?: string }) {
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
    <Pillow position={[.94, .97, -.03]} color={detail.tanPillow} rotation={[.1, .08, .18]} />
    <Cloth position={[1.32, 1.01, .03]} width={.64} depth={1.18} color={detail.sageThrow} drape />
    <Pipe color={detail.seam} points={[[-1.2, .44, .575], [0, .44, .575], [1.2, .44, .575]]} radius={.007} />
  </group>
})
export const CoffeeTable = memo(function CoffeeTable({ position }: { position: V3 }) {
  return <group position={position}><Cylinder position={[0, .43, 0]} radius={.7} height={.09} color={palette.oakLight} />{[0, 1, 2].map(i => <group rotation={[0, i * Math.PI * 2 / 3, 0]} key={i}><Block position={[.4, .22, 0]} size={[.07, .42, .07]} color={palette.oakDark} rotation={[0, 0, -.15]} /></group>)}<Block position={[-.12, .49, .02]} size={[.35, .022, .24]} color={palette.sage} /><Block position={[-.12, .505, .02]} size={[.326, .015, .221]} color={detail.paper} /><Block position={[-.12, .518, .02]} size={[.35, .009, .24]} color={palette.sage} /><Block position={[-.1, .537, .02]} size={[.3, .024, .21]} color={detail.book} rotation={[0, .1, 0]} /><Cylinder position={[-.28, .485, .32]} radius={.1} height={.008} color={palette.oakDark} /><Mug position={[-.28, .491, .32]} /><Block position={[.19, .487, .36]} size={[.07, .025, .19]} color={palette.dark} rounded /></group>
})
export const Bed = memo(function Bed({ accent = detail.duvet }: { accent?: string }) {
  return <group position={[0, 0, 0]}>
    <Block position={[0, .27, .02]} size={[2.35, .38, 2.8]} color={palette.oak} rounded />
    <Block position={[0, .55, 0]} size={[2.2, .38, 2.65]} color={palette.white} surface="fabric" rounded />
    <Block position={[0, .8, -1.35]} size={[2.5, 1.3, .19]} color={palette.fabric} rounded />
    {Array.from({ length: 7 }, (_, i) => <Block key={i} position={[-1.02 + i * .34, .89, -1.235]} size={[.32, 1.1, .11]} color={palette.fabric} rounded />)}
    <Pipe color={detail.ivorySeam} radius={.008} points={[[-1.03, .67, -1.25], [1.03, .67, -1.25], [1.1, .67, -1.14], [1.1, .67, 1.19], [1.02, .67, 1.31], [-1.03, .67, 1.31], [-1.1, .67, 1.17], [-1.1, .67, -1.16], [-1.03, .67, -1.25]]} />
    <Cloth position={[0, .84, .42]} width={2.48} depth={2.12} color={accent} drape />
    <Cloth position={[0, .865, -.48]} width={2.19} depth={.34} color={palette.white} />
    <Cloth position={[0, .875, .98]} width={2.17} depth={.43} color={detail.bedThrow} />
    {[-.55, .55].map(x => <group key={x}><Pillow position={[x, .87, -.95]} size={[.96, .58, .25]} color={palette.white} rotation={[-Math.PI / 2 + .1, 0, 0]} /><Pillow position={[x, .985, -.64]} size={[.78, .46, .23]} color={palette.cushion} rotation={[-Math.PI / 2 + .22, 0, 0]} /></group>)}
    <Pillow position={[0, 1.0, -.36]} size={[.61, .3, .18]} color={detail.taupePillow} rotation={[-.95, 0, 0]} />
  </group>
})
export function Chair({ position, rotation = 0, color = palette.sage }: { position: V3; rotation?: number; color?: string }) {
  return <group position={position} rotation={[0, rotation, 0]}><Pillow position={[0, .51, 0]} size={[.56, .57, .14]} color={color} rotation={[-Math.PI / 2, 0, 0]} /><Pillow position={[0, .86, -.24]} size={[.57, .6, .14]} color={color} rotation={[-.12, 0, 0]} />{[-.21, .21].flatMap(x => [-.2, .2].map(z => <Rod key={`${x}-${z}`} from={[x * 1.15, .045, z * 1.15]} to={[x, .49, z]} radius={.026} color={palette.oakDark} />))}</group>
}
export function Mug({ position, color = palette.cushion }: { position: V3; color?: string }) {
  return <group position={position}><Ceramic position={[0, 0, 0]} color={color} profile={[[0, 0], [.055, 0], [.067, .03], [.069, .13], [.06, .135], [.057, .03], [0, .025]]} /><mesh position={[.07, .075, 0]} rotation={[0, Math.PI / 2, 0]} castShadow><torusGeometry args={[.038, .009, 8, 16]} /><SurfaceMaterial kind="ceramic" color={color} /></mesh><Cylinder position={[0, .108, 0]} radius={.055} height={.003} color={detail.coffee} surface="matte" /></group>
}
function Glass({ position }: { position: V3 }) {
  return <Ceramic position={position} surface="glass" color={detail.glass} profile={[[0, 0], [.052, 0], [.057, .015], [.064, .15], [.058, .15], [.049, .025], [0, .025]]} />
}
export function PlaceSetting({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Cylinder position={[0, .005, 0]} radius={.22} height={.008} color={detail.placemat} surface="fabric" />
    <Ceramic position={[0, .011, 0]} profile={[[0, 0], [.1, 0], [.15, .008], [.185, .026], [.182, .035], [.14, .019], [0, .015]]} />
    <Block position={[0, .04, .015]} size={[.12, .015, .17]} color={detail.napkin} surface="fabric" rounded />
    <Rod from={[-.235, .025, -.08]} to={[-.235, .025, .09]} radius={.006} />
    <Rod from={[.235, .025, -.08]} to={[.235, .025, .09]} radius={.005} />
    <Block position={[.235, .029, -.065]} size={[.026, .007, .07]} color={palette.metal} surface="metal" rounded />
    <Glass position={[.19, .014, -.16]} />
  </group>
}
export function Keyboard({ position }: { position: V3 }) {
  const keys = useRef<InstancedMesh>(null)
  useEffect(() => {
    if (!keys.current) return
    const matrix = new Matrix4()
    for (let row = 0; row < 4; row++) for (let col = 0; col < 11; col++) { matrix.makeTranslation(-.247 + col * .0465, .023, -.068 + row * .045); keys.current.setMatrixAt(row * 11 + col, matrix) }
    keys.current.instanceMatrix.needsUpdate = true
  }, [])
  return <group position={position}><Block position={[0, .008, 0]} size={[.57, .025, .22]} color={detail.keyboard} rounded /><instancedMesh ref={keys} args={[undefined, undefined, 44]} castShadow receiveShadow><boxGeometry args={[.037, .013, .032]} /><SurfaceMaterial kind="matte" color={palette.white} /></instancedMesh></group>
}
export function OfficeChair() {
  return <group position={[0, 0, 0]}>
    <Pillow position={[0, .53, 0]} size={[.62, .58, .17]} color={detail.officeFabric} rotation={[-Math.PI / 2, 0, 0]} />
    <Pillow position={[0, .93, -.26]} size={[.58, .77, .14]} color={detail.officeFabric} rotation={[-.1, 0, 0]} />
    <Cylinder position={[0, .28, 0]} radius={.045} height={.4} color={palette.metal} />
    {[0, 1, 2, 3, 4].map(i => <group key={i} rotation={[0, i * Math.PI * 2 / 5, 0]}><Rod from={[0, .13, 0]} to={[.34, .08, 0]} radius={.018} color={palette.dark} /><Cylinder position={[.34, .045, 0]} radius={.045} height={.04} color={palette.dark} rotation={[Math.PI / 2, 0, 0]} /></group>)}
    {[-.32, .32].map(x => <group key={x}><Rod from={[x, .55, -.18]} to={[x, .77, -.18]} radius={.014} color={palette.dark} /><Block position={[x, .785, -.06]} size={[.055, .035, .35]} color={palette.dark} rounded /></group>)}
  </group>
}
