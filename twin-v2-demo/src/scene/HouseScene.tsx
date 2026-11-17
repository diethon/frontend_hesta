import { Component, memo, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Color, MOUSE, OrthographicCamera, PCFShadowMap, Plane, Vector3, type InstancedMesh, Matrix4, PlaneGeometry } from 'three'
import { Activity, Fan, Lightbulb, Monitor, Snowflake, Thermometer } from 'lucide-react'
import { type HouseSceneProps, type Room, type RoomId } from '../data'
import { Bathroom, Bed, Block, CeilingFan, CoffeeTable, Garden, Kitchen, Office, Plant, Sofa, StandingLamp, Television } from './Furniture'
import { palette } from './materials'
import { SurfaceMaterial, SurfaceProvider } from './surfaces'

const woodColors = ['#bc966e', '#c4a17b', '#cbb18b', '#be9b74', '#c9a77e', '#b7936c']
const homeTarget = new Vector3(1.7, 1.1, -.3)
const homeDirection = new Vector3(17, 22, 23)
const roomDirection = new Vector3(14, 17, 23)
const minPolarAngle = Math.PI / 5
const maxPolarAngle = Math.PI * .36
// Project all eight corners of the architectural bounds onto the camera basis.
// Keep room for the top caption and bottom toolbar inside the canvas.
const viewRight = new Vector3(homeDirection.z, 0, -homeDirection.x).normalize()
const viewUp = new Vector3().crossVectors(homeDirection.clone().normalize(), viewRight).normalize()
const modelWidth = 16.4 * Math.abs(viewRight.x) + 10.4 * Math.abs(viewRight.z)
const modelHeight = 16.4 * Math.abs(viewUp.x) + 3.55 * Math.abs(viewUp.y) + 10.4 * Math.abs(viewUp.z)
const contactVertex = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const contactFragment = `varying vec2 vUv;
void main() {
  vec2 p = abs((vUv - .5) * vec2(18.8, 12.8));
  vec2 d = p - vec2(8.05, 5.0);
  float distanceToBase = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float contact = 1.0 - smoothstep(-.2, 1.1, distanceToBase);
  gl_FragColor = vec4(vec3(.34, .42, .44), contact * .16);
}`
const roomByPoint = (x: number, z: number): RoomId => x > 6.05 ? 'garden' : z > -.3 ? x < 0 ? 'living' : 'kitchen' : x < -1.55 ? 'bedroom' : x < 1.25 ? 'bathroom' : 'office'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReduced(query.matches); query.addEventListener('change', change); return () => query.removeEventListener('change', change) }, [])
  return reduced
}

const WoodFloor = memo(function WoodFloor() {
  const ref = useRef<InstancedMesh>(null)
  const planks = useMemo(() => {
    const pieces: { x: number; z: number; width: number; color: string }[] = []
    for (let row = 0; row < 33; row++) {
      const z = -4.84 + row * .28
      for (let col = 0; col < 7; col++) {
        const start = -6 + col * 2.05 - (row % 2) * 1.025
        const end = Math.min(6, start + 2.035)
        const x = Math.max(-6, start)
        if (end > x) pieces.push({ x: (x + end) / 2, z, width: end - x, color: woodColors[(row * 7 + col * 3) % woodColors.length] })
      }
    }
    return pieces
  }, [])
  useEffect(() => {
    if (!ref.current) return
    const matrix = new Matrix4()
    planks.forEach((p, i) => { matrix.makeScale(p.width, .06, .268); matrix.setPosition(p.x, .015, p.z); ref.current!.setMatrixAt(i, matrix); ref.current!.setColorAt(i, new Color(p.color)) })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [planks])
  return <instancedMesh ref={ref} args={[undefined, undefined, planks.length]} receiveShadow><boxGeometry /><SurfaceMaterial kind="wood" color="#ffffff" roughness={.62} /></instancedMesh>
})

function Curtain({ position, width = .48 }: { position: [number, number, number]; width?: number }) {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(width, 2.12, 32, 12)
    const vertices = plane.attributes.position
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i); const y = vertices.getY(i)
      vertices.setZ(i, Math.sin(x / width * Math.PI * 10) * .045 * (1 + (1 - y) * .08))
    }
    plane.computeVertexNormals()
    return plane
  }, [width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh position={position} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#d7cfc0" roughness={.96} side={2} /></mesh>
}

