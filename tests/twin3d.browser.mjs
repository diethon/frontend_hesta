// Real Chromium WebGL, selection, realtime, fallback and responsive checks.
// Start Vite first. Uses software WebGL so it also runs on headless CI hosts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const evidence = resolve('docs/evidence/twin-3d');
const profile = resolve('.tmp/twin-3d-chrome-' + Date.now());
const testUrl = process.env.TEST_3D_URL ?? 'http://127.0.0.1:5173/tests/twin-layout-preview.html?reference=1';
const multiFloorUrl = new URL(testUrl);
multiFloorUrl.search = '?multifloor=1';
multiFloorUrl.hash = '';
await mkdir(evidence, { recursive: true });
await mkdir(profile, { recursive: true });
const chrome = spawn(process.env.TEST_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
let sequence = 0;
const pending = new Map();
const results = [];
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log('PASS', name); };
try {
  let port;
  for (let i = 0; i < 100; i++) {
    if (chrome.exitCode !== null) throw new Error('Chrome exited before starting');
    try { port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(port, 'Chrome debugging port');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const events = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id); if (!task) return;
      pending.delete(message.id); clearTimeout(task.timeout);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    } else events.push(message);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 160; i++) { if (await evaluate(expression)) return; await delay(100); }
    console.error(await evaluate(`JSON.stringify({ text: document.body.innerText, floors: document.querySelectorAll('[data-twin-floor-label]').length, markers: document.querySelectorAll('.twin-3d-stage button[data-world-y]').length })`));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (text) => {
    const found = await evaluate(`(() => { const e = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!e) return false; e.click(); return true; })()`);
    assert.ok(found, `Control exists: ${text}`); await delay(120);
  };
  const chooseFloor = async (ariaLabel, value) => {
    if (ariaLabel === 'Chọn tầng trong mô hình 3D') {
      const selected = await evaluate(`(() => { const button = document.querySelector('[aria-label="${ariaLabel}"] button[data-value="${value}"]'); if (!button) return false; button.click(); return true; })()`);
      assert.ok(selected, `3D floor segment exists: ${value}`); await delay(500); return;
    }
    const opened = await evaluate(`(() => { const trigger = document.querySelector('button[role="combobox"][aria-label="${ariaLabel}"]'); if (!trigger) return false; trigger.click(); return true; })()`);
    assert.ok(opened, `Floor select exists: ${ariaLabel}`);
    await waitFor(`document.querySelector('[role="listbox"][aria-label="${ariaLabel}"]') !== null`);
    const selected = await evaluate(`(() => { const option = [...document.querySelectorAll('[role="listbox"][aria-label="${ariaLabel}"] [role="option"]')].find(element => element.dataset.value === ${JSON.stringify(String(value))}); if (!option) return false; option.click(); return true; })()`);
    assert.ok(selected, `Floor option exists: ${value}`); await delay(120);
  };
  const screenshot = async (name, fullPage = true) => {
    await evaluate('window.scrollTo(0, 0)');
    const metrics = await send('Page.getLayoutMetrics');
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage,
      ...(fullPage ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {}),
    });
    await writeFile(resolve(evidence, name + '.png'), Buffer.from(data, 'base64'));
  };
  const rect = (selector) => evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height}; })()`);
  const markerPosition = (needle) => evaluate(`(() => { const e = [...document.querySelectorAll('.twin-3d-stage button')].find(e => e.getAttribute('aria-label')?.includes(${JSON.stringify(needle)})); return JSON.stringify({x:e.dataset.worldX,z:e.dataset.worldZ}); })()`);
  const roomLabelRect = (needle) => evaluate(`(() => { const e = [...document.querySelectorAll('.twin-3d-room-label')].find(e => e.textContent.includes(${JSON.stringify(needle)})); const b = e.getBoundingClientRect(); return JSON.stringify({x:Math.round(b.x*10)/10,y:Math.round(b.y*10)/10,width:Math.round(b.width*10)/10,height:Math.round(b.height*10)/10}); })()`);
  // Wait on actual projected motion, rather than assuming software WebGL renders in 700ms.
  const settleCamera = (needle = 'Phòng khách') => evaluate(`new Promise(resolve => {
    let last = '', stable = 0;
    const frame = () => {
      const e = [...document.querySelectorAll('.twin-3d-room-label')].find(e => e.textContent.includes(${JSON.stringify(needle)}));
      if (!e) { requestAnimationFrame(frame); return; }
      const r = e.getBoundingClientRect(), current = Math.round(r.x * 10) + ':' + Math.round(r.y * 10);
      stable = current === last ? stable + 1 : 0; last = current;
      if (stable >= 8) resolve(); else requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  })`);

  await Promise.all([send('Page.enable'), send('Runtime.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: testUrl });
  await waitFor(`document.querySelector('button[aria-label="Chế độ 3D"]') !== null`);
  check('Digital Twin opens in 3D Live with all three mode controls', await evaluate(`document.querySelector('button[aria-label="Chế độ 3D"]').getAttribute('aria-pressed') === 'true' && !!document.querySelector('button[aria-label="Chế độ Overview"]')`));
  await click('Chế độ Overview');
  await waitFor(`document.querySelector('section[aria-label="Overview"]') !== null`);
  check('Overview exposes runtime counts and unplaced objects', await evaluate(`['Phòng','Thiết bị','Cảm biến','ACTIVE','STALE','OFFLINE','Chưa đặt'].every(label => document.querySelector('section[aria-label="Overview"]').textContent.includes(label))`));
  await click('Chế độ 2D');
  await click('Chỉnh sửa sơ đồ');
  await evaluate(`document.querySelector('[data-room-id] > button').click()`);
  await click('Phòng chữ L');
  await click('Lưu bố cục');
  await waitFor(`document.body.textContent.includes('Chế độ xem')`);
  check('saved 2D L-shape metadata is available to the shared 3D generator', await evaluate(`Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes('L_SHAPE'))`));
  await click('Chỉnh sửa sơ đồ');
  await evaluate(`document.querySelector('[data-room-id] > button').click()`);
  await click('Thêm bàn');
  await evaluate(`(() => { const input = [...document.querySelectorAll('fieldset label')].find(label => label.textContent === 'Ngang (m)').querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1.13'); input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  check('furniture position snaps to the half-metre grid', await evaluate(`[...document.querySelectorAll('fieldset label')].find(label => label.textContent === 'Ngang (m)').querySelector('input').value === '1'`));
  await click('Inspect geometry / requests');
  check('furniture-only edits keep backend geometry clean and enable navigation protection', await evaluate(`(() => { const layout = JSON.parse(document.querySelector('details pre').textContent).layout; return layout.metadataDirty && !layout.dirty; })()`));
  const dialogStart = events.length;
  const navigateWithDraft = click('Home B');
  for (let attempt = 0; attempt < 80 && !events.slice(dialogStart).some(event => event.method === 'Page.javascriptDialogOpening'); attempt++) await delay(50);
  check('leaving the editor warns for unsaved furniture metadata', events.slice(dialogStart).some(event => event.method === 'Page.javascriptDialogOpening'));
  await send('Page.handleJavaScriptDialog', {accept:false});
  await navigateWithDraft;
  for (const kind of ['DOOR', 'WINDOW']) {
    await evaluate(`(() => { const select = [...document.querySelectorAll('fieldset select')][0]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${kind}'); select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await click(kind === 'DOOR' ? 'Thêm cửa' : 'Thêm cửa sổ');
  }
  await evaluate(`document.querySelector('[data-node-key^="DEVICE:"]').click()`);
  await evaluate(`(() => { const input = [...document.querySelectorAll('label')].find(label => label.textContent === 'Xoay thiết bị (°)').querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '91'); input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await click('Lưu bố cục');
  await waitFor(`document.body.textContent.includes('Chế độ xem')`);
  check('furniture, architectural openings and snapped device rotation persist together', await evaluate(`Object.keys(localStorage).some(key => { try { const metadata = JSON.parse(localStorage.getItem(key)); return Object.values(metadata.rooms ?? {}).some(room => ['TABLE','DOOR','WINDOW'].every(kind => room.objects?.some(object => object.kind === kind && Number.isFinite(object.x)))) && Object.values(metadata.nodeRotations ?? {}).includes(90); } catch { return false; } })`));
  await click('Count requests');
  const initialRequestCount = await evaluate(`document.querySelector('[data-twin-snapshot-requests]').textContent`);
  await click('Chế độ 3D');
  await waitFor(`document.querySelector('.twin-3d-stage canvas') !== null && !document.body.textContent.includes('Đang dựng không gian 3D')`);
  await waitFor(`document.querySelectorAll('.twin-3d-room-label').length === 4 && document.querySelectorAll('.twin-3d-stage button[aria-label*="ACTIVE"], .twin-3d-stage button[aria-label*="STALE"], .twin-3d-stage button[aria-label*="OFFLINE"]').length === 7`);
  await delay(600);
  check('3D mode creates a WebGL canvas without horizontal overflow', await evaluate(`document.documentElement.scrollWidth <= innerWidth && !!document.querySelector('.twin-3d-stage canvas')`));
  check('3D scene renders four rooms and seven runtime markers', await evaluate(`document.querySelectorAll('.twin-3d-room-label').length === 4 && document.querySelectorAll('.twin-3d-stage button[aria-label*="ACTIVE"], .twin-3d-stage button[aria-label*="STALE"], .twin-3d-stage button[aria-label*="OFFLINE"]').length === 7`));
  check('floating 3D icons stay compact at the default camera', await evaluate(`[...document.querySelectorAll('.twin-3d-marker')].every(e => { const r = e.getBoundingClientRect(); return r.width >= 32 && r.width <= 40 && r.height <= 40; })`));
  await screenshot('default-isometric-desktop');

  const unchangedMarker = await markerPosition('Đèn chính');
  for (const view of ['Mặt trước', 'Bên phải', 'Mặt sau', 'Bên trái', 'Từ trên', 'Phối cảnh']) {
    const before = await roomLabelRect('Phòng khách');
    await click(`Góc nhìn ${view}`);
    await settleCamera();
    check(`camera preset ${view} changes the real WebGL projection`, before !== await roomLabelRect('Phòng khách') && await evaluate(`document.querySelector('[aria-label="Góc nhìn ${view}"]').getAttribute('aria-pressed') === 'true'`));
    assert.equal(await markerPosition('Đèn chính'), unchangedMarker);
    if (view === 'Từ trên') await screenshot('camera-top');
  }
  const beforeTurn = await roomLabelRect('Phòng khách');
  await click('Xoay phải 90°');
  await settleCamera();
  check('quarter turn rotates around the current target', beforeTurn !== await roomLabelRect('Phòng khách'));
  await click('Xoay trái 90°');
  await settleCamera();
  const restored = JSON.parse(await roomLabelRect('Phòng khách')), original = JSON.parse(beforeTurn);
  check('opposite quarter turns restore the angle without changing geometry', Math.abs(restored.x - original.x) < 2 && Math.abs(restored.y - original.y) < 2 && unchangedMarker === await markerPosition('Đèn chính'));
  await click('Góc nhìn Mặt trước');
  await settleCamera();
  await click('Reset góc nhìn');
  await settleCamera();
  check('reset restores the isometric preset', await evaluate(`document.querySelector('[aria-label="Góc nhìn Phối cảnh"]').getAttribute('aria-pressed') === 'true'`));

  const beforeFocus = await roomLabelRect('Phòng khách');
  await evaluate(`[...document.querySelectorAll('.twin-3d-room-label')].find(e => e.textContent.includes('Phòng khách')).click()`);
  await waitFor(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]') !== null`);
  check('room selection opens the runtime room inspector', await evaluate(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]').textContent.includes('1 thiết bị')`));
  await delay(400);
  check('room selection transitions the camera and exposes room focus controls', beforeFocus !== await roomLabelRect('Phòng khách') && await evaluate(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]').textContent.includes('Xem riêng phòng')`));
  await click('Xem riêng phòng');
  await delay(500);
  await screenshot('selected-room');

  await click('Góc nhìn Bên trái');
  await settleCamera();
  check('changing camera angle keeps the selected room inspector', await evaluate(`!!document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]')`));
  const focusedCanvas = await rect('.twin-3d-stage canvas');
  const dragX = focusedCanvas.x + focusedCanvas.width * .92, dragY = focusedCanvas.y + focusedCanvas.height * .15;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragX, y: dragY, button: 'left', buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 4; step++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragX - step * 18, y: dragY, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragX - 72, y: dragY, button: 'left', buttons: 0, clickCount: 1 });
  await delay(600);
  check('dragging the scene preserves room selection and clears preset emphasis', await evaluate(`!!document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]') && !document.querySelector('[aria-label="Góc nhìn 3D"] button[aria-pressed="true"]')`));

  await evaluate(`[...document.querySelectorAll('.twin-3d-stage button')].find(e => e.getAttribute('aria-label')?.includes('Đèn chính')).click()`);
  await waitFor(`document.querySelector('[aria-label="Chi tiết thiết bị Đèn chính"]') !== null`);
  check('device marker selection shows current device state', await evaluate(`document.querySelector('[aria-label="Chi tiết thiết bị Đèn chính"]').textContent.includes('ONLINE')`));
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]')?.textContent.includes('Độ sáng')`);
  await evaluate(`[...document.querySelectorAll('[aria-label="Điều khiển thiết bị"] button')].find(e => e.textContent === 'Tắt').click()`);
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]').textContent.includes('Đang chờ thiết bị xác nhận')`);
  check('device control locks actions while waiting for MQTT ACK', await evaluate(`[...document.querySelectorAll('[aria-label="Điều khiển thiết bị"] button')].every(button => button.disabled)`));
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]').textContent.includes('Thiết bị đã xác nhận lệnh')`);
  check('successful ACK alone cannot optimistically turn the Twin device OFF', await evaluate(`document.querySelector('[aria-label="Điều khiển thiết bị"]').textContent.includes('Nguồn · ON')`));
  await click('Device → OFF');
  await waitFor(`[...document.querySelectorAll('.twin-3d-stage button')].some(e => e.getAttribute('aria-label')?.includes('Đèn chính') && e.getAttribute('aria-label')?.includes('OFF · ONLINE'))`);
  check('device realtime updates the selected 3D marker', await evaluate(`document.querySelector('[aria-label="Chi tiết thiết bị Đèn chính"]').textContent.includes('OFF')`));
  await screenshot('selected-device');

  await evaluate(`[...document.querySelectorAll('.twin-3d-stage button')].find(e => e.getAttribute('aria-label')?.includes('TEMPERATURE')).click()`);
  await waitFor(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]') !== null`);
  const beforeRealtime = await markerPosition('TEMPERATURE');
  await click('Sensor → 30');
  await waitFor(`[...document.querySelectorAll('.twin-3d-stage button')].some(e => e.getAttribute('aria-label')?.includes('30 °C'))`);
  const afterRealtime = await markerPosition('TEMPERATURE');
  check('sensor realtime updates value without moving its 3D marker', beforeRealtime === afterRealtime);
  await click('STALE'); await waitFor(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]').textContent.includes('STALE')`); await screenshot('health-stale');
  await click('OFFLINE'); await waitFor(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]').textContent.includes('OFFLINE')`); await screenshot('health-offline');
  await click('ACTIVE'); await waitFor(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]').textContent.includes('ACTIVE')`); await screenshot('selected-sensor-active');
  check('health transitions update the selected 3D sensor', await evaluate(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]').textContent.includes('30')`));
  await click('Nhiệt độ');
  await waitFor(`[...document.querySelectorAll('.twin-3d-room-label')].some(label => label.textContent.includes('30 °C'))`);
  check('temperature heatmap reads live room sensor data', await evaluate(`document.querySelector('[aria-label="Heatmap"] button[aria-pressed="true"]').textContent === 'Nhiệt độ'`));
  await click('Bình thường');
  check('heatmap can be disabled without changing scene geometry', beforeRealtime === await markerPosition('TEMPERATURE'));
  await click('Count requests');
  check('mode switches, capability fetches, commands and realtime never reload the Twin snapshot', initialRequestCount === await evaluate(`document.querySelector('[data-twin-snapshot-requests]').textContent`));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await click('Sensor → 31');
  await waitFor(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]').textContent.includes('31')`);
  check('reduced motion disables realtime DOM animations', await evaluate(`document.querySelector('[aria-label="Chi tiết cảm biến TEMPERATURE"]').getAnimations({subtree:true}).length === 0`));
  const reducedBefore = await roomLabelRect('Phòng khách');
  await click('Góc nhìn Từ trên');
  await waitFor(`document.querySelector('[aria-label="Góc nhìn Từ trên"]').getAttribute('aria-pressed') === 'true'`);
  await settleCamera();
  check('camera presets remain usable with reduced motion', reducedBefore !== await roomLabelRect('Phòng khách'));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await click('Đưa mô hình vừa màn hình');
  await delay(350);

  const canvas = await rect('.twin-3d-stage canvas');
  const centerX = canvas.x + canvas.width * 0.9, centerY = canvas.y + canvas.height * 0.25;
  check('orbit gesture starts on the WebGL canvas', await evaluate(`document.elementFromPoint(${centerX}, ${centerY})?.tagName === 'CANVAS'`));
  const beforeOrbit = await roomLabelRect('Phòng khách');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: centerX, y: centerY, button: 'left', buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 5; step++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centerX - step * 22, y: centerY + step * 4, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: centerX - 110, y: centerY + 20, button: 'left', buttons: 0, clickCount: 1 });
  await delay(500);
  const afterOrbit = await roomLabelRect('Phòng khách');
  check('OrbitControls rotates the current home', beforeOrbit !== afterOrbit);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: centerX, y: centerY, deltaY: 240, deltaX: 0 });
  await delay(500);
  const afterZoom = await roomLabelRect('Phòng khách');
  check('OrbitControls zoom changes the camera without changing layout data', afterOrbit !== afterZoom);
  await click('Đưa mô hình vừa màn hình');
  await waitFor(`(() => { const e = [...document.querySelectorAll('.twin-3d-room-label')].find(e => e.textContent.includes('Phòng khách')); const b = e.getBoundingClientRect(); return JSON.stringify({x:Math.round(b.x*10)/10,y:Math.round(b.y*10)/10,width:Math.round(b.width*10)/10,height:Math.round(b.height*10)/10}) !== ${JSON.stringify(afterZoom)}; })()`);
  check('Fit to Home reframes the current room bounds', afterZoom !== await roomLabelRect('Phòng khách'));
  await click('Chế độ 2D');
  check('switching back preserves the existing 2D layout', await evaluate(`document.querySelectorAll('[data-room-id]').length === 4 && !document.querySelector('.twin-3d-stage canvas')`));

  await click('Home B'); await waitFor(`document.body.textContent.includes('Không gian sống · Nhà B')`); await click('Chế độ 3D');
  await waitFor(`document.body.textContent.includes('Chưa có phòng')`);
  await waitFor(`!document.querySelector('.twin-3d-stage canvas') && document.querySelector('button[aria-label="Chế độ 3D"]').getAttribute('aria-pressed') === 'true'`);
  check('home switching resets mode and selection and clears old rooms', await evaluate(`!document.querySelector('.twin-3d-stage canvas') && document.body.textContent.includes('Chưa có phòng') && document.querySelector('button[aria-label="Chế độ 3D"]').getAttribute('aria-pressed') === 'true'`));
  await screenshot('empty-layout');

  await click('Home A'); await waitFor(`document.body.textContent.includes('Không gian sống · Nhà mẫu · 4 phòng')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor('innerWidth === 390');
  check('390px mobile 3D retains the scene without overflow', await evaluate(`document.documentElement.scrollWidth <= innerWidth && !!document.querySelector('.twin-3d-stage canvas')`));
  await screenshot('mobile-390', true);
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor('innerWidth === 320');
  await waitFor(`document.querySelector('.twin-3d-stage canvas') !== null && !document.body.textContent.includes('Đang dựng không gian 3D')`);
  check('mobile 3D has no page-level horizontal overflow', await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
  check('all camera presets fit inside the 320px viewport with touch targets', await evaluate(`[...document.querySelectorAll('[aria-label="Góc nhìn 3D"] button')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 44; })`));
  await click('Góc nhìn Từ trên');
  await settleCamera();
  check('320px mobile switches to the overhead camera preset', await evaluate(`document.querySelector('[aria-label="Góc nhìn Từ trên"]').getAttribute('aria-pressed') === 'true' && document.documentElement.scrollWidth <= innerWidth`));
  await click('Reset góc nhìn');
  await settleCamera();
  await evaluate(`[...document.querySelectorAll('.twin-3d-room-label')].find(e => e.textContent.includes('Phòng khách')).click()`);
  await waitFor(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]') !== null`);
  check('mobile inspector sits below the scene', await evaluate(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]').getBoundingClientRect().top >= document.querySelector('.twin-3d-stage').getBoundingClientRect().bottom`));
  await screenshot('mobile-320', true);

  await click('Chế độ 2D');
  await evaluate(`window.__originalGetContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = () => null;`);
  await click('Chế độ 3D');
  await waitFor(`document.body.textContent.includes('Không thể khởi tạo trình xem 3D.')`);
  check('WebGL failure offers a safe switch to 2D', await evaluate(`!![...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Chuyển sang 2D')`));
  await evaluate(`HTMLCanvasElement.prototype.getContext = window.__originalGetContext`);

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: multiFloorUrl.href });
  await waitFor(`document.querySelector('button[aria-label="Chế độ 3D"]')?.getAttribute('aria-pressed') === 'true' && document.querySelector('.twin-3d-stage canvas') !== null`);
  check('multi-floor homes open directly in 3D', await evaluate(`document.querySelector('button[aria-label="Chế độ 3D"]')?.getAttribute('aria-pressed') === 'true'`));
  await waitFor(`document.querySelectorAll('[aria-label="Chọn tầng trong mô hình 3D"] button').length === 4 && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 14`);
  check('multi-floor fixture renders three selectable levels and fourteen markers', await evaluate(`document.querySelectorAll('[aria-label="Chọn tầng trong mô hình 3D"] button').length === 4 && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 14`));
  check('exploded overview assigns higher world elevation to upper-floor nodes', await evaluate(`(() => { const y = label => Number([...document.querySelectorAll('.twin-3d-stage button[data-world-y]')].find(e => e.getAttribute('aria-label')?.includes(label)).dataset.worldY); return y('Đèn làm việc') > y('Điều hòa phòng chính') && y('Điều hòa phòng chính') > y('Đèn phòng khách'); })()`));
  await screenshot('multi-floor-exploded');
  check('floor toolbar stays outside the house and shows the current selection', await evaluate(`!document.querySelector('[data-twin-floor-label]') && document.querySelector('[aria-label="Chọn tầng trong mô hình 3D"] button[aria-pressed="true"]')?.dataset.value === 'all' && document.querySelector('[aria-label="Chọn tầng trong mô hình 3D"]').getBoundingClientRect().bottom <= document.querySelector('.twin-3d-stage').getBoundingClientRect().top`));
  await screenshot('multi-floor-controls');
  await chooseFloor('Chọn tầng trong mô hình 3D', 2);
  await waitFor(`document.querySelectorAll('.twin-3d-room-label').length === 3 && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 5`);
  check('floor drill-down isolates only rooms and markers from the selected floor', await evaluate(`[...document.querySelectorAll('.twin-3d-room-label')].length === 3 && [...document.querySelectorAll('.twin-3d-room-label')].every(e => e.textContent.includes('Tầng 2'))`));
  await screenshot('multi-floor-level-2');
  await chooseFloor('Chọn tầng trong mô hình 3D', 'all');
  await waitFor(`document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 14`);
  const explodedOfficeY = await evaluate(`Number([...document.querySelectorAll('.twin-3d-stage button[data-world-y]')].find(e => e.getAttribute('aria-label')?.includes('Đèn làm việc')).dataset.worldY)`);
  await click('Xếp chồng');
  await waitFor(`Number([...document.querySelectorAll('.twin-3d-stage button[data-world-y]')].find(e => e.getAttribute('aria-label')?.includes('Đèn làm việc')).dataset.worldY) < ${explodedOfficeY}`);
  check('stack control reduces inter-floor spacing without changing the floor data', await evaluate(`document.querySelector('[aria-label="Bố trí tầng"] button[aria-pressed="true"]').textContent.includes('Xếp chồng') && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 14`));
  await screenshot('multi-floor-stacked');

  await click('Chế độ 2D');
  await waitFor(`document.querySelector('button[role="combobox"][aria-label="Chọn tầng trong sơ đồ 2D"]') !== null && document.querySelectorAll('.twin-2d-overview-viewport').length === 3`);
  check('2D multi-floor overview separates each floor into its own compact plan', await evaluate(`document.querySelectorAll('.twin-2d-overview-viewport').length === 3 && document.querySelectorAll('.twin-2d-overview-viewport [data-room-id]').length === 8`));
  await chooseFloor('Chọn tầng trong sơ đồ 2D', 2);
  await waitFor(`document.querySelector('button[role="combobox"][aria-label="Chọn tầng trong sơ đồ 2D"]')?.dataset.value === '2' && document.querySelectorAll('.twin-canvas > [data-room-id]').length === 3`);
  check('2D floor select isolates the selected floor and its markers', await evaluate(`document.querySelector('button[role="combobox"][aria-label="Chọn tầng trong sơ đồ 2D"]')?.dataset.value === '2' && document.querySelectorAll('.twin-canvas > [data-room-id]').length === 3 && document.querySelectorAll('.twin-canvas > [data-node-key]').length === 5`));
  await chooseFloor('Chọn tầng trong sơ đồ 2D', 'all');
  await waitFor(`document.querySelector('button[role="combobox"][aria-label="Chọn tầng trong sơ đồ 2D"]')?.dataset.value === 'all' && document.querySelectorAll('.twin-2d-overview-viewport').length === 3`);

  const errors = events.filter((event) => event.method === 'Runtime.exceptionThrown');
  check('browser reports no uncaught exceptions during supported 3D flows', errors.length === 0);
  await writeFile(resolve(evidence, 'browser-results.json'), JSON.stringify({ results, errors, screenshots: ['default-isometric-desktop', 'camera-top', 'selected-room', 'selected-device', 'health-stale', 'health-offline', 'selected-sensor-active', 'empty-layout', 'mobile-390', 'mobile-320', 'multi-floor-exploded', 'multi-floor-controls', 'multi-floor-level-2', 'multi-floor-stacked'] }, null, 2));
  await send('Browser.close');
} finally {
  socket?.close(); chrome.kill();
}
