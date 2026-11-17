# Digital Twin V2 in the main HESTA application

Run `npm run dev` from `hesta_frontend`, sign in, select a home on `/home`,
then open the **Digital Twin V2** card. The existing authenticated route is
`/home/:homeId/digital-twin`. The standalone `twin-v2-demo` remains independent.

The main renderer uses the existing snapshot, layout, capability, command and
realtime services. No mock reducer, demo room IDs, fixture transport, new backend
endpoint or database migration enters the application.

- Snapshot supplies the actual home name, room/device identities, readings and health.
- Saved layout supplies positions, room shapes, floors and authored objects.
- Without a saved layout, only the actual API rooms are arranged automatically.
  The visible source notice labels the layout and supplemental furnishings as
  illustrative. It is not a measured reconstruction of the house.
  Explicit room names such as “Hành lang tầng 2” can suggest a preview floor;
  the notice discloses that inference. Saved API floor assignments always win.
- The existing device panel fetches actual capabilities and sends the existing
  commands. Device connectivity and command availability follow `device.status`
  only; device `lastSeen` and legacy freshness do not gate controls. Sensor
  readings retain independent freshness rules. Offline/error devices remain disabled; ACKs do not replace
  confirmed snapshot/realtime state. Analytics do not invent missing readings.

The V2 asset renderer in `src/components/twin/v2` fits individual furnishings to
the layout, with polygon-clipped oak planks and window-mounted folded curtains.
The dashboard carries the standalone V2 composition into the authenticated app:
slim HESTA topbar, actual home summary, compact explorer and device panels,
centered floating toolbar, collapsible rails and compact sensor analytics.
Camera framing uses orthographic projection to preserve architectural
proportions, with animated room/device focus, an explicit overview button and
Escape. Navigation and feature panels can collapse to give the scene more room.
The existing 2D editor, role checks, layout saving and route/session logic remain.
In **Chỉnh sửa trong 2D**, furniture footprints can be dragged independently of
their room. Movement previews locally, snaps on drop, and is persisted only by
**Lưu bố cục**. Arrow keys move by the grid step (10 cm with snapping off),
Shift + arrows refine by 5 cm, and Escape cancels an active drag. Openings stay
attached to walls. Read-only and MEMBER views expose no drag handles.
The refresh action reads both snapshot and layout unless a local layout draft
is open, in which case it preserves that draft and refreshes operational data.
New illustrative object variants use ordinary supported API kinds and stable
local object IDs, without expanding the backend's model enum. Their visual
appearance survives an explicit save/load round trip. Existing saved positions
and authored floor plans take precedence over the curated unsaved composition.

Verification uses `npm test`, `npm run build`, `npm run lint`, scoped ESLint and
Playwright browser checks. Test transports stay in development-only harnesses
under `tests`; real-home QA uses read-only interactions. Browser screenshots and
reports are local artifacts under `output/playwright/` (ignored by Git).
