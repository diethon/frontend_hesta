# HESTA 3D Digital Twin Viewer

## Scope and source of truth

The 3D viewer is a frontend-only visualization derived from the existing Twin
runtime Redux state and Twin Layout API response. It does not add or persist 3D
coordinates, wall heights, furniture, doors, windows, floors, or architectural
measurements. The existing 2D editor remains the authoring surface. The
one-based `floor` field is persisted by the Twin Layout API; existing rooms
without it are normalized to floor 1.

The attached roofless smart-home reference guided the isometric camera, bright
neutral room surfaces, floating labels, compact markers, selection inspector,
2D/3D switch, and the richer furnished scene. Because HESTA does not store
architectural or furniture geometry, furniture, windows, doors, floor patterns,
lighting fixtures, and landscaping are deterministic presentation-only decor.
They are selected from the room name, never written to the API, and are not
presented as measured physical-house data.

## Coordinate conversion

`src/components/twin/twin3dGeometry.ts` owns the pure conversion layer:

- backend normalized `x` maps to Three.js world X;
- backend normalized `y` maps to Three.js world Z;
- Three.js Y is presentation elevation only;
- the world is centered around the origin for orbit controls;
- `TWIN_WORLD_WIDTH = 18` and `TWIN_WORLD_DEPTH = 12` are frontend constants;
- `TWIN_ROOM_WALL_HEIGHT = 2.25` is frontend presentation only;
- node IDs and room IDs are preserved exactly.

Conceptually:

```text
worldX = normalizedX * WORLD_WIDTH - WORLD_WIDTH / 2
worldZ = normalizedY * WORLD_DEPTH - WORLD_DEPTH / 2
```

Room width and depth are derived directly from normalized `width` and `height`.
No converted world value enters a PUT request.

## Scene architecture

- `TwinLayoutEditor` owns the local 2D/3D view choice and lazy-loads 3D code.
- `Twin3DView` supplies the responsive shell, stats, empty/fallback states,
  unplaced counts, floor selector, stack/explode control, and selected-object
  inspector.
- `Twin3DCanvas` owns React Three Fiber rendering only.
- Each room renders a floor slab, four roofless walls, floor pattern, windows,
  door, lights, and deterministic low-poly furniture. Known living-room,
  bedroom, kitchen, and bathroom names receive purpose-built furnishings;
  unknown names receive a neutral office arrangement.
- The house sits on a presentation-only garden plinth with plants, trees, and
  an entry path. None of these decorative objects affects layout bounds sent
  to the Backend.
- `Bounds` computes the current house bounds for the initial fit and the
  **Vừa ngôi nhà** action.
- `PerspectiveCamera` and constrained `OrbitControls` provide orbit, zoom, and
  limited pan without allowing the camera below the floor.
- Hemisphere, ambient and directional lights, small local fixture lights, and
  contact shadows provide a bright isometric presentation.
- Room labels use Drei `Html` and actual room device/sensor counts.
- Device and sensor marker components subscribe directly to their existing
  normalized Redux entity, so a realtime update changes the affected marker
  without copying runtime data or changing geometry.

## Multi-floor preview

The frontend test fixture and local Backend seed model a three-storey house
with eight rooms and 14 placed runtime markers. **Toàn nhà** shows the complete building; **T1**, **T2**,
and **T3** isolate a single floor. **Tách tầng** increases the vertical distance
between storeys so their contents can be read, while **Xếp chồng** returns to a
compact building silhouette. The whole-house view renders one concise label per
floor instead of every room label, preventing the text collisions that occur
when all room names share the same projection.

Floor elevation is deterministic presentation geometry:

```text
stackedY = (floor - 1) * 2.5
explodedY = (floor - 1) * 3.75
```

Room X/Z coordinates, dimensions, node IDs, and normalized marker anchors do not
change between stacked, exploded, or isolated-floor views. The approach follows
the linked Hikvision demo's building overview, exploded storeys, and floor
drill-down interaction, translated into HESTA's light visual system.

The renderer uses `frameloop="demand"`, caps device pixel ratio at 1.5 on
desktop and 1.2 on compact screens, reduces shadow resolution on mobile, and
lazy-loads the complete 3D bundle only after the user chooses 3D.

