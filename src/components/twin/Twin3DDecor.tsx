import { memo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type { Group } from 'three';
import type { Twin3DBounds, Twin3DRoomGeometry } from './twin3dGeometry';
import { TWIN_FLOOR_HEIGHT } from './twin3dGeometry';
import type { Twin3DPalette } from './twin3dPalette';
import { roomKind } from './roomKind';

type Vec3 = [number, number, number];

function Block({ position, size, color, rotation = [0, 0, 0], radius = 0, opacity = 1, metalness = 0, roughness = 0.72 }: {
  position: Vec3;
  size: Vec3;
  color: string;
  rotation?: Vec3;
  radius?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
}) {
  if (radius > 0) return <RoundedBox castShadow receiveShadow position={position} rotation={rotation} args={size} radius={Math.min(radius, ...size.map((value) => value / 3))} smoothness={3}>
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} transparent={opacity < 1} opacity={opacity} />
  </RoundedBox>;
  return <mesh castShadow receiveShadow position={position} rotation={rotation}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} transparent={opacity < 1} opacity={opacity} />
  </mesh>;
}

function Plant({ position, scale = 1, palette }: { position: Vec3; scale?: number; palette: Twin3DPalette }) {
  const leaves: Vec3[] = [[0, .58, 0], [-.14, .48, .04], [.14, .43, -.04], [-.08, .7, -.05], [.08, .65, .07]];
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, .14, 0]}><cylinderGeometry args={[.19, .14, .28, 16]} /><meshStandardMaterial color={palette.woodLight} roughness={.82} /></mesh>
    <mesh castShadow position={[0, .42, 0]}><cylinderGeometry args={[.025, .04, .5, 10]} /><meshStandardMaterial color={palette.leafDark} roughness={.9} /></mesh>
    {leaves.map((leaf, index) => <mesh key={index} castShadow position={leaf} scale={[.18, .3, .12]} rotation={[0, index * .9, index % 2 ? -.35 : .35]}>
      <sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color={index % 2 ? palette.leafDark : palette.leaf} roughness={.85} />
    </mesh>)}
  </group>;
}

function Table({ position, width, depth, height, palette }: { position: Vec3; width: number; depth: number; height: number; palette: Twin3DPalette }) {
  const legX = width / 2 - .12;
  const legZ = depth / 2 - .12;
  return <group position={position}>
    <Block position={[0, height, 0]} size={[width, .12, depth]} color={palette.woodLight} radius={.06} />
    {([[-legX, legZ], [legX, legZ], [-legX, -legZ], [legX, -legZ]] as [number, number][]).map(([x, z], index) => <Block key={index} position={[x, height / 2, z]} size={[.11, height, .11]} color={palette.wood} radius={.025} />)}
  </group>;
}

function FloorPattern({ room, kind, palette }: { room: Twin3DRoomGeometry; kind: string; palette: Twin3DPalette }) {
  const insetWidth = Math.max(.5, room.width - .28);
  const insetDepth = Math.max(.5, room.depth - .28);
  if (kind === 'bathroom') {
    const columns = Math.max(3, Math.min(9, Math.round(room.width / .8)));
    const rows = Math.max(3, Math.min(8, Math.round(room.depth / .8)));
    return <group position={[0, TWIN_FLOOR_HEIGHT + .012, 0]}>
      {Array.from({ length: columns - 1 }, (_, index) => <Block key={`x${index}`} position={[-insetWidth / 2 + insetWidth * (index + 1) / columns, 0, 0]} size={[.018, .012, insetDepth]} color={palette.line} roughness={1} />)}
      {Array.from({ length: rows - 1 }, (_, index) => <Block key={`z${index}`} position={[0, 0, -insetDepth / 2 + insetDepth * (index + 1) / rows]} size={[insetWidth, .012, .018]} color={palette.line} roughness={1} />)}
    </group>;
  }
  const rows = Math.max(5, Math.min(13, Math.round(room.depth / .45)));
  return <group position={[0, TWIN_FLOOR_HEIGHT + .012, 0]}>
    {Array.from({ length: rows - 1 }, (_, index) => <Block key={index} position={[0, 0, -insetDepth / 2 + insetDepth * (index + 1) / rows]} size={[insetWidth, .012, .018]} color={palette.wood} opacity={.28} roughness={1} />)}
  </group>;
}

