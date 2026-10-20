# Digital Twin interaction

## Using the real Twin

- Open a home's Digital Twin and choose **3D Live**.
- Click a physical device to select it and open its controls. This leaves the camera in place.
- Double-click a device or room to focus the camera. Drag to orbit and scroll to zoom.
- Use **Hiện vị trí thiết bị và cảm biến** (pointer icon above the scene) to discover devices. The default only shows important markers.
- Choose a device in the right-hand list as a keyboard-accessible alternative to canvas picking.
- On tablet, selecting a device brings the control panel into view when it is below the viewport.
- Power, brightness, RGB, speed, temperature, mode, fan mode and opening controls appear only when declared by backend capabilities. RGB changes are submitted with **Áp dụng màu đèn**.
- Offline/stale devices remain selectable. Their controls explain why commands are temporarily unavailable.

The scene never calls REST directly. Selection opens `DeviceControlPanel`, which fetches device detail and submits through `executeTwinCommand` / `deviceCommandService`. Power keeps using `POST /devices/{id}/commands`; other actions use `POST /devices/{id}/command`. ACK updates command feedback only. Existing WebSocket events update confirmed device state and the corresponding model.

Empty capability groups follow `DeviceServiceImpl.extractSupportedActions`; explicit nonempty action lists remain restrictive. No actions are inferred from a device's rendered appearance. Read-only devices receive no invented controls.

## Verification

With the existing Vite development server running:

```powershell
npm test
npx eslint src/components/twin/DeviceControlPanel.tsx src/components/twin/TwinDeviceControls.tsx src/components/twin/Twin3DView.tsx src/components/twin/scene/SceneNodes.tsx src/services/deviceCommandService.ts tests/twin.test.mjs tests/twin-layout-preview.tsx tests/twinInteraction.browser.mjs
npm run lint
npm run build
$env:TEST_3D_URL='http://localhost:5173/tests/twin-layout-preview.html?reference=1&models=1&interactions=1'
npm run test:twin:interaction
```

The browser suite launches an isolated Chromium profile and the real Three.js renderer with a mocked transport. It checks physical model picking, stable single-click camera, double-click focus, capability groups, command payloads, pending/error feedback, ACK without optimistic state, realtime lighting/door geometry, read-only controls and tablet layout. Screenshots and results are in the ignored `.tmp/twin-interaction-evidence/` directory. It sends no commands to real hardware.

Full-project lint currently has failures in existing Admin, device, scene and voice modules. Check the command output separately from the focused lint result; do not disable those rules.

Verified on 2026-10-20: 134 unit tests and 21 real-browser interaction checks passed, with zero uncaught browser exceptions. Focused lint passed. Full lint reported 64 errors and 6 warnings outside the changed files. Production build (including `tsc -b`) passed; existing large-chunk warnings remain. Physical ESP32 acknowledgement was not tested.

## Switching branches

This change is frontend-only: no backend schema migration, endpoint change, dependency upgrade, environment change or mobile edit is required. Keep the existing backend Twin API and previously required migrations when running the real page.

After the interaction changes are committed, `git status --short` should be empty in `hesta_frontend`. Switch frontend branches from that repository, not from the workspace parent (the parent is not a Git repository):

```powershell
git -C D:\FPTU\Capstone\Resources\hesta_frontend status --short --branch
git -C D:\FPTU\Capstone\Resources\hesta_frontend switch <existing-branch>
```

Do not use `checkout -f` or `reset --hard` to resolve an uncommitted-change warning. Commit any subsequent work before switching. Backend, frontend and mobile are independent repositories, so switching one does not switch the others. A clean working tree prevents this patch from blocking checkout; it does not guarantee compatibility with every older branch or prevent future merge conflicts.

## Visual refinement

The real Twin now opens in Daylight with the existing architectural materials and soft shadows. A narrower desktop control column gives the scene more space; compact horizontal room navigation replaces the tall room cards. Device rows use appliance-specific icons and a small accessible status indicator. Zoom and top view are available directly on the canvas.

Control sliders use the shared HESTA colors, show the selected percentage and remain keyboard-operable. The RGB field shows its draft color and keeps the explicit Apply action. Technical model details stay under device information. No API, authorization, layout persistence or realtime behavior changed.

The refined view was checked in real Chromium at desktop, tablet and 320px widths: 23 browser checks passed alongside the 134 unit tests. Screenshots are available in `.tmp/twin-interaction-evidence/desktop-overview.png`, `desktop-selected-light.png`, `tablet-interactions.png` and `mobile-interactions.png`.
