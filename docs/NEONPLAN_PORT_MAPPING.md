# NeonPlan renderer audit and port mapping

Reference: [NeonPlan 3D](https://github.com/Mastershort/neonplan3d), inspected source commit `bb5261d29fc45ba0bb4a586bca2500f94ec9ea1d` (MIT, Copyright 2026 Mastershort). `frontend/`, `preview/`, `docs/` and the Day / cut / house screenshots were inspected before implementation.

## Existing HESTA architecture

`DigitalTwinPage → TwinLayoutEditor → Twin3DView → Twin3DCanvas → HouseScene / FloorScene / RoomScene`. `twinAdapter` adapts the confirmed layout and normalized Redux snapshot. STOMP updates individual records; commands pass through the existing authenticated API. Layout room storeys are not backend Floor records. Supplemental furniture/geometry metadata is local to the house/browser.

The old renderer duplicated each room wall, used independent box walls without true shared openings, tiny device models beneath always-visible HTML badges, and bounds/camera framing dominated by empty space. Exploded floors were the default; the permanent inspector and statistics consumed viewport space.

Keep HESTA API services, adapter boundary, Redux slices/selectors, STOMP ordering/validation, authentication/authorization, command confirmation and the 2D layout workflow. Replace the architecture rendering path and its navigation. Create a renderer-only MIT geometry boundary, topology adapter, cutaway uniforms, compact floor navigation and focused viewport panels.

## Exact source mapping

| NeonPlan source | Responsibility | Reuse decision | HESTA boundary / replacement |
| --- | --- | --- | --- |
| `viewer/viewer3d.ts` constructor/build | Scene creation, merged floor meshes | Adapt orchestration, retain R3F lifecycle | `HouseScene`, `FloorScene` |
| `geometry/walls.ts` `generateWalls`, `miterEnds` | Shared edges, partial joins, automatic exterior/interior walls | Port MIT implementation | Renderer-only room polygons from confirmed HESTA layout |
| `viewer/build.ts` `buildFloorGeometry` | Polygon floor/slab, wall extrusion, opening gaps, bucket grouping, baked occlusion | Port; remove garden/solar/pack dependencies | Adapter creates renderer floors, rooms and openings |
| `viewer/geo.ts`, `geometry/holes.ts` | Prisms, triangulation, geometry buffers, floor holes | Port; compute normals for HESTA lighting | Three.js only |
| `viewer/fold.ts`; `viewer3d.ts` `updateWalls` | GPU cut walls, camera-facing glass buckets (`dot >= .25`) | Port shader and mask algorithm | Local `auto` / `cut` view state |
| `viewer/openings.ts` `buildOpeningParts` | Real jambs, door swings, window sashes/tilt, glass, blinds | Port geometry | HESTA device state supplies opening fractions |
| `viewer/furniture.ts` built-in procedures | Beds, seating, tables, cabinets, kitchen/bath fixtures, plants | Port free built-ins only; remove pack resolver/model code | Deterministic illustration or locally authored furniture; no invented Room records |
| `viewer/viewer3d.ts` `pushLampModel`; furniture camera model | Architectural lamp and camera meshes | Extract pure MIT procedures | HESTA device resolver and state-driven physical lights |
| `viewer3d.ts` `applyTargets`, `stepFloors` | Architectural elevation + optional explode gap, floor easing | Adapt algorithm | HOUSE default; SINGLE FLOOR; explicit EXPLODED |
| `viewer3d.ts` `fit`, `focus`; `viewer/controls.ts` `fly` | Bounds from architecture, isometric orbit, eased focus | Adapt to Drei OrbitControls; 500 ms transitions | fit house/floor/room/device, viewport resize |
| `viewer3d.ts` floor pattern texture/material | Procedural wood/tile atlas and surface UV shader | Extract atlas/shader; neutral Day seams | Polygon room floor surface |
| `viewer3d.ts` `floorThumbnails`; `components/view3d.ts` navigation | Compact vertical floor previews / whole house | Adapt visual hierarchy with geometry thumbnails | HESTA storey selector |
| `viewer3d.ts` `pick`, `roomHighlight` | Triangle-range selection, surface highlight | Adapt picking / highlight ranges | HESTA roomId and deviceId selection |
| `markers.ts`, `viewer3d.ts` `updateLabels` / `updateDevicePins` | Important marker policy, suppress labels in house view | Study only; HA-coupled marker builder excluded | HESTA health / pending / hover / selection policy |
| `heatmap.ts` `heatColor`, `HEAT_SCALES` | Interpolated floor temperature/humidity/CO₂ colours | Port pure interpolation, exclude HA `roomValues` | Existing HESTA metric/unit/freshness checks |
| `viewer/lighting.ts` | Cell-based floor/wall illumination and door transmission | Study; use physical HESTA PointLight plus source contact occlusion | No imported HA light state |
| `viewer/theme.ts`, `themes.ts`, `docs/images/view-day.jpg` | Day theme and contrast | Adapt light material palette; physical lighting | HESTA bright UI outside canvas, neutral architectural surfaces |
| `editor/*`, `geometry/snap.ts` | Plan editor tools / snapping | Retain HESTA editor, extend renderer furniture vocabulary | Existing revisioned layout and owner authorization |
| `preview/index.html`, `preview/demo-data.js` | Standalone reference/demo | Reference and visual comparison only | HESTA browser fixture exercises real R3F renderer |

## Integration preserved

`ESP32 → MQTT → Spring Boot → REST/STOMP → normalized HESTA Redux → adapter → renderer`.

Existing API: `GET /homes/{homeId}/twin`, `GET/PUT /homes/{homeId}/twin-layout`, `GET /homes/my-homes`, `GET /devices/{deviceId}`, `POST /devices/{deviceId}/commands`, `POST /devices/{deviceId}/command` (under configured API base). Validate against the actual service/controller contracts; no new endpoint or domain field is introduced. Device commands use capability/action schema; pending is temporary and confirmed state comes from backend events.

Excluded: HA integration/store/entity/service/websocket, external paid furniture packs, Pro extensions, Neon UI theme. MIT notice is retained in `THIRD_PARTY_NOTICES.md` and each ported file.