function Window({ position, width, rotation = [0, 0, 0], palette }: { position: Vec3; width: number; rotation?: Vec3; palette: Twin3DPalette }) {
  return <group position={position} rotation={rotation}>
    <Block position={[0, 0, 0]} size={[width, .96, .035]} color={palette.glass} opacity={.64} roughness={.18} />
    <Block position={[0, .51, .01]} size={[width + .14, .09, .08]} color={palette.surface} />
    <Block position={[0, -.51, .01]} size={[width + .14, .09, .08]} color={palette.surface} />
    <Block position={[-width / 2 - .03, 0, .01]} size={[.09, 1.1, .08]} color={palette.surface} />
    <Block position={[width / 2 + .03, 0, .01]} size={[.09, 1.1, .08]} color={palette.surface} />
    <Block position={[0, 0, .01]} size={[.06, 1.04, .07]} color={palette.surface} />
  </group>;
}

function ArchitectureDetails({ room, palette }: { room: Twin3DRoomGeometry; palette: Twin3DPalette }) {
  const backWindow = useRef<Group>(null);
  const sideWindow = useRef<Group>(null);
  const door = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (backWindow.current) backWindow.current.visible = camera.position.z >= room.z;
    if (sideWindow.current) sideWindow.current.visible = camera.position.x >= room.x;
    if (door.current) door.current.visible = camera.position.z <= room.z;
  });
  const windowWidth = Math.min(2.1, Math.max(1.15, room.width * .3));
  return <>
    <group ref={backWindow}><Window position={[0, 1.35, -room.depth / 2 - .065]} width={windowWidth} palette={palette} /></group>
    <group ref={sideWindow}><Window position={[-room.width / 2 - .065, 1.28, 0]} width={Math.min(1.7, Math.max(1.05, room.depth * .28))} rotation={[0, Math.PI / 2, 0]} palette={palette} /></group>
    <group ref={door} position={[room.width * .25, 1.12, room.depth / 2 + .068]}>
      <Block position={[0, 0, 0]} size={[.92, 1.92, .06]} color={palette.wood} roughness={.86} />
      <Block position={[.32, 0, .045]} size={[.06, .06, .06]} color={palette.dark} metalness={.35} />
    </group>
  </>;
}

function PendantLight({ position, palette, scale = 1 }: { position: Vec3; palette: Twin3DPalette; scale?: number }) {
  return <group position={position} scale={scale}>
    <Block position={[0, .22, 0]} size={[.025, .44, .025]} color={palette.dark} metalness={.4} />
    <mesh castShadow position={[0, -.03, 0]}><coneGeometry args={[.22, .25, 24, 1, true]} /><meshStandardMaterial color={palette.dark} side={2} roughness={.42} /></mesh>
    <mesh position={[0, -.14, 0]}><sphereGeometry args={[.09, 16, 10]} /><meshStandardMaterial color={palette.surface} /></mesh>
  </group>;
}