## Health and selection

Markers use existing `ACTIVE`, `STALE`, and `OFFLINE` values. They combine
color with a visible `A`, `!`, or `×` symbol and textual inspector status, so
health is not communicated by color alone. Room, device, and sensor selections
open a read-only inspector. Owners return to the existing 2D editor for all
layout changes.

## Empty, unplaced, and fallback behavior

- An empty layout shows **Chưa có sơ đồ nhà** and an Owner CTA to design in 2D.
- Runtime nodes without layout coordinates are counted in an unplaced panel;
  they are never scattered randomly in 3D.
- WebGL capability is checked before scene creation.
- A React error boundary catches scene initialization/render failures.
- Both failure paths show a readable explanation and **Chuyển sang 2D**.
- Changing home remounts the existing layout editor and clears local view and
  selection state through the existing route/store lifecycle.

## Manual demo

For the self-contained multi-floor fixture, start the frontend and open:

```text
http://127.0.0.1:5173/tests/twin-layout-preview.html?multifloor=1
```

Choose **3D**, then use **Toàn nhà / T3 / T2 / T1** and **Xếp chồng / Tách tầng**.
This fixture route does not call or modify the real Backend. For an end-to-end
test, seed the local Backend and sign in as `multifloor.owner@hesta.local`; its
saved house opens directly in 3D because it contains more than one floor.

1. Start the Backend with the existing local configuration.
2. Start the frontend with `npm run dev`.
3. Login as an OWNER and open Digital Twin.
4. Show the existing 2D layout.
5. Choose **3D** in the Digital Twin header.
6. Compare the room rectangles with the roofless 3D room geometry.
7. Drag the scene to orbit and use the wheel/trackpad to zoom.
8. Choose **Vừa ngôi nhà** to recompute and reset the camera fit.
9. Select a floating room label and show its inspector and node list.
10. Select a device marker and show current state, connectivity, health, and
    last-seen information.
11. Select a sensor marker and show its latest value, unit, health, and
    observation time.
12. Trigger the existing mock sensor event from `26.4` to `30.0` and show that
    the value changes without refreshing or moving the marker.
13. Trigger `ACTIVE → STALE → OFFLINE` and show the same marker changing its
    health symbol, styling, and inspector text.
14. Switch back to **2D**, enter edit mode, move a room, and save.
15. Return to **3D** and show that the saved normalized layout drives the new
    3D geometry.
16. Switch to an empty home and show the explicit empty state.
17. Use a mobile/tablet viewport and confirm the scene remains interactive,
    the inspector stacks below it, and the page has no horizontal overflow.

## Automated and visual verification

Run non-WebGL contracts:

```text
npm test
npm run lint
npm run build
git diff --check
```

For real browser/WebGL coverage, start Vite on port 5173 and run:

```text
npm run test:twin3d:browser
```

The browser check uses Chromium software WebGL and verifies switching,
selection, realtime value/health updates, stable marker position, Fit to Home,
home switching, empty layout, mobile overflow, WebGL fallback, multi-floor
explosion, floor drill-down, and stacked-floor geometry.

Evidence is written to `docs/evidence/twin-3d/`:

- `default-isometric-desktop.png`
- `selected-room.png`
- `selected-device.png`
- `selected-sensor-active.png`
- `health-stale.png`
- `health-offline.png`
- `empty-layout.png`
- `mobile-390.png`
- `multi-floor-exploded.png`
- `multi-floor-level-2.png`
- `multi-floor-stacked.png`
- `browser-results.json`

## Intentional visual differences from the reference

The viewer now recreates the reference's furnished, roofless-home direction
with procedural low-poly furniture, doors, windows, landscaping, warm floors,
and room lighting. It does not claim photorealism or architectural accuracy:
those decorative objects are inferred from room names because HESTA currently
stores none of their geometry. Multi-floor grouping uses the authoritative
floor number stored with each room layout. `Twin3DDecor` can later replace
inferred arrangements with
measured wall openings, levels, materials, and GLTF model assets without
changing the Twin runtime state.
