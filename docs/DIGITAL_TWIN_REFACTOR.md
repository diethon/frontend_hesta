# HESTA Digital Twin refactor

## Phase 1 — architecture audit

The existing feature already used Redux Toolkit normalized by ID, a shared authenticated
STOMP client, revision-based backend layouts, an OWNER-only 2D editor and a lazily
loaded React Three Fiber viewer. These contracts are preserved. `Twin3DCanvas` previously
combined camera transitions, room meshes, cutaway walls and connected device/sensor
markers. Device models used a chain of conditions, the inspector was read-only, pan was
disabled and heatmaps were absent.

Keep: `twinApi`, `twinLayoutApi`, `twinSlice`, `twinLayoutSlice`, shared realtime lifecycle,
layout validation/serialization, room creation, floor filtering, route/auth guards.
Refactor: canvas orchestration, camera, room/wall rendering, device model resolution,
inspector, editor metadata and feature presentation.
Add: renderer view models, Twin Adapter, device command service/feedback, capability
controls, house tree, heatmap controls and editable architectural/furniture objects.

## Architecture and data flow

```text
DigitalTwinPage
  DigitalTwinView / TwinLayoutEditor       feature lifecycle, VIEW vs EDIT
    Twin3DView                             selection, floors, toolbar, panels
      Twin3DCanvas → useTwinScene → Twin Adapter (outside Canvas)
        HouseScene
          FloorScene
            NeonPlan MIT polygon slabs / shared walls / openings / furniture
            RoomScene → surface selection / sensor heatmap
            connected device nodes → resolveDeviceModel → pure device models

REST snapshot → twinSlice (normalized Redux state)
REST layout → twinLayoutSlice (confirmed revision + isolated draft)
Twin Adapter → renderer view models and geometry
shared STOMP → validated event → one device/sensor/health record → subscribed view

3D click → select → DeviceControlPanel → deviceCommandService → HESTA API
  → Spring Boot → MQTT → ESP32 → MQTT → backend state → STOMP → Redux → model
```

Models and geometry do not call REST or open sockets. Each connected marker selects its
own ID. Existing Redux structural sharing keeps unrelated records and layout stable.
The scene uses memoized geometry and demand rendering; active fan/camera/cutaway/floor
transitions explicitly request frames. Reduced motion stops fan animation and skips
camera/floor transitions. Heatmap readings subscribe separately from geometry.

## APIs used (relative to the configured `/api/v1` base)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/homes/{homeId}/twin` | Authoritative house, rooms, device states and sensor snapshot |
| GET / PUT | `/homes/{homeId}/twin-layout` | Geometry, storeys and optimistic revision conflict checks |
| GET | `/homes/my-homes` | Home role for editor UX |
| POST | `/homes/{homeId}/rooms` | Existing backend room creation |
| GET | `/devices/{deviceId}` | Device capability schema when opening controls |
| POST | `/devices/{deviceId}/commands` | Manual TURN_ON / TURN_OFF, preserving existing automation override behavior |
| POST | `/devices/{deviceId}/command` | Other declared actions: backend parameter names such as `level`, `speed`, `temperature`, RGB components |

No backend endpoint, domain model, database schema, framework or dependency was changed.
The backend remains authoritative for authentication, authorization and commands. Both
OWNER and MEMBER can open device controls where the backend permits device access;
only OWNER can edit layout. Platform ADMIN is not treated as a home OWNER.
Mobile API contracts remain unchanged; this is a web feature refactor.

## Realtime and commands

The existing single STOMP client connects to `/ws` with Bearer authentication and
subscribes to `/topic/homes/{homeId}/events`. The exact event names remain
`DEVICE_STATE_CHANGED`, `SENSOR_READING_UPDATED`, `TWIN_HEALTH_STATUS_CHANGED`.
Validation, duplicate rejection, old-event ordering, house isolation and replay of events
arriving during a snapshot request are retained. Extensible nonempty backend device types
are accepted and get a generic model when unknown.

