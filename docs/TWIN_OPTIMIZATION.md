# HESTA Digital Twin optimization

## Persistence

Use the existing `GET/PUT /api/v1/homes/{homeId}/twin-layout`. The optional versioned `architecture` document is stored in `twin_layouts.architecture` (PostgreSQL JSONB). Room/node placements, architecture and revision are committed in the existing OWNER-authorized transaction; the Home/layout locks and `expectedRevision` conflict handling remain intact.

The document contains room outlines and dimensions, authored walls/doors/windows, furniture positions/model variants, window sill height, floor elevation/height/slab thickness, and device/sensor rotations. Normalized room/node coordinates and business identifiers keep their existing contract. Automatic walls and floor surfaces derive from the persisted outlines; GPU buffers are renderer resources, not domain records. No runtime device state, reference image, camera setting or Room/Device domain duplicate is stored in this document.

Legacy PUT requests without `architecture` preserve the saved document and prune references to removed placements. Missing architecture is omitted from old responses. `hesta_app` has no twin-layout consumer; existing clients may omit the additive field. Backend validation checks document version, IDs, finite coordinates, limits, models and floor membership before writing.

```text
Editor draft → materialize inferred architecture → Redux layout draft
→ existing revisioned PUT → Spring Boot authorization/validation
→ PostgreSQL JSONB + room/node placements → returned confirmed Redux layout
→ HESTA Twin Adapter → scene

ESP32 → MQTT → Spring Boot → existing WebSocket → Twin Redux selectors → device model
```

Production view never reads browser metadata as authoritative geometry. Old browser metadata can only be imported explicitly into an unsaved editor draft and then saved through the backend. The browser-backed server in `tests/twin-layout-preview.tsx` is a test transport, not production persistence.

## Geometry source

- `DEFAULT`: no business rooms/geometry.
- `INFERRED`: deterministic layout for existing HESTA room IDs, or saved placements without a complete authored architecture document. The UI displays an inferred notice.
- `PERSISTED`: confirmed backend revision with explicit architecture for each placed room.

Entering Edit materializes inferred furniture/openings as editable objects. Save freezes those objects, disables automatic regeneration for the saved room, and transitions to PERSISTED only after the backend confirms. Failed requests and revision conflicts retain the draft. Reload restores the backend document; it does not refurnish the house.

## Bundle measurement

Measured with the same Node `gzipSync` settings and a Vite/Rolldown module/import graph. Sizes below are decimal kB; initial means the complete static dependency closure, not just the entry file. Reports include an HTML module-size visualization.

| Metric | Before | After |
|---|---:|---:|
| Initial JS, minified | 698.034 kB | 604.979 kB |
| Initial JS, gzip | 201.630 kB | 177.071 kB |
| Digital Twin async dependency closure, gzip | 283.169 kB | 316.425 kB |
| 3D engine/renderer without newly lazy page, gzip | 283.169 kB | 287.544 kB |
| Three/R3F modules in initial graph | 0 | 0 |
| GLB/GLTF assets | 0 bytes | 0 bytes |

Initial gzip falls 12.2%. The async total increases because the 98.7 kB Digital Twin page, previously eager, now loads on demand. The engine itself is approximately unchanged; this is an isolation/cache improvement, not a claim that Three.js became dramatically smaller. The baseline already lazily loaded the 3D view; the new route boundary also defers the Digital Twin page/editor.

`AppRoutes` lazily loads the page, which lazily loads the 3D view. Three and R3F have separate vendor groups. `includeDependenciesRecursively: false` prevents the engine group from absorbing shared React/ReactDOM and becoming eager. The analyzer asserts that no Three/R3F module is in the initial closure. A real production `/home` browser network test also verifies that neither engine nor Digital Twin page chunks download.

See [before analyzer](evidence/twin-optimization/bundle-before.html), [after analyzer](evidence/twin-optimization/bundle-after.html), and [production network evidence](evidence/twin-optimization/production-dashboard-network.json).

## Runtime and assets

- Selector-based device updates and stable floor geometry remain; browser tests confirm device/sensor events do not rebuild walls or refetch the house.
- Repeated architectural/furniture geometry is merged into floor buffers. This preserves per-face cutaway/picking without adding an instance-management layer.
- Pendant lamps and wall cameras share immutable cached geometry; the procedural floor atlas is shared across floors. Resources are reference-counted and disposed after the last mounted owner, including StrictMode remounts. Moving door/window geometry stays device-specific and is disposed when replaced/unmounted.
- DPR stays bounded (desktop max 1.5; compact max 1.2), with AdaptiveDpr while navigating. Rendering uses demand mode, with invalidation for animation and interaction.
- Directional shadows use 1024 maps, 512 for compact/large layouts; compact canvases disable shadows. No post-processing stack was added.
- There are no GLB/GLTF downloads or paid model packs. The shared procedural atlas is 768 × 512. Meshopt/Draco/KTX2 and model-library preloading are therefore not introduced unnecessarily.

## Renderer themes and visual verification