const Architecture = memo(function Architecture({ detailRoom }: { detailRoom?: Room }) {
  const frontHeight = detailRoom && ['bedroom', 'bathroom', 'office'].includes(detailRoom.id) ? .36 : 1.36
  const leftPartitionHeight = detailRoom?.id === 'bathroom' ? 2.25 : 1.36
  const rightPartitionHeight = detailRoom?.id === 'bathroom' ? .45 : 1.36
  return <group>
    <Block position={detailRoom ? [detailRoom.center[0], -.28, detailRoom.center[2]] : [1.7, -.28, -.25]} size={detailRoom ? [detailRoom.size[0] + .51, .48, detailRoom.size[1] + .51] : [16.4, .48, 10.4]} color="#e4e5df" rounded />
    <Block position={[0, -.045, -.25]} size={[12.15, .13, 9.65]} color={palette.oakDark} />
    <WoodFloor />
    {/* Each room has a distinct, physically scaled architectural finish. */}
    <Block position={[-3.8, .52, -4.82]} size={[4.2, .92, .055]} color="#b1aaa0" surface="fabric" />
    {[-5.5, -2.15].map(x => <Curtain key={x} position={[x, 1.62, -4.67]} width={.55} />)}
    <Block position={[-3.82, 2.68, -4.67]} size={[4.18, .025, .025]} color={palette.oakDark} surface="metal" />
    <Block position={[3.55, .49, -4.82]} size={[4.3, .89, .045]} color="#aab6b0" surface="plaster" />
    <Block position={[-.1, .13, -2.7]} size={[2.42, .022, 4.3]} color="#d9d5cc" surface="stone" />
    {!detailRoom || detailRoom.id === 'bathroom' ? <><Block position={[-1.45, leftPartitionHeight / 2, -2.72]} size={[.025, leftPartitionHeight - .02, 4.36]} color="#d2cec4" surface="stone" /><Block position={[1.15, rightPartitionHeight / 2, -2.72]} size={[.025, rightPartitionHeight - .02, 4.36]} color="#d2cec4" surface="stone" /></> : null}
    {/* The rear facade has true openings, glass, timber mullions and deep sills. */}
    <Block position={[0, .48, -4.98]} size={[12.2, .96, .22]} color={palette.wall} />
    <Block position={[0, 2.65, -4.98]} size={[12.2, .31, .22]} color={palette.wall} />
    {[-6, -5.4, -2.18, -1.5, 1.24, 1.87, 5.3, 6].map(x => <Block key={x} position={[x, 1.75, -4.98]} size={[.22, 1.55, .22]} color={palette.wall} />)}
    {[{ x: -3.8, w: 3.04 }, { x: -.1, w: 2.45 }, { x: 3.6, w: 3.14 }].map(({ x, w }) => <group key={x}>
      <mesh position={[x, 1.75, -4.98]}><boxGeometry args={[w, 1.42, .04]} /><SurfaceMaterial kind="glass" color="#d4e1de" /></mesh>
      <Block position={[x, 1.02, -4.91]} size={[w + .16, .08, .41]} color={palette.white} />
      {[x - w / 2, x, x + w / 2].map(xx => <Block key={xx} position={[xx, 1.76, -4.94]} size={[.045, 1.5, .07]} color={palette.oakLight} />)}
      <Block position={[x, 2.48, -4.94]} size={[w + .08, .05, .07]} color={palette.oakLight} />
    </group>)}
    {/* Solid cutaway walls remain low at the front, so every furnished room is visible. */}
    {!detailRoom || detailRoom.id !== 'living' ? <Block position={[-6.03, 1.35, -2.6]} size={[.22, 2.7, 4.95]} color={palette.wall} /> : null}
    <Block position={[-6.03, .44, 2.05]} size={[.22, .88, 4.4]} color={palette.wall} />
    <Block position={[6.03, .42, -.25]} size={[.22, .84, 9.6]} color={palette.wall} />
    <Block position={[0, .14, 4.47]} size={[12.2, .28, .21]} color={palette.wall} />
    {detailRoom?.id === 'kitchen' ? <Block position={[3.55, 1.25, -.38]} size={[4.95, 2.5, .18]} color={palette.wall} /> : <>
      <Block position={[-4.15, frontHeight / 2, -.38]} size={[3.75, frontHeight, .18]} color={palette.wall} />
      <Block position={[.1, frontHeight / 2, -.38]} size={[2.3, frontHeight, .18]} color={palette.wall} />
      <Block position={[4.25, frontHeight / 2, -.38]} size={[3.55, frontHeight, .18]} color={palette.wall} />
    </>}
    <Block position={[-1.55, leftPartitionHeight / 2, -2.72]} size={[.17, leftPartitionHeight, 4.56]} color={palette.wall} />
    <Block position={[1.25, rightPartitionHeight / 2, -2.72]} size={[.17, rightPartitionHeight, 4.56]} color={palette.wall} />
    {/* Door thresholds make the open circulation legible without hiding the interiors. */}
    {[-1.7, 1.8].map(x => <Block key={x} position={[x, .07, -.38]} size={[1.0, .06, .24]} color={palette.oakLight} />)}
    <Block position={[0, .07, -2.73]} size={[2.43, .1, 4.35]} color="#dedfd5" surface="stone" />
    {Array.from({ length: 8 }, (_, i) => <Block key={i} position={[-.08, .128, -4.6 + i * .55]} size={[2.4, .006, .012]} color="#c5c9c0" />)}
    {[-.7, 0, .7].map(x => <Block key={x} position={[x, .128, -2.7]} size={[.012, .006, 4.3]} color="#c5c9c0" />)}
    {/* Skirting, framed artwork and an air conditioner finish the architectural shell. */}
    <Block position={[-5.9, .14, -2.6]} size={[.035, .15, 4.8]} color={palette.white} />
    <Block position={[-5.88, 1.78, -2.8]} size={[.06, .9, 1.05]} color={palette.oak} />
    <Block position={[-5.84, 1.78, -2.8]} size={[.025, .77, .92]} color="#bdc5ad" />
    {!detailRoom || detailRoom.id === 'living' ? <><Block position={[-4.3, 1.54, -.46]} size={[1.22, .38, .26]} color={palette.white} rounded /><Block position={[-4.3, 1.41, -.307]} size={[1.02, .045, .02]} color={palette.metal} /></> : null}
  </group>
})

