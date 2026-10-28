import { memo, useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3, Matrix4, Vector3, type Group, type Mesh } from 'three'
import { builtinBase, type Furniture } from '../neonplan/model'
import { Bed, Block, Ceramic, Chair, Cloth, CoffeeTable, Cylinder, Keyboard, Mug, OfficeChair, Pillow, Pipe, PlaceSetting, Plant, Rod, Sofa } from './FurniturePrimitives'
import { palette, detail } from './materials'
import { SurfaceMaterial } from './surfaces'
import { hasV2Furniture } from './furnitureSupport'

function Cabinet({ doors = 2, drawers = false, kitchen = false }: { doors?: number; drawers?: boolean; kitchen?: boolean }) {
  const color = kitchen ? palette.sage : palette.oakLight
  return <group>
    <Block position={[0, .5, 0]} size={[1, .9, .55]} color={color} rounded />
    <Block position={[0, .975, 0]} size={[1.04, .05, .59]} color={kitchen ? palette.white : palette.oakLight} surface={kitchen ? 'stone' : 'wood'} rounded />
    <Block position={[0, .055, 0]} size={[.9, .11, .45]} color={palette.oakDark} />
    {Array.from({ length: drawers ? 3 : doors }, (_, i) => drawers
      ? <group key={i}><Block position={[0, .23 + i * .28, .285]} size={[.94, .26, .025]} color={color} /><Rod from={[-.11, .27 + i * .28, .31]} to={[.11, .27 + i * .28, .31]} radius={.009} color={palette.metal} /></group>
      : <group key={i}><Block position={[-.5 + (i + .5) / doors, .5, .285]} size={[1 / doors - .025, .84, .025]} color={color} /><Rod from={[-.5 + (i + .5) / doors, .64, .31]} to={[-.5 + (i + .5) / doors, .78, .31]} radius={.009} color={palette.metal} /></group>)}
  </group>
}

function Bookshelf() {
  return <group>
    <Block position={[0, .95, -.235]} size={[.9, 1.9, .04]} color={palette.oak} />
    {[-.44, .44].map(x => <Block key={x} position={[x, .95, 0]} size={[.04, 1.9, .5]} color={palette.oakLight} />)}
    {[.04, .64, 1.24, 1.88].map(y => <Block key={y} position={[0, y, 0]} size={[.9, .04, .5]} color={palette.oakLight} />)}
    {Array.from({ length: 15 }, (_, i) => <group key={i} position={[-.31 + (i % 5) * .13, .31 + Math.floor(i / 5) * .6, .05]} rotation={[0, 0, i % 5 === 0 ? -.1 : 0]}><Block position={[0, 0, 0]} size={[.1, .44 - (i % 3) * .045, .3]} color={[palette.sage, palette.fabric, palette.oakDark, detail.tanPillow][i % 4]} /><Block position={[0, .09, .154]} size={[.07, .01, .005]} color={detail.paper} /></group>)}
  </group>
}

function DiningTable({ round = false }: { round?: boolean }) {
  return <group>
    {round ? <Cylinder position={[0, .78, 0]} radius={.6} height={.09} color={palette.oakLight} /> : <Block position={[0, .78, 0]} size={[1.9, .09, .92]} color={palette.oakLight} rounded />}
    {round ? <><Cylinder position={[0, .36, 0]} radius={.11} height={.72} color={palette.oak} /><Cylinder position={[0, .035, 0]} radius={.39} height={.05} color={palette.oak} /></> : [-.76, .76].flatMap(x => [-.31, .31].map(z => <Rod key={`${x}-${z}`} from={[x * 1.05, .015, z * 1.05]} to={[x, .74, z]} radius={.037} color={palette.oakDark} />))}
    {[-.53, .53].map(x => <PlaceSetting key={x} position={[round ? x * .55 : x, .83, 0]} rotation={x < 0 ? Math.PI / 2 : -Math.PI / 2} />)}
  </group>
}

function Desk() {
  return <group>
    <Block position={[0, .77, 0]} size={[1.7, .08, .72]} color={palette.oakLight} rounded />
    {[-.71, .71].map(x => <Block key={x} position={[x, .38, 0]} size={[.065, .76, .55]} color={palette.white} />)}
    <Block position={[0, 1.12, -.21]} size={[.73, .43, .035]} color={palette.dark} rounded />
    {/* Neutral unlit display: device power comes from the existing real device renderer. */}
    <Block position={[0, 1.12, -.187]} size={[.68, .38, .006]} color={palette.screen} />
    <Rod from={[0, .82, -.22]} to={[0, .94, -.22]} radius={.02} />
    <Block position={[0, .817, -.2]} size={[.29, .014, .18]} color={palette.metal} />
    <Keyboard position={[-.05, .815, .12]} /><Mug position={[.59, .815, .05]} color={palette.sage} />
  </group>
}