`twinCommandSlice` stores only pending/error/ACK feedback per device. It rejects duplicate
or offline commands. A successful MQTT `SUCCESS` response (or mock `ACKNOWLEDGED`) does
not write runtime state. A missing ACK/failed response displays an error and preserves
confirmed state. Late results after changing homes or signing out cannot restore old
feedback. Socket disconnection shows the existing last-known-data notice and manual
resync; events never trigger a full-house fetch.

## Using the viewer and editor

- Select a room or device from the tree, or click a 3D marker/model. Double click focuses
  the object. Orbit, right-button pan, wheel zoom, camera presets, zoom buttons and reset
  use the existing camera controller. Panels stack below the scene on small screens.
- Floors come from persisted room layout storeys. There is no invented Floor domain ID.
  HOUSE is the default at architectural elevations. Floor previews switch to SINGLE
  FLOOR with a 500 ms camera focus. EXPLODED is explicitly opt-in.
- Walls default to camera-facing glass cutaway using the ported GPU buckets; CUT removes
  upper walls. Important markers show health/pending/error, hover or selection; ordinary
  sensors are small physical objects. ALL/NONE are optional marker modes.
- Normal view is the default. Heatmaps explicitly opt into temperature, humidity or an
  air metric. Missing, stale, offline or incompatible-unit readings remain neutral.
- In 2D EDIT mode, place existing backend rooms/devices/sensor streams, move/resize rooms,
  choose storeys, edit room outlines and place furniture, partitions, doors and windows.
  Openings attach to the nearest room wall and cut actual holes in the wall geometry.
  Device yaw snaps to 15°. New rooms use the existing HESTA create-room API.
- Grid choices are 0.25 / 0.5 / 1 visual metres. The existing normalized canvas maps to
  18 × 12 visual metres; backend rounding to three decimals is preserved. Edge snapping
  and bounds clamping can take precedence over the grid.
- VIEW mode does not move objects. Returning to EDIT keeps the isolated draft. Save/
  cancel/revision conflicts preserve the existing workflow. Automatic decorative
  furniture can be disabled per room; decorative lamps do not claim an active state.
  Unsaved local metadata also participates in navigation protection. A browser storage
  failure keeps the metadata draft open instead of reporting it saved.

## Main files

| Layer | Files |
| --- | --- |
| Renderer models / adapter | `src/types/twinView.ts`, `src/services/twinAdapter.ts`, `src/services/twinArchitectureAdapter.ts`, `src/components/twin/hooks/useTwinScene.ts` |
| State / commands | `src/store/twinCommandSlice.ts`, `src/services/deviceCommandService.ts`, `src/store/twinLayoutSlice.ts`, `src/realtime/twinEvents.ts` |
| Feature UI | `DigitalTwinPage.tsx`, `TwinLayoutEditor.tsx`, `Twin3DView.tsx`, `Twin3DInspector.tsx`, `DeviceControlPanel.tsx`, `TwinSidebar.tsx`, `TwinHeatmapToolbar.tsx` |
| Scene | `scene/HouseScene.tsx`, `FloorScene.tsx`, `RoomScene.tsx`, `SceneNodes.tsx`, `FitCamera.tsx`, `cameraFraming.ts`, `architectureMaterials.ts`, `Twin3DCanvas.tsx` |
| MIT engine port | `neonplan/geometry/walls.ts`, `viewer/build.ts`, `fold.ts`, `openings.ts`, `furniture.ts`, `lamps.ts`, `pattern.ts`, `geo.ts`, `heatmap.ts` |
| Device rendering | `devices/deviceModelResolver.ts`, `devices/models.tsx`, `Twin3DDeviceVisual.tsx` |
| Editing / visual tokens | `TwinObjectEditor.tsx`, `TwinObjectPlan.tsx`, `TwinCanvas.tsx`, `TwinDraftingToolbar.tsx`, `TwinLayoutInspector.tsx`, `twinDrafting.ts`, `layoutGeometry.ts`, `twin3dPalette.ts`, `src/index.css` |