const LivingRoom = memo(function LivingRoom({ tvOn }: { tvOn: boolean }) {
  return <group>
    <Block position={[-3.22, .065, 2.08]} size={[3.8, .045, 3.2]} color="#c7beb0" surface="fabric" rounded />
    {/* Fine woven lines add material detail without texture downloads. */}
    {Array.from({ length: 17 }, (_, i) => <Block key={i} position={[-3.22, .091, .62 + i * .18]} size={[3.67, .003, .012]} color="#d7d3c4" />)}
    <Sofa position={[-2.05, .055, 1.9]} rotation={-Math.PI / 2} />
    <CoffeeTable position={[-3.6, .075, 2.0]} />
    <Television position={[-5.62, .06, 2.0]} on={tvOn} />
    <Plant position={[-5.2, .06, .25]} scale={1.25} />
    <Plant position={[-5.3, .06, 3.75]} scale={.9} />
    <Block position={[-1.1, .39, 3.8]} size={[.75, .69, .49]} color={palette.oakLight} rounded />
    <Block position={[-1.1, .77, 3.8]} size={[.3, .08, .24]} color={palette.sage} />
  </group>
})

const markerPositions: Record<string, [number, number, number]> = {
  'living-light': [-.95, 2.05, .15], 'living-ac': [-4.3, 1.98, -.22], 'living-fan': [-2.6, 2.9, 1.6],
  'living-tv': [-5.5, 1.8, 2.0], 'living-sensor': [-3.55, .8, 3.3], 'bedroom-light': [-5.47, 1.43, -4.08],
  'kitchen-light': [3.15, 2.45, 2.55], 'bathroom-motion': [.4, 1.6, -2.8], 'office-light': [4.5, 1.5, -4.2], 'garden-motion': [8.6, 1.5, -1.1],
}
const icons = { light: Lightbulb, ac: Snowflake, fan: Fan, tv: Monitor, temperature: Thermometer, motion: Activity }
function DeviceMarkers({ devices, selectedRoom, selectedDevice, onDeviceSelect }: Pick<HouseSceneProps, 'devices' | 'selectedRoom' | 'selectedDevice' | 'onDeviceSelect'>) {
  return <group>{devices.filter(device => device.room === selectedRoom).map(device => {
    const Icon = icons[device.kind]
    return <Html key={device.id} position={markerPositions[device.id.replace(/^floor-[23]-/, '')]} center zIndexRange={[12, 2]}><button className={`scene-marker${selectedDevice === device.id ? ' selected' : ''}${!device.online ? ' offline' : ''}`} title={device.name} aria-label={`Chọn ${device.name}`} aria-pressed={selectedDevice === device.id} onClick={event => { event.stopPropagation(); onDeviceSelect(device.id) }}><Icon size={15} strokeWidth={1.8} /></button></Html>
  })}</group>
}