DAYLIGHT is default: background #E9EFF4, gray exterior walls, light interior walls, warm floors/wood, neutral furniture and blue-gray glass. Hemisphere + directional lighting, soft shadows and real device lights preserve depth. BLUEPRINT and NIGHT change renderer palette/environment and shader uniforms; application UI remains light. Theme switching retains architectural BufferGeometry.

Desktop WebGL screenshots were captured and visually reviewed for whole house, single floor, Daylight, Blueprint and Night. Rooms, doors/windows, furniture and cutaway remain readable; house framing passes the 70–85% limiting-dimension check. Important markers are sparse. The persisted whole-house screenshot retains the saved architecture after reload. A NeonPlan Day comparison was captured again using the MIT reference and the current HESTA renderer.

See [screenshot gallery](evidence/twin-optimization/gallery.html) and [NeonPlan comparison](evidence/neonplan-port/side-by-side-comparison.png).

## Files changed in this optimization

Backend:

- `supabase/migrations/20261004090000_persist_twin_architecture.sql`
- `dto/request/TwinArchitectureRequest.java`, `TwinLayoutSaveRequest.java`
- `dto/response/TwinLayoutResponse.java`, `entity/TwinLayout.java`
- `service/TwinArchitectureValidation.java`, `service/impl/TwinLayoutServiceImpl.java`
- `service/TwinArchitectureValidationTest.java`, `TwinLayoutServiceIntegrationTest.java` under test sources

Frontend:

- `types/twinLayout.ts`, `components/twin/twinDrafting.ts`, `layoutGeometry.ts`
- `services/twinGeometrySource.ts`, `twinLayoutMaterialize.ts`, `twinLayoutApi.ts`, `twinAdapter.ts`, `twinArchitectureAdapter.ts`
- `store/twinLayoutSlice.ts`, `routes/AppRoutes.tsx`
- `TwinLayoutEditor.tsx`, `TwinObjectEditor.tsx`, `Twin3DView.tsx`, `Twin3DCanvas.tsx`, `twin3dPalette.ts`
- `scene/rendererTheme.ts`, `HouseScene.tsx`, `FloorScene.tsx`, `RoomScene.tsx`, `TwinCutawayContext.ts`, `architectureMaterials.ts`
- `devices/models.tsx`, `ArchitecturalOpeningModel.tsx`, `hooks/useTwinResource.ts`
- `neonplan/model.ts`, `viewer/build.ts`, `geo.ts`, `furniture.ts`, `pattern.ts`
- `src/index.css`, `vite.config.ts`, `scripts/bundleAnalysisPlugin.ts`, `analyze-bundle.mjs`
- `tests/twinLayout.test.mjs`, `twin-layout-preview.tsx`, `twinLayout.browser.mjs`, `twinArchitectural.browser.mjs`, `twinBundle.browser.mjs`
- This report and `docs/evidence/twin-optimization/` artifacts

Earlier renderer-port work and unrelated user changes remain intact.

## Verification and rollout limits

- Frontend lint, typecheck and production build passed.
- Frontend unit suite: 120 passed.
- Backend targeted controller/service/validation/repository/PostgreSQL suite: 20 passed, 0 skipped. Includes JSONB round-trip after clearing the persistence context, legacy PUT preservation, and pruning removed geometry.
- Real WebGL browser suite: 58 passed, no uncaught exception/shader error.
- Real 2D editor browser suite: 51 passed.
- Production dashboard network check passed: no Three/R3F/Digital Twin page request.
- Bundle graph and `git diff --check` passed.

Commands: `npm.cmd run lint`, `npx.cmd tsc --noEmit -p tsconfig.app.json`, `npm.cmd test`, `npm.cmd run build`, `node scripts/analyze-bundle.mjs after`, `npm.cmd run test:twin3d:browser`, and `node --experimental-websocket tests/twinLayout.browser.mjs` / `tests/twinBundle.browser.mjs`. Backend ran `mvn.cmd -Dtest=TwinLayoutServiceTest,TwinLayoutControllerTest,TwinArchitectureValidationTest,TwinLayoutServiceIntegrationTest,TwinLayoutRepositoryTest test` with the isolated local test datasource environment.

Browser suites use mocked HESTA transport and real Three.js/R3F rendering; they do not claim ESP32 hardware verification. PostgreSQL tests used only the isolated local `hesta_twin_geometry_test` database, with no shared Cloud access.

The copied local schema was behind existing IoT migrations. Its legacy scene-management trigger (`trg_devices_preserve_action_home`) blocks the existing device-refactor migration from dropping `devices.home_id`. That trigger was removed only in the isolated test database before applying the existing IoT migrations; production migrations outside this task were not edited. The release owner should resolve this existing migration-chain issue if deploying that IoT branch to an older database.

The new Twin JSONB migration is supplied and tested locally, but has not been pushed to Cloud. `backend_hesta/AGENTS.md` explicitly says: “Do not run `supabase db push` against Supabase Cloud; that is reserved for the release owner.” Apply the migration through the release workflow before deploying the backend mapping. Vite's large-chunk warning remains for the isolated Three vendor (and the existing application entry); it was not hidden by increasing the threshold.