function LivingRoom({ room, palette }: { room: Twin3DRoomGeometry; palette: Twin3DPalette }) {
  const sofaWidth = Math.min(3.55, room.width * .52);
  const sofaZ = room.depth * .24;
  return <>
    <Block position={[-.15, TWIN_FLOOR_HEIGHT + .035, .05]} size={[Math.min(4.3, room.width * .62), .05, Math.min(2.75, room.depth * .53)]} color={palette.rug} radius={.05} />
    <group position={[-room.width * .08, TWIN_FLOOR_HEIGHT, sofaZ]}>
      <Block position={[0, .38, 0]} size={[sofaWidth, .48, .92]} color={palette.fabric} radius={.14} />
      <Block position={[0, .78, .38]} size={[sofaWidth, .82, .25]} color={palette.fabricAccent} radius={.1} />
      <Block position={[-sofaWidth / 2 + .05, .56, 0]} size={[.25, .62, 1]} color={palette.fabricAccent} radius={.09} />
      <Block position={[sofaWidth / 2 - .05, .56, 0]} size={[.25, .62, 1]} color={palette.fabricAccent} radius={.09} />
      {[-.28, .28].map((x) => <Block key={x} position={[x, .67, .05]} size={[sofaWidth * .34, .22, .68]} color={palette.surface} radius={.08} />)}
      <Block position={[-sofaWidth * .28, .87, .18]} size={[.58, .42, .14]} color={palette.primary} radius={.08} />
      <Block position={[sofaWidth * .26, .87, .18]} size={[.58, .42, .14]} color={palette.mint} radius={.08} />
    </group>
    <Table position={[-.1, TWIN_FLOOR_HEIGHT, -.42]} width={1.65} depth={.84} height={.42} palette={palette} />
    <Block position={[-.1, TWIN_FLOOR_HEIGHT + .53, -.42]} size={[.34, .08, .22]} color={palette.surface} radius={.04} />
    <group position={[0, TWIN_FLOOR_HEIGHT, -room.depth * .34]}>
      <Block position={[0, .25, 0]} size={[2.15, .5, .5]} color={palette.wood} radius={.06} />
      <Block position={[0, 1.12, -.02]} size={[1.75, 1.05, .12]} color={palette.dark} radius={.05} roughness={.25} />
      <Block position={[0, 1.12, -.09]} size={[1.58, .88, .025]} color={palette.glass} opacity={.22} roughness={.05} />
    </group>
    <group position={[-room.width * .31, 1.3, -room.depth / 2 + .075]}>
      <Block position={[0, 0, 0]} size={[1.16, .82, .06]} color={palette.wood} radius={.04} />
      <Block position={[0, 0, .035]} size={[.98, .64, .025]} color={palette.infoSoft} />
      <Block position={[-.2, -.08, .055]} size={[.18, .32, .018]} color={palette.primary} />
      <Block position={[.18, .09, .055]} size={[.28, .19, .018]} color={palette.mint} />
    </group>
    <PendantLight position={[0, 1.94, -.2]} palette={palette} scale={1.15} />
    <Plant position={[-room.width * .39, TWIN_FLOOR_HEIGHT, -room.depth * .34]} scale={1.15} palette={palette} />
    <Plant position={[room.width * .39, TWIN_FLOOR_HEIGHT, room.depth * .3]} scale={.9} palette={palette} />
    <group position={[room.width * .31, TWIN_FLOOR_HEIGHT, -.55]}>
      <Block position={[0, .72, 0]} size={[.055, 1.44, .055]} color={palette.dark} metalness={.35} />
      <mesh castShadow position={[0, 1.52, 0]}><coneGeometry args={[.34, .48, 24, 1, true]} /><meshStandardMaterial color={palette.warningSoft} side={2} roughness={.7} /></mesh>
    </group>
  </>;
}

function Bedroom({ room, palette }: { room: Twin3DRoomGeometry; palette: Twin3DPalette }) {
  const bedWidth = Math.min(2.75, room.width * .45);
  const bedDepth = Math.min(3.15, room.depth * .58);
  const bedX = -.25;
  return <>
    <Block position={[bedX, TWIN_FLOOR_HEIGHT + .03, .22]} size={[bedWidth + .85, .045, bedDepth + .62]} color={palette.rug} radius={.06} />
    <group position={[bedX, TWIN_FLOOR_HEIGHT, -.15]}>
      <Block position={[0, .33, 0]} size={[bedWidth, .45, bedDepth]} color={palette.wood} radius={.1} />
      <Block position={[0, .62, .08]} size={[bedWidth - .08, .32, bedDepth - .2]} color={palette.surface} radius={.12} />
      <Block position={[0, .78, .38]} size={[bedWidth - .12, .12, bedDepth * .55]} color={palette.fabricAccent} radius={.07} />
      <Block position={[0, .84, -bedDepth / 2 + .12]} size={[bedWidth + .12, 1.34, .18]} color={palette.woodLight} radius={.08} />
      {[-bedWidth * .24, bedWidth * .24].map((x) => <Block key={x} position={[x, .88, -bedDepth * .3]} size={[bedWidth * .4, .2, .62]} color={palette.fabric} radius={.1} />)}
    </group>
    {[-1, 1].map((side) => <group key={side} position={[bedX + side * (bedWidth / 2 + .48), TWIN_FLOOR_HEIGHT, -bedDepth * .31]}>
      <Block position={[0, .28, 0]} size={[.62, .54, .58]} color={palette.wood} radius={.05} />
      <Block position={[0, .72, 0]} size={[.045, .42, .045]} color={palette.metal} metalness={.4} />
      <mesh castShadow position={[0, 1.03, 0]}><coneGeometry args={[.22, .34, 20]} /><meshStandardMaterial color={palette.warningSoft} /></mesh>
    </group>)}
    <group position={[room.width * .38, TWIN_FLOOR_HEIGHT, .12]}>
      <Block position={[0, .94, 0]} size={[1.08, 1.88, .56]} color={palette.surface} radius={.06} />
      <Block position={[-.03, .95, -.295]} size={[.025, 1.65, .04]} color={palette.line} />
      <Block position={[-.12, .96, -.33]} size={[.05, .18, .05]} color={palette.dark} metalness={.4} />
      <Block position={[.12, .96, -.33]} size={[.05, .18, .05]} color={palette.dark} metalness={.4} />
    </group>
    <group position={[-room.width * .28, 1.34, -room.depth / 2 + .075]}>
      <Block position={[0, 0, 0]} size={[1.12, .72, .06]} color={palette.wood} radius={.04} />
      <Block position={[0, 0, .04]} size={[.94, .54, .025]} color={palette.successSoft} />
    </group>
    <PendantLight position={[0, 1.96, .2]} palette={palette} scale={.9} />
    <Plant position={[-room.width * .4, TWIN_FLOOR_HEIGHT, room.depth * .31]} scale={.85} palette={palette} />
  </>;
}

