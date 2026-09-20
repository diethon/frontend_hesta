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
    console.error(await evaluate('document.body.innerText'));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (text) => {
    const found = await evaluate(`(() => { const e = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!e) return false; e.click(); return true; })()`);
    assert.ok(found, `Control exists: ${text}`); await delay(120);
  };
  const chooseFloor = async (ariaLabel, value) => {
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

  await Promise.all([send('Page.enable'), send('Runtime.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: testUrl });
  await waitFor(`document.querySelector('button[aria-label="Chế độ 3D"]') !== null`);
  await click('Chế độ 3D');
  await waitFor(`document.querySelector('.twin-3d-stage canvas') !== null && !document.body.textContent.includes('Đang dựng không gian 3D')`);
  await waitFor(`document.querySelectorAll('.twin-3d-room-label').length === 4 && document.querySelectorAll('.twin-3d-stage button[aria-label*="ACTIVE"], .twin-3d-stage button[aria-label*="STALE"], .twin-3d-stage button[aria-label*="OFFLINE"]').length === 7`);
  await delay(600);
  check('3D mode creates a WebGL canvas without horizontal overflow', await evaluate(`document.documentElement.scrollWidth <= innerWidth && !!document.querySelector('.twin-3d-stage canvas')`));
  check('3D scene renders four rooms and seven runtime markers', await evaluate(`document.querySelectorAll('.twin-3d-room-label').length === 4 && document.querySelectorAll('.twin-3d-stage button[aria-label*="ACTIVE"], .twin-3d-stage button[aria-label*="STALE"], .twin-3d-stage button[aria-label*="OFFLINE"]').length === 7`));
  await screenshot('default-isometric-desktop');

  await evaluate(`[...document.querySelectorAll('.twin-3d-room-label')].find(e => e.textContent.includes('Phòng khách')).click()`);
  await waitFor(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]') !== null`);
  check('room selection opens the runtime room inspector', await evaluate(`document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]').textContent.includes('1 thiết bị')`));
  await screenshot('selected-room');

  await evaluate(`[...document.querySelectorAll('.twin-3d-stage button')].find(e => e.getAttribute('aria-label')?.includes('Đèn chính')).click()`);
  await waitFor(`document.querySelector('[aria-label="Chi tiết thiết bị Đèn chính"]') !== null`);
  check('device marker selection shows current device state', await evaluate(`document.querySelector('[aria-label="Chi tiết thiết bị Đèn chính"]').textContent.includes('ONLINE')`));
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
  await delay(500);
  check('Fit to Home reframes the current room bounds', afterZoom !== await roomLabelRect('Phòng khách'));
  await click('Chế độ 2D');
  check('switching back preserves the existing 2D layout', await evaluate(`document.querySelectorAll('[data-room-id]').length === 4 && !document.querySelector('.twin-3d-stage canvas')`));

  await click('Home B'); await waitFor(`document.body.textContent.includes('Không gian sống · Nhà B')`); await click('Chế độ 3D');
  await waitFor(`document.body.textContent.includes('Chưa có sơ đồ nhà.')`);
  check('home switching clears old 3D rooms and renders the empty state', await evaluate(`!document.querySelector('.twin-3d-stage canvas') && document.body.textContent.includes('Chưa có sơ đồ nhà.')`));
  await screenshot('empty-layout');

  await click('Home A'); await waitFor(`document.body.textContent.includes('Không gian sống · Nhà mẫu · 4 phòng')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor('innerWidth === 390'); await click('Chế độ 3D');
  await waitFor(`document.querySelector('.twin-3d-stage canvas') !== null && !document.body.textContent.includes('Đang dựng không gian 3D')`);
  check('mobile 3D has no page-level horizontal overflow', await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
  await screenshot('mobile-390', true);

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
  await waitFor(`document.querySelectorAll('[data-twin-floor-label]').length === 3 && document.querySelector('button[role="combobox"][aria-label="Chọn tầng trong mô hình 3D"]')?.dataset.floorCount === '3'`);
  check('multi-floor fixture renders three selectable levels and fourteen markers', await evaluate(`document.querySelector('button[role="combobox"][aria-label="Chọn tầng trong mô hình 3D"]')?.dataset.floorCount === '3' && document.querySelectorAll('[data-twin-floor-label]').length === 3 && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 14`));
  check('exploded overview assigns higher world elevation to upper-floor nodes', await evaluate(`(() => { const y = label => Number([...document.querySelectorAll('.twin-3d-stage button[data-world-y]')].find(e => e.getAttribute('aria-label')?.includes(label)).dataset.worldY); return y('Đèn làm việc') > y('Điều hòa phòng chính') && y('Điều hòa phòng chính') > y('Đèn phòng khách'); })()`));
  await screenshot('multi-floor-exploded');
  await click('Chọn tầng trong mô hình 3D');
  await waitFor(`document.querySelector('[role="listbox"][aria-label="Chọn tầng trong mô hình 3D"]') !== null`);
  check('custom floor dropdown exposes the current selection and every floor', await evaluate(`document.querySelectorAll('[role="listbox"][aria-label="Chọn tầng trong mô hình 3D"] [role="option"]').length === 4 && document.querySelector('[role="listbox"][aria-label="Chọn tầng trong mô hình 3D"] [role="option"][aria-selected="true"]')?.dataset.value === 'all'`));
  await screenshot('multi-floor-dropdown-open');
  await click('Chọn tầng trong mô hình 3D');
  await chooseFloor('Chọn tầng trong mô hình 3D', 2);
  await waitFor(`document.querySelectorAll('.twin-3d-room-label').length === 3 && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 5`);
  check('floor drill-down isolates only rooms and markers from the selected floor', await evaluate(`[...document.querySelectorAll('.twin-3d-room-label')].length === 3 && [...document.querySelectorAll('.twin-3d-room-label')].every(e => e.textContent.includes('Tầng 2'))`));
  await screenshot('multi-floor-level-2');
  await chooseFloor('Chọn tầng trong mô hình 3D', 'all');
  await waitFor(`document.querySelectorAll('[data-twin-floor-label]').length === 3`);
  const explodedOfficeY = await evaluate(`Number([...document.querySelectorAll('.twin-3d-stage button[data-world-y]')].find(e => e.getAttribute('aria-label')?.includes('Đèn làm việc')).dataset.worldY)`);
  await click('Xếp chồng các tầng');
  await waitFor(`Number([...document.querySelectorAll('.twin-3d-stage button[data-world-y]')].find(e => e.getAttribute('aria-label')?.includes('Đèn làm việc')).dataset.worldY) < ${explodedOfficeY}`);
  check('stack control reduces inter-floor spacing without changing the floor data', await evaluate(`document.querySelectorAll('[data-twin-floor-label]').length === 3 && document.querySelectorAll('.twin-3d-stage button[data-world-y]').length === 14`));
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
  await writeFile(resolve(evidence, 'browser-results.json'), JSON.stringify({ results, errors, screenshots: ['default-isometric-desktop', 'selected-room', 'selected-device', 'health-stale', 'health-offline', 'selected-sensor-active', 'empty-layout', 'mobile-390', 'multi-floor-exploded', 'multi-floor-dropdown-open', 'multi-floor-level-2', 'multi-floor-stacked'] }, null, 2));
  await send('Browser.close');
} finally {
  socket?.close(); chrome.kill();
}
