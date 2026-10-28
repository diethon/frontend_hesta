import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2 } from 'three'
import type { Texture } from 'three'

export type SurfaceKind = 'wood' | 'fabric' | 'stone' | 'plaster' | 'ceramic' | 'metal' | 'glass' | 'matte'
type TexturedKind = 'wood' | 'fabric' | 'stone' | 'plaster'
interface SurfaceMaps { map: CanvasTexture; bump: CanvasTexture; normal?: Texture; rough?: Texture }
type TextureLibrary = Record<TexturedKind, SurfaceMaps>
const TextureContext = createContext<TextureLibrary | null>(null)
const texturedKinds: TexturedKind[] = ['wood', 'fabric', 'stone', 'plaster']
const normalStrength = new Vector2(.24, .24)

// Small, deterministic physical surface maps. These are material detail only:
// the entire house, its furnishings and all picking remain real 3D geometry.
function createSurface(kind: TexturedKind): SurfaceMaps {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const pixels = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size; const v = y / size
      const noise = ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 7, 668265263)) >>> 0) / 4294967295 - .5
      let tone: number
      if (kind === 'wood') {
        const warp = Math.sin(u * Math.PI * 2) * 1.8 + Math.sin(u * Math.PI * 6) * .32
        const grain = Math.sin(v * Math.PI * 180 + warp)
        tone = .9 + grain * .035 + Math.sin(v * Math.PI * 26 + warp * .3) * .026 + noise * .025
      } else if (kind === 'fabric') {
        const warp = (x % 4 < 2 ? .025 : -.025) + (y % 4 < 2 ? .018 : -.018)
        tone = .94 + warp + noise * .035
      } else if (kind === 'stone') {
        const vein = Math.sin((u + v * .63) * 25 + Math.sin(v * 12) * 1.8 + Math.sin(u * 9) * .8)
        tone = .965 - Math.pow(Math.abs(vein), 24) * .035 + noise * .012
      } else tone = .96 + noise * .035
      const i = (y * size + x) * 4
      pixels.data[i] = Math.round(tone * 255)
      pixels.data[i + 1] = Math.round(tone * 255)
      pixels.data[i + 2] = Math.round(tone * 255)
      pixels.data[i + 3] = 255
    }
  }
  ctx.putImageData(pixels, 0, 0)
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  const bump = new CanvasTexture(canvas)
  for (const texture of [map, bump]) {
    texture.wrapS = texture.wrapT = RepeatWrapping
    texture.anisotropy = 4
    const repeat = kind === 'fabric' ? 3 : kind === 'plaster' ? 2 : 1
    texture.repeat.set(repeat, repeat)
  }
  return { map, bump }
}

export function SurfaceProvider({ children }: { children: ReactNode }) {
  const [textures, setTextures] = useState<TextureLibrary | null>(null)
  useEffect(() => {
    let active = true
    const library = Object.fromEntries(texturedKinds.map(kind => [kind, createSurface(kind)])) as TextureLibrary
    const scanned: Texture[] = []
    const loader = new TextureLoader()
    // Scanned CC0 microdetail is bundled locally; runtime never contacts an asset API.
    const scans = [
      { kind: 'wood' as const, asset: 'wood_table_001' },
      { kind: 'fabric' as const, asset: 'denim_fabric' },
    ]
    void Promise.all(scans.flatMap(({ kind, asset }) => [
      { channel: 'normal' as const, suffix: 'nor_gl' },
      { channel: 'rough' as const, suffix: 'rough' },
    ].map(async ({ channel, suffix }) => {
      const texture = await loader.loadAsync(`/materials/${asset}_${suffix}.jpg`)
      if (!active) { texture.dispose(); return }
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.anisotropy = 4
      texture.repeat.set(kind === 'fabric' ? 3 : 1, kind === 'fabric' ? 3 : 1)
      scanned.push(texture)
      library[kind] = { ...library[kind], [channel]: texture }
    }))).then(() => { if (active) setTextures({ ...library }) }).catch(() => {
      // Procedural maps remain usable if a local texture cannot be decoded.
      if (active) setTextures({ ...library })
    })
    return () => {
      active = false
      for (const maps of Object.values(library)) { maps.map.dispose(); maps.bump.dispose() }
      for (const texture of scanned) texture.dispose()
    }
  }, [])
  // Mount furnishings once with their final maps, avoiding three consecutive
  // shader compilations (untextured, bump-only, then scanned normal maps).
  return <TextureContext.Provider value={textures}>{textures ? children : null}</TextureContext.Provider>
}

export function SurfaceMaterial({ kind = 'matte', color, roughness }: { kind?: SurfaceKind; color: string; roughness?: number }) {
  const textures = useContext(TextureContext)
  const maps = kind === 'wood' || kind === 'fabric' || kind === 'stone' || kind === 'plaster' ? textures?.[kind] : undefined
  if (kind === 'glass') return <meshPhysicalMaterial color={color} roughness={roughness ?? .09} metalness={.05} transparent opacity={.2} depthWrite={false} side={2} envMapIntensity={.8} />
  if (kind === 'ceramic') return <meshPhysicalMaterial color={color} roughness={roughness ?? .22} clearcoat={.4} clearcoatRoughness={.12} envMapIntensity={.65} />
  return <meshStandardMaterial color={color} map={maps?.map} bumpMap={maps?.normal ? undefined : maps?.bump} normalMap={maps?.normal} normalScale={normalStrength} roughnessMap={maps?.rough}
    bumpScale={kind === 'wood' ? .0025 : kind === 'fabric' ? .004 : kind === 'plaster' ? .001 : .0008}
    roughness={roughness ?? (kind === 'fabric' ? 1 : kind === 'metal' ? .24 : kind === 'wood' ? .82 : kind === 'stone' ? .32 : .85)}
    metalness={kind === 'metal' ? .85 : .015} envMapIntensity={kind === 'metal' ? .8 : .3} />
}