function Kitchen({ room, palette }: { room: Twin3DRoomGeometry; palette: Twin3DPalette }) {
  const counterWidth = Math.max(2.8, room.width * .56);
  const backZ = -room.depth * .36;
  return <>
    <group position={[-room.width * .08, TWIN_FLOOR_HEIGHT, backZ]}>
      <Block position={[0, .43, 0]} size={[counterWidth, .82, .72]} color={palette.woodLight} radius={.05} />
      <Block position={[0, .88, 0]} size={[counterWidth + .1, .12, .82]} color={palette.surface} radius={.04} />
      {[-.32, 0, .32].map((ratio) => <Block key={ratio} position={[counterWidth * ratio, .43, .385]} size={[.025, .68, .03]} color={palette.wood} />)}
      <Block position={[-counterWidth * .22, .965, 0]} size={[.92, .025, .5]} color={palette.metal} metalness={.5} roughness={.25} />
      <mesh position={[-counterWidth * .22, 1.02, 0]}><torusGeometry args={[.15, .026, 10, 24, Math.PI]} /><meshStandardMaterial color={palette.dark} metalness={.55} /></mesh>
      {[-.18, .18].map((x) => <mesh key={x} position={[counterWidth * .2 + x, .965, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.11, .018, 8, 20]} /><meshStandardMaterial color={palette.dark} metalness={.4} /></mesh>)}
    </group>
    <group position={[-room.width * .08, TWIN_FLOOR_HEIGHT, backZ - .03]}>
      <Block position={[-counterWidth * .34, 1.54, 0]} size={[1.2, .66, .52]} color={palette.surface} radius={.05} />
      <Block position={[counterWidth * .34, 1.54, 0]} size={[1.2, .66, .52]} color={palette.surface} radius={.05} />
      <Block position={[-counterWidth * .34, 1.54, .275]} size={[.025, .48, .025]} color={palette.line} />
      <Block position={[counterWidth * .34, 1.54, .275]} size={[.025, .48, .025]} color={palette.line} />
    </group>
    <group position={[room.width * .34, TWIN_FLOOR_HEIGHT, backZ]}>
      <Block position={[0, 1.05, 0]} size={[1.02, 2.1, .8]} color={palette.metal} radius={.08} metalness={.24} roughness={.38} />
      <Block position={[0, 1.03, .415]} size={[.035, 1.75, .03]} color={palette.dark} />
      <Block position={[-.14, 1.15, .44]} size={[.04, .28, .04]} color={palette.dark} metalness={.5} />
      <Block position={[.14, 1.15, .44]} size={[.04, .28, .04]} color={palette.dark} metalness={.5} />
    </group>
    <group position={[-.1, TWIN_FLOOR_HEIGHT, room.depth * .16]}>
      <Block position={[0, .48, 0]} size={[2.7, .84, 1.08]} color={palette.surface} radius={.08} />
      <Block position={[0, .94, 0]} size={[2.84, .12, 1.2]} color={palette.woodLight} radius={.05} />
      <Block position={[.76, 1.02, 0]} size={[.5, .06, .32]} color={palette.mint} radius={.04} />
    </group>
    {[-.75, 0, .75].map((x) => <group key={x} position={[x - .1, TWIN_FLOOR_HEIGHT, room.depth * .37]}>
      <mesh castShadow position={[0, .58, 0]}><cylinderGeometry args={[.22, .22, .09, 20]} /><meshStandardMaterial color={palette.fabricAccent} /></mesh>
      <mesh castShadow position={[0, .3, 0]}><cylinderGeometry args={[.045, .045, .56, 12]} /><meshStandardMaterial color={palette.dark} metalness={.4} /></mesh>
      <mesh castShadow position={[0, .04, 0]}><cylinderGeometry args={[.18, .18, .05, 20]} /><meshStandardMaterial color={palette.dark} metalness={.35} /></mesh>
    </group>)}
    {[-.72, 0, .72].map((x) => <PendantLight key={x} position={[x - .1, 1.98, room.depth * .16]} palette={palette} scale={.78} />)}
    <Plant position={[-room.width * .42, TWIN_FLOOR_HEIGHT, room.depth * .33]} scale={.78} palette={palette} />
  </>;
}