function RoomFloors({ rooms, roomView, selectedRoom, hovered, onRoomSelect }: { rooms: Room[]; roomView: boolean; selectedRoom: RoomId; hovered: RoomId | null; onRoomSelect: HouseSceneProps['onRoomSelect'] }) {
  return <group>{rooms.map(room => {
    const selected = room.id === selectedRoom
    const [x, , z] = room.center
    const [w, d] = room.size
    const corners: [number, number, number][] = [[x - w / 2 + .1, .145, z - d / 2 + .1], [x + w / 2 - .1, .145, z - d / 2 + .1], [x + w / 2 - .1, .145, z + d / 2 - .1], [x - w / 2 + .1, .145, z + d / 2 - .1], [x - w / 2 + .1, .145, z - d / 2 + .1]]
    return <group key={room.id}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, .135, z]}><planeGeometry args={[w - .2, d - .2]} /><meshBasicMaterial color={palette.blue} transparent opacity={selected ? .018 : hovered === room.id ? .04 : 0} depthWrite={false} /></mesh>
      {selected || hovered === room.id ? <Line points={corners} color={palette.blue} lineWidth={selected ? 1.6 : 1} transparent opacity={selected ? .65 : .4} /> : null}
      {!roomView || selected ? <Html position={[x, .25, z + d / 2 - .5]} center zIndexRange={[8, 1]}><button className={`room-label${selected ? ' selected' : ''}`} aria-label={`Chọn phòng ${room.name}`} aria-pressed={selected} onClick={event => { event.stopPropagation(); onRoomSelect(room.id) }}>{room.name}</button></Html> : null}
    </group>
  })}</group>
}