function LoungeChair() {
  return <group>
    {[-.36, .36].flatMap(x => [-.34, .34].map(z => <Rod key={`${x}-${z}`} from={[x, .015, z]} to={[x, .31, z]} radius={.032} color={palette.oakDark} />))}
    <Block position={[0, .39, 0]} size={[.91, .27, .88]} color={palette.fabric} rounded />
    <Pillow position={[0, .6, .07]} size={[.7, .72, .19]} rotation={[-Math.PI / 2, 0, 0]} />
    <Pillow position={[0, .85, -.33]} size={[.83, .65, .21]} color={palette.sage} rotation={[-.1, 0, 0]} />
    {[-.44, .44].map(x => <Block key={x} position={[x, .6, 0]} size={[.16, .48, .91]} color={palette.fabric} rounded />)}
  </group>
}

function Fridge() {
  return <group>
    <Block position={[0, .96, 0]} size={[.78, 1.92, .73]} color={detail.keyboard} rounded />
    <Block position={[0, 1.28, .376]} size={[.73, 1.18, .03]} color={detail.glass} rounded />
    <Block position={[0, .34, .376]} size={[.73, .64, .03]} color={detail.glass} rounded />
    {[.41, 1.22].map(y => <Rod key={y} from={[-.28, y, .416]} to={[-.28, y + .26, .416]} radius={.014} color={palette.metal} />)}
    <Block position={[0, .04, 0]} size={[.64, .08, .62]} color={palette.dark} />
  </group>
}

function Sink({ vanity = false }: { vanity?: boolean }) {
  return <group>
    <group scale={[.86, .82, 1]}><Cabinet kitchen={!vanity} drawers={vanity} /></group>
    <Ceramic position={[0, .84, .025]} scale={[1.14, .9, .78]} profile={[[0, 0], [.15, 0], [.22, .04], [.3, .16], [.31, .19], [.28, .2], [.25, .12], [.18, .04], [0, .035]]} surface={vanity ? 'ceramic' : 'metal'} color={vanity ? palette.white : palette.metal} />
    <Pipe points={[[.19, .84, -.21], [.19, 1.13, -.21], [.13, 1.2, -.18], [.04, 1.18, -.1], [.04, 1.1, -.05]]} radius={.015} color={palette.metal} surface="metal" />
    <Cylinder position={[0, .88, .025]} radius={.025} height={.005} color={palette.metal} />
  </group>
}

function Stove() {
  return <group>
    <Cabinet kitchen />
    <Block position={[0, 1.008, 0]} size={[.92, .025, .5]} color={palette.dark} rounded />
    {[-.23, .23].flatMap(x => [-.13, .13].map(z => <mesh key={`${x}-${z}`} position={[x, 1.025, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.075, .082, 24]} /><SurfaceMaterial color={palette.metal} kind="metal" /></mesh>))}
    <Block position={[0, .48, .31]} size={[.8, .45, .028]} color={palette.dark} rounded />
    <Block position={[0, .47, .327]} size={[.68, .3, .008]} color={palette.screen} />
    <Rod from={[-.28, .67, .346]} to={[.28, .67, .346]} radius={.012} />
    {[-.24, 0, .24].map(x => <Cylinder key={x} position={[x, .83, .32]} radius={.034} height={.025} rotation={[Math.PI / 2, 0, 0]} color={palette.metal} />)}
  </group>
}

function Bathtub() {
  return <group>
    <Ceramic position={[0, 0, 0]} scale={[.75, 1, 1.4]} profile={[[0, 0], [.34, 0], [.47, .05], [.58, .18], [.67, .49], [.7, .62], [.685, .665], [.65, .68], [.61, .64], [.57, .49], [.48, .23], [.34, .17], [0, .17]]} />
    <Cylinder position={[0, .175, .1]} radius={.026} height={.008} color={palette.metal} />
    <Pipe points={[[.38, .05, -.65], [.38, .72, -.65], [.32, .82, -.65], [.15, .82, -.65], [.13, .75, -.65]]} radius={.018} color={palette.metal} surface="metal" />
  </group>
}