function Bathroom({ room, palette }: { room: Twin3DRoomGeometry; palette: Twin3DPalette }) {
  return <>
    <group position={[-room.width * .25, TWIN_FLOOR_HEIGHT, -room.depth * .23]}>
      <Block position={[0, .3, 0]} size={[Math.min(2.55, room.width * .42), .58, 1.15]} color={palette.surface} radius={.22} />
      <Block position={[0, .48, 0]} size={[Math.min(2.25, room.width * .38), .38, .86]} color={palette.glass} opacity={.42} radius={.18} roughness={.14} />
      <mesh position={[-.82, .83, -.38]}><torusGeometry args={[.2, .026, 10, 24, Math.PI]} /><meshStandardMaterial color={palette.metal} metalness={.55} /></mesh>
    </group>
    <group position={[room.width * .28, TWIN_FLOOR_HEIGHT, -room.depth * .27]}>
      <Block position={[0, .42, 0]} size={[1.45, .78, .64]} color={palette.woodLight} radius={.06} />
      <Block position={[0, .85, 0]} size={[1.55, .12, .72]} color={palette.surface} radius={.05} />
      <mesh position={[0, .94, 0]} scale={[1.35, .42, 1]}><sphereGeometry args={[.28, 18, 10]} /><meshStandardMaterial color={palette.glass} roughness={.18} /></mesh>
      <mesh position={[0, 1.56, -.36]}><cylinderGeometry args={[.52, .52, .055, 32]} /><meshStandardMaterial color={palette.glass} metalness={.18} roughness={.12} /></mesh>
    </group>
    <group position={[room.width * .22, TWIN_FLOOR_HEIGHT, room.depth * .24]}>
      <Block position={[0, .24, 0]} size={[.8, .44, 1.12]} color={palette.surface} radius={.24} />
      <Block position={[0, .66, .34]} size={[.76, .82, .34]} color={palette.surface} radius={.13} />
      <Block position={[0, .31, -.18]} size={[.53, .09, .58]} color={palette.glass} opacity={.28} radius={.16} />
    </group>
    <Block position={[-room.width * .18, TWIN_FLOOR_HEIGHT + .03, room.depth * .27]} size={[1.48, .045, .8]} color={palette.primary} opacity={.3} radius={.16} />
    <group position={[-room.width * .45, TWIN_FLOOR_HEIGHT, room.depth * .18]}>
      <Block position={[0, 1.02, 0]} size={[.035, 2.02, .035]} color={palette.metal} metalness={.5} />
      <Block position={[.3, 1.93, 0]} size={[.62, .035, .035]} color={palette.metal} metalness={.5} />
      <mesh position={[.58, 1.83, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[.2, .16, 20]} /><meshStandardMaterial color={palette.metal} metalness={.5} /></mesh>
    </group>
    <PendantLight position={[0, 1.98, 0]} palette={palette} scale={.72} />
  </>;
}

function Office({ room, palette }: { room: Twin3DRoomGeometry; palette: Twin3DPalette }) {
  return <>
    <Block position={[0, TWIN_FLOOR_HEIGHT + .03, .1]} size={[Math.min(3.6, room.width * .58), .045, Math.min(2.5, room.depth * .5)]} color={palette.rug} radius={.05} />
    <Table position={[0, TWIN_FLOOR_HEIGHT, -room.depth * .22]} width={Math.min(2.7, room.width * .48)} depth={.82} height={.76} palette={palette} />
    <Block position={[0, TWIN_FLOOR_HEIGHT + 1.22, -room.depth * .25]} size={[1.18, .72, .08]} color={palette.dark} radius={.05} roughness={.25} />
    <Block position={[0, TWIN_FLOOR_HEIGHT + .87, -room.depth * .22]} size={[.08, .35, .08]} color={palette.metal} metalness={.5} />
    <group position={[0, TWIN_FLOOR_HEIGHT, .65]}>
      <Block position={[0, .46, 0]} size={[.82, .24, .78]} color={palette.fabricAccent} radius={.12} />
      <Block position={[0, .86, .31]} size={[.75, .72, .18]} color={palette.fabricAccent} radius={.1} />
      <Block position={[0, .25, 0]} size={[.07, .48, .07]} color={palette.dark} metalness={.4} />
    </group>
    <Plant position={[-room.width * .38, TWIN_FLOOR_HEIGHT, room.depth * .32]} palette={palette} />
  </>;
}

export const Twin3DRoomDecor = memo(function Twin3DRoomDecor({ room, name, palette, compact, shaped, showArchitecture = true, onSelect }: {
  room: Twin3DRoomGeometry;
  name: string;
  palette: Twin3DPalette;
  compact: boolean;
  shaped?: boolean;
  showArchitecture?: boolean;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const kind = roomKind(name);
  return <group onClick={onSelect}>
    {!shaped ? <FloorPattern room={room} kind={kind} palette={palette} /> : null}
    {!compact && !shaped && showArchitecture ? <ArchitectureDetails room={room} palette={palette} /> : null}
    <group scale={shaped ? [0.7, 1, 0.7] : [1, 1, 1]}>
      {kind === 'living' ? <LivingRoom room={room} palette={palette} /> : kind === 'bedroom' ? <Bedroom room={room} palette={palette} /> : kind === 'kitchen' ? <Kitchen room={room} palette={palette} /> : kind === 'bathroom' ? <Bathroom room={room} palette={palette} /> : kind === 'office' ? <Office room={room} palette={palette} /> : <><Table position={[0, TWIN_FLOOR_HEIGHT, 0]} width={Math.min(1.5, room.width * .4)} depth={Math.min(.8, room.depth * .4)} height={.5} palette={palette} /><Plant position={[-room.width * .3, TWIN_FLOOR_HEIGHT, room.depth * .3]} palette={palette} /></>}
    </group>
  </group>;
});

function Tree({ position, scale, palette }: { position: Vec3; scale: number; palette: Twin3DPalette }) {
  return <group position={position} scale={scale}>
    <mesh castShadow position={[0, .5, 0]}><cylinderGeometry args={[.08, .13, 1, 10]} /><meshStandardMaterial color={palette.wood} roughness={.95} /></mesh>
    <mesh castShadow position={[0, 1.18, 0]}><icosahedronGeometry args={[.55, 1]} /><meshStandardMaterial color={palette.leaf} roughness={.9} /></mesh>
    <mesh castShadow position={[-.28, 1.03, .08]}><icosahedronGeometry args={[.38, 1]} /><meshStandardMaterial color={palette.leafDark} roughness={.9} /></mesh>
    <mesh castShadow position={[.28, 1.03, -.05]}><icosahedronGeometry args={[.4, 1]} /><meshStandardMaterial color={palette.leaf} roughness={.9} /></mesh>
  </group>;
}

export const Twin3DLandscape = memo(function Twin3DLandscape({ bounds, palette, compact }: { bounds: Twin3DBounds; palette: Twin3DPalette; compact: boolean }) {
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;
  const trees: { position: Vec3; scale: number }[] = [
    { position: [bounds.centerX - halfW - .46, .02, bounds.centerZ - halfD + .8], scale: .78 },
    { position: [bounds.centerX + halfW + .46, .02, bounds.centerZ - halfD + 1.2], scale: .9 },
    { position: [bounds.centerX - halfW - .46, .02, bounds.centerZ + halfD - .8], scale: .7 },
    { position: [bounds.centerX + halfW + .46, .02, bounds.centerZ + halfD - 1.15], scale: .76 },
  ];
  return <group>
    <Block position={[bounds.centerX, -.09, bounds.centerZ]} size={[bounds.width + 1.2, .14, bounds.depth + 1.2]} color={palette.ground} radius={.28} />
    <Block position={[bounds.centerX + bounds.width * .24, -.005, bounds.centerZ + halfD + .35]} size={[1.8, .05, .8]} color={palette.off} radius={.1} />
    {!compact ? trees.map((tree, index) => <Tree key={index} position={tree.position} scale={tree.scale} palette={palette} />) : null}
    {[-.32, 0, .32].map((ratio) => <Plant key={ratio} position={[bounds.centerX + bounds.width * ratio, .01, bounds.centerZ - halfD - .32]} scale={.5} palette={palette} />)}
  </group>;
});
