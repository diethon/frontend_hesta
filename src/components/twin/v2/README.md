# Real-layout V2 furnishings

- `V2Furniture({ item })` renders one `Furniture` from `../neonplan/model`.
- `hasV2Furniture(type)` is exported by `furnitureSupport.ts`.
- `V2SurfaceProvider` is exported by `surfaces.tsx`; mount it once around furnishings inside the R3F Canvas.

The renderer owns saved x/z position, clockwise-in-Three.js conversion of the
editor rotation, explicit `mount_y` (including zero) and `builtinBase` fallback.
Geometry bounds are normalized to saved width/depth/height. Worktop, cabinet,
basin and tub heights refer to their structural top; small props, taps and screens
can extend above it, consistently with the previous architectural renderer.

These are individual visual assets, with no fixed mock-room arrangement. The bed
does not include bedside tables. The dining table does not include chairs. TV
screens are unlit, and there are no independent point lights or device states.
Saved unsupported types continue using the previous renderer.

Textures are bundled in `public/twin-v2-materials/`, use the deployment base path,
and have procedural fallbacks. Physical asset colors live in `materials.ts`,
separately from UI design tokens. Texture and custom geometry resources are
disposed on unmount; furnishings have no continuous animation/render loop.

See `public/twin-v2-materials/CREDITS.md` and `sources.json` for the CC0 surface maps.