Component paths in this table are relative to `src/components/twin/`. Existing
`twinSlice`, `twinApi` and `twinLayoutApi` are reused. No state library was added.

## Persistence boundaries and remaining limits

Backend `twin-layout` persists normalized room/node coordinates and floor numbers.
As in the existing drafting feature, outlines, blueprint images, added architectural/
furniture objects and device rotations are browser metadata stored under
`hesta:twin-drafting:v1:{homeId}`. They are not Room/Device domain duplicates and are
not synchronized across browsers. UI identifies this local persistence explicitly.
Moving a marker changes its display room, not the backend device's business room.

Added furniture uses simple built-in procedural models. This release does not add
GLTF assets, camera video feeds, roofs, stairs, outdoor editing, or a floor domain CRUD
API. Appliance control only exposes actions actually declared in backend capabilities;
missing capability schemas are read-only. No TV volume/channel or AC mode command is
invented. IR_REMOTE remains hardware-specific and is not guessed to be an AC or TV.
Physical dimensions entered in the older inspector remain notes; they do not recalibrate
the 18 × 12 scene. MQTT/ESP32 hardware integration must still be verified on real devices.
When a layout has no authored openings/furniture, the adapter supplies a deterministic
architectural illustration for the existing rooms. These objects are supplemental
view geometry, not surveyed construction data or newly created backend domain records.

## NeonPlan MIT engine port

Reference: [NeonPlan repository](https://github.com/Mastershort/neonplan3d),
[manual](https://github.com/Mastershort/neonplan3d/blob/main/docs/manual.md).
The renderer ports source at commit `bb5261d29fc45ba0bb4a586bca2500f94ec9ea1d`:
shared polygon wall generation, T junctions, slab triangulation, opening voids, GPU wall
fold masks, door/window/blind geometry, free built-in furniture, lamps, procedural floor
patterns and heat colour interpolation. Camera framing, floor stacking, navigation and
important-marker hierarchy adapt the corresponding source behavior to R3F/HESTA.
See `NEONPLAN_PORT_MAPPING.md` for exact source/function/replacement mapping and
`THIRD_PARTY_NOTICES.md` for the retained MIT notice.
Deliberately excluded: Home Assistant integration, `hass`, entity IDs, HA services/state/
WebSocket, HA area matching, neon styling, commercial packs and add-ons.

## Verification

Automated contract/state tests cover adapter identity, declared capabilities, duplicate
commands, ACK vs realtime, timeout, offline locks, home changes, compatible sensor units,
wall holes and existing layout/auth/realtime regressions. Chromium software WebGL tests
use development-only fixtures, not real-house commands, and cover selection, camera,
capability controls, heatmap, realtime, responsive states and multi-floor navigation.
Current port verification is recorded in `docs/evidence/neonplan-port/browser-results.json`.
`comparison.html` and `side-by-side-comparison.png` compare the repository's Day reference
with the actual HESTA WebGL screenshot. The transport is mocked using HESTA contracts;
this verifies geometry, rendering and Redux event flow, not physical ESP32 behavior.
Unit tests also inspect real Three.js buffers/raycasting, shared walls, openings,
camera-dependent masks, built-in furniture and heat interpolation.

Executed for this MIT port: `npm.cmd run lint`, `npx.cmd tsc -b --pretty false`,
`npm.cmd test` (118/118), `npm.cmd run test:twin3d:browser` (47 actual Chromium WebGL
checks), `node --experimental-websocket tests/twinLayout.browser.mjs` (51 editor
checks), and `npm.cmd run build`. Both browser suites report no uncaught exceptions;
the renderer suite also reports no shader errors. The default scene fills 77.7% of
its limiting viewport dimension. Side-by-side screenshots were opened and visually
reviewed against the repository's Day screenshot, including cutaway, whole-house,
single-floor and exploded variants.

Build retains a large lazily loaded Three.js renderer chunk: 1,046.18 kB minified /
285.51 kB gzip. No new dependency was introduced for this port.