function Toilet() {
  return <group>
    <Ceramic position={[0, 0, .09]} scale={[.8, 1, 1.07]} profile={[[0, 0], [.17, 0], [.19, .06], [.17, .2], [.24, .29], [.33, .37], [.35, .43], [.33, .46], [.29, .45], [.24, .36], [.14, .31], [0, .31]]} />
    <mesh position={[0, .475, .09]} rotation={[-Math.PI / 2, 0, 0]} scale={[.82, 1.05, 1]} castShadow><torusGeometry args={[.3, .038, 10, 40]} /><SurfaceMaterial kind="ceramic" color={palette.white} /></mesh>
    <Block position={[0, .5, -.34]} size={[.56, .73, .25]} color={palette.white} surface="ceramic" rounded />
    <Cylinder position={[0, .87, -.34]} radius={.038} height={.007} color={palette.metal} />
  </group>
}

function Shower() {
  return <group>
    <Block position={[0, .055, 0]} size={[.92, .11, .92]} color={palette.white} surface="ceramic" rounded />
    <Block position={[-.45, 1.1, 0]} size={[.012, 2, .9]} color={detail.glass} surface="glass" />
    <Block position={[0, 1.1, -.45]} size={[.9, 2, .012]} color={detail.glass} surface="glass" />
    <Rod from={[-.45, .1, .45]} to={[-.45, 2.1, .45]} radius={.012} />
    <Rod from={[-.45, 2.1, -.45]} to={[-.45, 2.1, .45]} radius={.012} />
    <Rod from={[.27, .75, -.39]} to={[.27, 1.99, -.39]} radius={.017} />
    <Pipe points={[[.27, 1.99, -.39], [.22, 2.08, -.39], [0, 2.08, -.39]]} radius={.017} surface="metal" color={palette.metal} />
    <Cylinder position={[0, 2.055, -.39]} radius={.13} height={.023} color={palette.metal} />
    <Cylinder position={[.25, .11, .25]} radius={.045} height={.006} color={palette.metal} />
  </group>
}

function TV({ board = false }: { board?: boolean }) {
  return board ? <group>
    <group scale={[1.8, .55, 1]}><Cabinet drawers /></group>
    <Block position={[0, 1.09, -.13]} size={[1.45, .82, .055]} color={palette.dark} rounded />
    <Block position={[0, 1.09, -.098]} size={[1.37, .74, .005]} color={palette.screen} roughness={.22} />
    <Block position={[0, .565, -.1]} size={[.34, .02, .16]} color={palette.metal} />
    <Rod from={[0, .57, -.13]} to={[0, .72, -.13]} radius={.018} />
  </group> : <group>
    <Block position={[0, .5, 0]} size={[1.78, 1, .065]} color={palette.dark} rounded />
    <Block position={[0, .5, .036]} size={[1.69, .91, .005]} color={palette.screen} roughness={.22} />
  </group>
}

function Car() {
  return <group>
    <Block position={[0, .53, 0]} size={[1.62, .48, 3.35]} color={detail.carPaint} rounded />
    <Block position={[0, .89, -.22]} size={[1.44, .57, 1.88]} color={detail.carPaint} rounded />
    <Block position={[0, .94, .7]} size={[1.3, .42, .026]} color={detail.carGlass} rotation={[-.2, 0, 0]} rounded />
    <Block position={[0, .94, -1.17]} size={[1.3, .38, .026]} color={detail.carGlass} rotation={[.22, 0, 0]} rounded />
    {[-1, 1].map(side => <group key={side}>
      {[-.69, .23].map(z => <Block key={z} position={[side * .727, .94, z]} size={[.018, .35, .77]} color={detail.carGlass} rounded />)}
      <Block position={[side * .81, .86, .58]} size={[.18, .1, .22]} color={detail.carPaint} rounded />
      {[-.93, 1.01].map(z => <group key={z} position={[side * .8, .29, z]}>
        <Cylinder position={[0, 0, 0]} radius={.29} height={.17} rotation={[0, 0, Math.PI / 2]} color={palette.dark} surface="matte" />
        <Cylinder position={[side * .092, 0, 0]} radius={.175} height={.012} rotation={[0, 0, Math.PI / 2]} color={palette.metal} surface="metal" />
        <Cylinder position={[side * .103, 0, 0]} radius={.055} height={.016} rotation={[0, 0, Math.PI / 2]} color={detail.carPaint} />
      </group>)}
      <Block position={[side * .53, .6, 1.683]} size={[.35, .13, .027]} color={palette.white} rounded />
      <Block position={[side * .55, .61, -1.683]} size={[.29, .12, .027]} color={detail.carTailLight} rounded />
      <Block position={[side * .755, .75, -.16]} size={[.025, .022, .15]} color={palette.metal} rounded />
    </group>)}
    <Block position={[0, .39, 1.684]} size={[.62, .13, .025]} color={palette.dark} rounded />
    <Block position={[0, .47, -1.686]} size={[.37, .1, .018]} color={palette.white} />
  </group>
}