function fitRoomZoom(room: Room, viewport: { width: number; height: number }) {
  const right = new Vector3(roomDirection.z, 0, -roomDirection.x).normalize()
  const up = new Vector3().crossVectors(roomDirection.clone().normalize(), right).normalize()
  const width = room.size[0] * Math.abs(right.x) + room.size[1] * Math.abs(right.z)
  const height = room.size[0] * Math.abs(up.x) + room.size[1] * Math.abs(up.z) + 2.8 * Math.abs(up.y)
  return Math.min((viewport.width - 100) / width, Math.max(180, viewport.height - 110) / height) * .95
}

function CameraRig({ rooms, roomView, command, selectedRoom, tool, reducedMotion }: Pick<HouseSceneProps, 'rooms' | 'roomView' | 'command' | 'selectedRoom' | 'tool'> & { reducedMotion: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const size = useThree(state => state.size)
  const get = useThree(state => state.get)
  const animation = useRef<{ elapsed: number; position: Vector3; target: Vector3; zoom: number; endPosition: Vector3; endTarget: Vector3; endZoom: number } | null>(null)
  const selectedRef = useRef(selectedRoom)
  const roomsRef = useRef(rooms)
  const viewportRef = useRef(size)
  const roomViewRef = useRef(roomView)
  const homeZoom = Math.min((size.width - 80) / modelWidth, Math.max(220, size.height - 145) / modelHeight) * .98
  const homeZoomRef = useRef(homeZoom)
  useEffect(() => { selectedRef.current = selectedRoom; homeZoomRef.current = homeZoom; roomsRef.current = rooms; viewportRef.current = size; roomViewRef.current = roomView }, [selectedRoom, homeZoom, rooms, size, roomView])

  useEffect(() => {
    const { camera } = get()
    if (!(camera instanceof OrthographicCamera) || !controls.current) return
    // Responsive resizing preserves the view direction and room target.
    const activeRoom = roomsRef.current.find(room => room.id === selectedRef.current)!
    camera.zoom = roomViewRef.current ? fitRoomZoom(activeRoom, viewportRef.current) : homeZoom
    camera.up.set(0, 1, 0)
    camera.updateProjectionMatrix()
    camera.lookAt(controls.current.target)
    camera.updateMatrixWorld()
  }, [get, homeZoom])

  useEffect(() => {
    const { camera } = get()
    if (!(camera instanceof OrthographicCamera) || !controls.current) return
    const orbit = controls.current
    // Clear any residual drag before programmatic movement, so damping cannot
    // keep pushing a reset/focus animation away from its intended orbit.
    const damping = orbit.enableDamping
    orbit.enableDamping = false
    orbit.update()
    orbit.enableDamping = damping
    let endTarget = orbit.target.clone()
    let endPosition = camera.position.clone()
    let endZoom = camera.zoom
    if (command.type === 'reset') { endTarget = homeTarget.clone(); endPosition = homeTarget.clone().add(homeDirection); endZoom = homeZoomRef.current }
    if (command.type === 'focus') {
      const room = roomsRef.current.find(r => r.id === selectedRef.current)!
      endTarget = new Vector3(room.center[0], 1.05, room.center[2])
      endPosition = endTarget.clone().add(roomDirection)
      endZoom = fitRoomZoom(room, viewportRef.current)
    }
    if (command.type === 'zoomIn') endZoom = Math.min(homeZoomRef.current * 3.6, camera.zoom * 1.2)
    if (command.type === 'zoomOut') endZoom = Math.max(homeZoomRef.current * .6, camera.zoom / 1.2)
    camera.up.set(0, 1, 0)
    if (reducedMotion || command.nonce === 0) { camera.position.copy(endPosition); camera.zoom = endZoom; camera.updateProjectionMatrix(); orbit.target.copy(endTarget); orbit.update(); camera.lookAt(endTarget); camera.updateMatrixWorld(); animation.current = null }
    else animation.current = { elapsed: 0, position: camera.position.clone(), target: orbit.target.clone(), zoom: camera.zoom, endPosition, endTarget, endZoom }
  }, [command.nonce, command.type, get, reducedMotion])

  useFrame(({ camera }, delta) => {
    const state = animation.current
    if (!state || !controls.current || !(camera instanceof OrthographicCamera)) return
    state.elapsed += delta
    const progress = Math.min(1, state.elapsed / .68)
    const t = progress * progress * (3 - 2 * progress)
    camera.position.lerpVectors(state.position, state.endPosition, t)
    controls.current.target.lerpVectors(state.target, state.endTarget, t)
    camera.zoom = state.zoom + (state.endZoom - state.zoom) * t
    camera.updateProjectionMatrix()
    controls.current.update()
    camera.lookAt(controls.current.target)
    camera.updateMatrixWorld()
    if (progress === 1) animation.current = null
  })
  return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={.09} minPolarAngle={minPolarAngle} maxPolarAngle={maxPolarAngle} minZoom={homeZoom * .6} maxZoom={homeZoom * 3.6} mouseButtons={{ LEFT: tool === 'pan' ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }} onStart={() => { animation.current = null }} />
}

function RoomCutaway({ room, enabled }: { room: Room; enabled: boolean }) {
  const get = useThree(state => state.get)
  const [x, , z] = room.center
  const [width, depth] = room.size
  useEffect(() => {
    const renderer = get().gl
    const previous = renderer.clippingPlanes
    renderer.clippingPlanes = enabled ? [
      new Plane(new Vector3(1, 0, 0), -(x - width / 2 - .26)),
      new Plane(new Vector3(-1, 0, 0), x + width / 2 + .26),
      new Plane(new Vector3(0, 0, 1), -(z - depth / 2 - .26)),
      new Plane(new Vector3(0, 0, -1), z + depth / 2 + .26),
    ] : []
    return () => { renderer.clippingPlanes = previous }
  }, [get, enabled, x, z, width, depth])
  return null
}

function SceneContents(props: HouseSceneProps & { reducedMotion: boolean }) {
  const [hovered, setHovered] = useState<RoomId | null>(null)
  const room = props.rooms.find(item => item.id === props.selectedRoom)!
  const visible = (id: RoomId) => !props.roomView || props.selectedRoom === id
  const livingLight = props.devices.find(d => d.id.endsWith('living-light'))!
  const bedLight = props.devices.find(d => d.id.endsWith('bedroom-light'))!
  const kitchenLight = props.devices.find(d => d.id.endsWith('kitchen-light'))!
  const officeLight = props.devices.find(d => d.id.endsWith('office-light'))!
  const fan = props.devices.find(d => d.id.endsWith('living-fan'))!
  return <>
    <ambientLight intensity={props.night ? .25 : .3} color={props.night ? '#aec8e2' : '#fff6e9'} />
    <hemisphereLight args={['#e3edf4', '#a68a6d', props.night ? .48 : .7]} />
    <directionalLight position={[-5, 12, 7]} intensity={props.night ? .45 : 2.5} color={props.night ? '#adcce9' : '#fff1df'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={13} shadow-camera-bottom={-13} shadow-normalBias={.018} shadow-bias={-.00008} shadow-radius={4} />
    <directionalLight position={[6, 8, -6]} intensity={props.night ? .2 : .45} color="#d4e7f5" />
    <Environment resolution={128} frames={1} environmentIntensity={props.night ? .13 : .24}>
      <Lightformer form="rect" intensity={3} color="#fff5e8" scale={[12, 8, 1]} position={[-6, 8, 5]} rotation={[-Math.PI / 4, -.4, 0]} />
      <Lightformer form="rect" intensity={1.5} color="#dfedf8" scale={[8, 5, 1]} position={[8, 5, -3]} rotation={[0, -Math.PI / 2, 0]} />
    </Environment>
    <group onClick={event => { if (props.tool !== 'select' || event.delta > 5) return; event.stopPropagation(); props.onRoomSelect(props.roomView ? props.selectedRoom : roomByPoint(event.point.x, event.point.z)) }} onDoubleClick={event => { event.stopPropagation(); props.onRoomSelect(props.roomView ? props.selectedRoom : roomByPoint(event.point.x, event.point.z)) }} onPointerMove={event => { if (props.tool === 'select') setHovered(props.roomView ? props.selectedRoom : roomByPoint(event.point.x, event.point.z)) }} onPointerLeave={() => setHovered(null)}>
      <Architecture detailRoom={props.roomView ? room : undefined} />
      {visible('living') ? <><LivingRoom tvOn={props.devices.find(d => d.id.endsWith('living-tv'))?.on ?? false} /><StandingLamp position={[-.85, .06, .1]} on={livingLight.on} brightness={livingLight.brightness} warmth={livingLight.warmth} /><CeilingFan on={fan.on} speed={fan.speed} reducedMotion={props.reducedMotion} /></> : null}
      {visible('bedroom') ? <><Bed accent={props.floor === 'floor-2' ? '#c5a592' : props.floor === 'floor-3' ? '#9fbbca' : '#a5b8ae'} /><StandingLamp variant="table" position={[-5.47, .735, -4.08]} on={bedLight.on} brightness={bedLight.brightness} warmth={bedLight.warmth} /></> : null}
      {visible('kitchen') ? <><Kitchen /><StandingLamp variant="pendant" position={[3.15, 0, 2.55]} on={kitchenLight.on} brightness={kitchenLight.brightness} warmth={kitchenLight.warmth} /></> : null}
      {visible('bathroom') ? <Bathroom detailed={props.roomView} /> : null}
      {visible('office') ? <><Office /><StandingLamp variant="table" position={[4.5, .88, -4.2]} on={officeLight.on} brightness={officeLight.brightness} warmth={officeLight.warmth} /></> : null}
      {visible('garden') ? <Garden upperFloor={props.floor !== 'floor-1'} /> : null}
    </group>
    <RoomFloors rooms={props.rooms} roomView={props.roomView} selectedRoom={props.selectedRoom} hovered={hovered} onRoomSelect={props.onRoomSelect} />
    <DeviceMarkers devices={props.devices} selectedRoom={props.selectedRoom} selectedDevice={props.selectedDevice} onDeviceSelect={props.onDeviceSelect} />
    {/* A small analytic contact shadow stays anchored to the plinth when switching
        floor scenes; it needs no extra render target or offscreen scene pass. */}
    <mesh position={props.roomView ? [room.center[0], -.535, room.center[2]] : [1.7, -.535, -.25]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={props.roomView ? [room.size[0] + 1.7, room.size[1] + 1.7] : [18.8, 12.8]} /><shaderMaterial vertexShader={contactVertex} fragmentShader={contactFragment} transparent depthWrite={false} /></mesh>
    <RoomCutaway room={room} enabled={props.roomView} />
    <CameraRig rooms={props.rooms} roomView={props.roomView} command={props.command} selectedRoom={props.selectedRoom} tool={props.tool} reducedMotion={props.reducedMotion} />
  </>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="scene-error" role="alert">Không thể khởi tạo mô hình 3D. Hãy bật WebGL và tải lại trang.</div> : this.props.children }
}

export default function HouseScene(props: HouseSceneProps) {
  const reducedMotion = useReducedMotion()
  return <SceneBoundary><Canvas orthographic shadows={{ type: PCFShadowMap }} dpr={[1, 1.65]} camera={{ position: [18.7, 23.1, 22.7], zoom: 32, near: .1, far: 150 }} gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.03, powerPreference: 'high-performance' }} fallback={<div className="scene-error" role="alert">Trình duyệt cần hỗ trợ WebGL để mở mô hình 3D.</div>} aria-label="Mô hình nhà HESTA 3D, kéo để xoay và cuộn để thu phóng"><SurfaceProvider><SceneContents {...props} reducedMotion={reducedMotion} /></SurfaceProvider></Canvas></SceneBoundary>
}
