import { memo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Furniture } from '../neonplan/model';
import { interiorTransform } from './interiorLayout';
import { Armchair, Bed, Block, CoffeeTable, Cylinder, DiningChair, DiningTable, KitchenUnit, Plant, Sofa, TVBoard, Wardrobe } from './ApartmentInterior';
import type { ApartmentPalette } from './apartmentPalette';



function Legs({ p, height = .7 }: { p: ApartmentPalette; height?: number }) {
  return <>{[-.4, .4].flatMap((x) => [-.38, .38].map((z) => <Block key={`${x}:${z}`} at={[x, height / 2, z]} size={[.055, height, .055]} color={p.wood} />))}</>;
}
function Chair({ p, office = false, armchair = false }: { p: ApartmentPalette; office?: boolean; armchair?: boolean }) {
  return <group>
    <Block at={[0, .48, 0]} size={[.95, .15, .9]} color={armchair ? p.cushion : p.wall} radius={.1} />
    <Block at={[0, .78, .38]} size={[.95, .44, .15]} color={armchair ? p.cushion : p.wall} radius={.1} />
    {armchair ? [-.43, .43].map((x) => <Block key={x} at={[x, .65, 0]} size={[.14, .25, .95]} color={p.sofa} radius={.06} />) : null}
    {office ? <><Cylinder at={[0, .24, 0]} radius={.04} height={.48} color={p.metal} />{[0, 1, 2, 3, 4].map((i) => <group key={i} rotation={[0, i * Math.PI * 2 / 5, 0]}><Block at={[0, .07, .22]} size={[.065, .07, .5]} color={p.metal} /><Cylinder at={[0, .04, .4]} radius={.045} height={.06} color={p.dark} /></group>)}</> : <Legs p={p} height={.43} />}
  </group>;
}
function Table({ p, desk = false }: { p: ApartmentPalette; desk?: boolean }) {
  return <group><Legs p={p} height={.91} /><Block at={[0, .95, 0]} size={[1, .1, 1]} radius={.08} color={p.woodLight} />
    {desk ? <><Block at={[0, 1.02, .12]} size={[.45, .02, .27]} color={p.dark} /><Block at={[0, 1.23, .27]} size={[.55, .38, .04]} color={p.dark} /><Block at={[0, 1.23, .245]} size={[.5, .33, .015]} color={p.sofa} /><Block at={[0, 1.08, .27]} size={[.035, .2, .035]} color={p.metal} /></> : <group position={[0, 1.01, 0]} scale={.22}><Plant p={p} at={[0, 0, 0]} /></group>}
  </group>;
}
function Cabinet({ p, low = false, shelf = false }: { p: ApartmentPalette; low?: boolean; shelf?: boolean }) {
  return <group>
    {shelf ? <><Block at={[0, .5, -.47]} size={[1, 1, .06]} color={p.woodLight} />{[-.47, .47].map((x) => <Block key={x} at={[x, .5, 0]} size={[.06, 1, 1]} color={p.woodLight} />)}{[.02, .27, .52, .77, .98].map((y, i) => <group key={y}><Block at={[0, y, 0]} size={[.94, .035, 1]} color={p.woodLight} />{i < 4 ? [-.32, -.18, -.04, .1, .24].map((x, j) => <Block key={x} at={[x, y + .1, .12]} size={[.1, .17 + (j % 2) * .02, .55]} color={[p.rug, p.cushion, p.sofa][(i + j) % 3]} />) : null}</group>)}</> : <><Block at={[0, .5, 0]} size={[1, 1, 1]} color={p.woodLight} radius={.04} />{[-.25, .25].map((x) => <group key={x}><Block at={[x, .51, .505]} size={[.47, .94, .025]} color={p.wall} /><Block at={[x + (x < 0 ? .17 : -.17), low ? .75 : .52, .535]} size={[low ? .2 : .025, low ? .025 : .15, .03]} color={p.brass} /></group>)}</>}
  </group>;
}
function Sink({ p }: { p: ApartmentPalette }) {
  return <group><Cabinet p={p} low /><Block at={[0, 1, 0]} size={[1.04, .08, 1.03]} color={p.wall} radius={.06} /><Block at={[0, 1.05, -.02]} size={[.7, .035, .62]} color={p.metal} radius={.12} /><Block at={[0, 1.07, -.02]} size={[.54, .025, .46]} color={p.dark} radius={.1} /><Cylinder at={[0, 1.24, .32]} radius={.025} height={.35} color={p.brass} /><Block at={[0, 1.41, .2]} size={[.05, .05, .28]} color={p.brass} /></group>;
}
function Bathroom({ p, kind }: { p: ApartmentPalette; kind: string }) {
  if (kind === 'wc') return <group><Block at={[0, .3, .02]} size={[.66, .6, .7]} color={p.surface} radius={.2} /><Block at={[0, .58, -.12]} size={[.94, .14, .9]} color={p.wall} radius={.2} /><Block at={[0, .65, -.12]} size={[.67, .04, .62]} color={p.surface} radius={.18} /><Block at={[0, .77, .32]} size={[.9, .46, .3]} color={p.surface} radius={.08} /><Block at={[.2, 1.01, .32]} size={[.15, .02, .09]} color={p.brass} /></group>;
  if (kind === 'bathtub') return <group><Block at={[0, .45, 0]} size={[1, .9, 1]} color={p.surface} radius={.17} /><Block at={[0, .91, 0]} size={[.84, .06, .74]} color={p.wall} radius={.16} /><Block at={[0, .94, 0]} size={[.72, .025, .6]} color={p.glass} radius={.13} /><Cylinder at={[.34, .99, .3]} radius={.025} height={.2} color={p.brass} /></group>;
  return <group><Block at={[0, .035, 0]} size={[1, .07, 1]} color={p.surface} radius={.06} /><mesh position={[-.48, .53, 0]} castShadow><boxGeometry args={[.025, .96, 1]} /><meshStandardMaterial color={p.glass} transparent opacity={.24} roughness={.18} depthWrite={false} /></mesh><Block at={[.2, .55, .45]} size={[.025, .85, .025]} color={p.brass} /><Block at={[.2, .97, .3]} size={[.035, .035, .34]} color={p.brass} /><Cylinder at={[.2, .94, .15]} radius={.12} height={.025} color={p.brass} /></group>;
}
function FurnitureAsset({ type, p }: { type: string; p: ApartmentPalette }) {
  switch (type) {
    case 'sofa': return <group rotation={[0, Math.PI, 0]}><Sofa p={p} /></group>;
    case 'bed': return <Bed p={p} />;
    case 'coffee_table': return <CoffeeTable p={p} />;
    case 'kitchen': return <KitchenUnit p={p} />;
    case 'plant': return <Plant at={[0, 0, 0]} p={p} />;
    case 'armchair': return <Armchair p={p} />;
    case 'chair': return <DiningChair p={p} />;
    case 'office_chair': return <Chair p={p} office />;
    case 'table': return <DiningTable p={p} />;
    case 'desk': return <Table p={p} desk />;
    case 'tv_board': return <TVBoard p={p} />;
    case 'wardrobe': return <group rotation={[0, Math.PI / 2, 0]}><Wardrobe p={p} /></group>;
    case 'sink': case 'washbasin': return <Sink p={p} />;
    case 'shower': case 'wc': case 'bathtub': return <Bathroom p={p} kind={type} />;
    case 'fridge': return <group><Block at={[0, .5, 0]} size={[1, 1, 1]} color={p.wall} radius={.055} />{[.28, .76].map((y) => <Block key={y} at={[0, y, -.515]} size={[.94, .45, .035]} color={p.surface} />)}<Block at={[-.35, .59, -.55]} size={[.025, .13, .025]} color={p.brass} /></group>;
    case 'lamp_floor': return <group><Cylinder at={[0, .035, 0]} radius={.45} height={.07} color={p.brass} /><Cylinder at={[0, .45, 0]} radius={.035} height={.9} color={p.brass} /><mesh position={[0, .86, 0]} castShadow><cylinderGeometry args={[.3, .5, .28, 24, 1, true]} /><meshStandardMaterial color={p.wall} side={2} /></mesh></group>;
    default: return <Cabinet p={p} low={type === 'nightstand' || type === 'tv_board'} shelf={type === 'shelf'} />;
  }
}

/** Same assets as the demo; only the saved transform comes from the real room. */
export const InteriorFurniture = memo(function InteriorFurniture({ item, palette, roomId, onSelect, onFocus }: {
  item: Furniture; palette: ApartmentPalette; roomId?: string; onSelect: (id: string) => void; onFocus: (id: string) => void;
}) {
  const transform = interiorTransform(item);
  const select = (event: ThreeEvent<MouseEvent>, focus: boolean) => { if (!roomId || event.delta > 3) return; event.stopPropagation(); (focus ? onFocus : onSelect)(roomId); };
  return <group name={`interior:${item.id}`} userData={{ interiorModel: item.type, roomId }} {...transform} onClick={(event) => select(event, false)} onDoubleClick={(event) => select(event, true)}>
    <FurnitureAsset type={item.type} p={palette} />
  </group>;
});