function Asset({ type }: { type: string }) {
  switch (type) {
    case 'sofa': return <Sofa position={[0, 0, 0]} />
    case 'armchair': return <LoungeChair />
    case 'bed': return <Bed />
    case 'chair': return <Chair position={[0, 0, 0]} />
    case 'office_chair': return <OfficeChair />
    case 'table': return <DiningTable />
    case 'table_round': return <DiningTable round />
    case 'coffee_table': return <CoffeeTable position={[0, 0, 0]} />
    case 'desk': return <Desk />
    case 'nightstand': case 'dresser': return <Cabinet drawers />
    case 'wardrobe': return <Cabinet doors={3} />
    case 'sideboard': case 'tall_cabinet': return <Cabinet />
    case 'shelf': return <Bookshelf />
    case 'kitchen': case 'kitchen_wall': case 'kitchen_tall': case 'island': return <Cabinet kitchen />
    case 'fridge': case 'fridge_smart': return <Fridge />
    case 'stove': return <Stove />
    case 'sink': return <Sink />
    case 'washbasin': return <Sink vanity />
    case 'bathtub': return <Bathtub />
    case 'shower': return <Shower />
    case 'wc': return <Toilet />
    case 'tv_board': return <TV board />
    case 'tv_wall': return <TV />
    case 'plant': return <Plant position={[0, 0, 0]} />
    case 'rug': return <Cloth position={[0, .02, 0]} width={1} depth={1} color={palette.fabric} />
    case 'car': return <Car />
    default: return null
  }
}

/**
 * A renderer for one saved furnishing, never an inferred room arrangement.
 * Local mesh bounds are fitted to the layout's width/depth/height. Assets
 * use +z as their front, matching NeonPlan and the saved editor footprint.
 * Worktop, cabinet, basin and tub heights refer to the structural top, as in
 * the editor; their props/taps/screens can extend above that height.
 * Caller owns pointer selection; this component owns item placement only.
 */
export const V2Furniture = memo(function V2Furniture({ item }: { item: Furniture }) {
  const fitted = useRef<Group>(null)
  const source = useRef<Group>(null)
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    if (!fitted.current || !source.current) return
    source.current.updateWorldMatrix(true, true)
    const inverse = source.current.matrixWorld.clone().invert()
    const box = new Box3()
    const transform = new Matrix4()
    source.current.traverse(object => {
      const mesh = object as Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      if (!mesh.geometry.boundingBox) return
      transform.multiplyMatrices(inverse, mesh.matrixWorld)
      box.union(mesh.geometry.boundingBox.clone().applyMatrix4(transform))
    })
    if (box.isEmpty()) return
    if (item.type === 'desk') box.max.y = .81
    if (item.type === 'tv_board') box.max.y = .55
    if (item.type === 'table' || item.type === 'table_round') box.max.y = .825
    if (item.type === 'coffee_table') box.max.y = .475
    if (item.type === 'sink' || item.type === 'washbasin') box.max.y = 1.02
    if (item.type === 'bathtub') box.max.y = .68
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const sx = Math.max(.05, item.w) / Math.max(.001, size.x)
    const sy = Math.max(.005, item.h) / Math.max(.001, size.y)
    const sz = Math.max(.05, item.d) / Math.max(.001, size.z)
    fitted.current.scale.set(sx, sy, sz)
    fitted.current.position.set(-center.x * sx, -box.min.y * sy, -center.z * sz)
    fitted.current.updateMatrixWorld(true)
    invalidate()
  }, [item.w, item.d, item.h, item.type, item.variant, invalidate])
  if (!hasV2Furniture(item.type)) return null
  return <group name={`v2-furniture:${item.id}`} position={[item.x, item.mount_y ?? builtinBase(item), item.z]} rotation={[0, -item.rotation * Math.PI / 180, 0]}>
    <group ref={fitted}><group ref={source}><Asset type={item.type} /></group></group>
  </group>
})
