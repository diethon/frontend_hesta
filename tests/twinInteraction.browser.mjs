// Real canvas picking and capability commands in an isolated mock transport fixture.
// Start Vite first. Uses software WebGL so it also runs on headless CI hosts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const evidence = resolve('.tmp/twin-interaction-evidence');
const profile = resolve('.tmp/twin-architectural-chrome-' + Date.now());
const testUrl = process.env.TEST_3D_URL ?? 'http://127.0.0.1:5173/tests/twin-layout-preview.html?reference=1&models=1&interactions=1';
assert.ok((await fetch(testUrl)).ok, 'Vite fixture must be running before WebGL verification');
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
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 60000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 600; i++) { if (await evaluate(expression)) return; await delay(100); }
    console.error(await evaluate(`JSON.stringify({ text: document.body.innerText, floors: document.querySelectorAll('[data-twin-floor-label]').length, markers: document.querySelectorAll('.twin-3d-stage button[data-world-y]').length })`));
    console.error(JSON.stringify(events.filter(e => e.method==='Runtime.exceptionThrown' || e.method==='Log.entryAdded').slice(-8)));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (text) => {
    const found = await evaluate(`(() => { const e = [...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!e) return false; e.click(); return true; })()`);
    assert.ok(found, `Control exists: ${text}`); await delay(120);
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

  const scene = () => evaluate('window.__twinFixtureScene()');
  const settle = () => evaluate(`new Promise((resolve,reject) => { let last='', stable=0, ticks=0; const rounded=values=>values?.map(v=>Math.round(v*10000)); const tick=()=>{const scene=window.__twinFixtureScene(); const value=scene && JSON.stringify({camera:rounded(scene.camera),target:rounded(scene.target),floors:scene.floors.map(f=>Math.round(f.y*1000))}); stable=value===last?stable+1:0;last=value;if(stable>=6)resolve();else if(++ticks>200)reject(new Error('Camera did not settle: '+value));else setTimeout(tick,120);};tick();})`);
  const clickNode = async id => {
    await waitFor(`document.querySelector('.twin-3d-marker[data-node-id="${id}"]') !== null`);
    await evaluate(`document.querySelector('.twin-3d-marker[data-node-id="${id}"]').click()`);
  };
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Log.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: testUrl });
  await waitFor(`window.__twinFixtureScene?.()?.deviceModels.length === 13`);
  await settle();
  check('bright Daylight renderer is the default', await evaluate(`document.querySelector('.twin-3d-stage').dataset.theme==='DAYLIGHT'`));
  await screenshot('desktop-overview');
  const snapshotCount = (await scene()).snapshotRequests;
  const cameraBefore = (await scene()).camera;
  const lamp = (await scene()).deviceModels.find((item) => item.id === 'DEVICE:main-light');
  const canvas = await rect('.twin-3d-stage canvas');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: canvas.x + lamp.screen[0], y: canvas.y + lamp.screen[1], button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: canvas.x + lamp.screen[0], y: canvas.y + lamp.screen[1], button: 'left', clickCount: 1 });
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"] input[type="color"]')`);
  check('single click on physical lamp opens actual capability panel', await evaluate(`!!document.querySelector('[aria-label="Chi tiết thiết bị Đèn chính"]')`));
  check('single click leaves camera stable for subsequent double-click', (await scene()).camera.every((value, i) => Math.abs(value - cameraBefore[i]) < .01));
  check('empty POWER group still exposes power control', await evaluate(`!!document.querySelector('[aria-label="Điều khiển thiết bị"] button[aria-label="Tắt"]:not(:disabled)')`));
  await evaluate(`window.__twinFixtureEmitDevice('main-light', {power:'OFF',brightness:35,r:40,g:90,b:180})`);
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"] button[aria-label="Bật"]')`);
  await click('Bật');
  check('command locks duplicate controls while awaiting ACK', await evaluate(`document.querySelector('[aria-label="Điều khiển thiết bị"] button[aria-label="Bật"]').disabled`));
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]').textContent.includes('Thiết bị đã xác nhận')`);
  check('power goes through existing manual command endpoint', await evaluate(`window.__twinFixtureRequests().some(r=>r.method==='post' && r.url==='/devices/main-light/commands' && r.body.action==='TURN_ON')`));
  check('ACK alone does not change confirmed OFF state', (await scene()).devices['main-light'].currentState.power === 'OFF');
  await evaluate(`window.__twinFixtureEmitDevice('main-light', {power:'ON',brightness:35,r:40,g:90,b:180})`);
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"] button[aria-label="Tắt"]')`);
  check('WebSocket state changes physical illumination', (await scene()).lights.some((light) => light.intensity > 0 && light.color === '285ab4'));
  const colorsBefore = await evaluate(`window.__twinFixtureRequests().filter(r=>r.method==='post').length`);
  await evaluate(`(() => {const input=document.querySelector('input[type="color"]'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'#ad7240');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  check('choosing a color stays a draft until Apply', await evaluate(`window.__twinFixtureRequests().filter(r=>r.method==='post').length`) === colorsBefore);
  await click('Áp dụng màu đèn');
  await waitFor(`window.__twinFixtureRequests().some(r=>r.method==='post' && r.url==='/devices/main-light/command' && r.body.action==='SET_RGB')`);
  check('RGB picker sends the chosen channel values', await evaluate(`JSON.stringify(window.__twinFixtureRequests().filter(r=>r.method==='post').at(-1).body.parameters)===JSON.stringify({r:173,g:114,b:64})`));
  check('RGB-only capability uses its declared action', await evaluate(`window.__twinFixtureRequests().filter(r=>r.method==='post').at(-1).body.action==='SET_RGB'`));
  await waitFor(`!document.querySelector('[aria-label="Điều khiển thiết bị"] button').disabled`);
  await click('Đóng chi tiết');
  await click('Hiện vị trí thiết bị và cảm biến');
  check('visible device discovery toggle enables markers', await evaluate(`document.querySelector('.twin-3d-stage').dataset.markerMode==='all'`));
  await clickNode('door');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]')?.textContent.includes('Mở cửa')`);
  check('empty GATE group exposes OPEN CLOSE STOP controls', await evaluate(`['Mở cửa','Đóng cửa','Dừng cửa'].every(text=>[...document.querySelectorAll('[aria-label="Điều khiển thiết bị"] button')].some(b=>b.textContent===text))`));
  await click('Mở cửa');
  await waitFor(`window.__twinFixtureRequests().some(r=>r.method==='post' && r.url==='/devices/door/command' && r.body.action==='OPEN')`);
  check('opening command leaves door unchanged until realtime', (await scene()).devices.door.currentState.open === false);
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]').textContent.includes('Thiết bị đã xác nhận')`);
  const doorBefore = (await scene()).deviceModels.find((item) => item.id === 'DEVICE:door').geometry;
  await evaluate(`window.__twinFixtureEmitDevice('door', {state:'OPEN',open:true})`);
  await delay(900);
  check('confirmed opening state changes actual door geometry', JSON.stringify((await scene()).deviceModels.find((item) => item.id === 'DEVICE:door').geometry) !== JSON.stringify(doorBefore));
  await evaluate(`window.__twinFixtureCommandFailure=true`);
  await click('Đóng cửa');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"] [role="alert"]') !== null`);
  check('failed command is visible and keeps confirmed state', (await scene()).devices.door.currentState.open === true);
  await evaluate(`window.__twinFixtureCommandFailure=false`);
  await click('Đóng chi tiết');
  await clickNode('camera');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]')?.textContent.includes('chỉ đọc')`);
  check('read-only camera never gains invented power controls', await evaluate(`document.querySelectorAll('[aria-label="Điều khiển thiết bị"] button').length===0`));
  await screenshot('desktop-interactions');
  await click('Đóng chi tiết');
  await click('Hiện vị trí thiết bị và cảm biến');
  await settle();
  const beforeFocus = await scene();
  const screen = beforeFocus.deviceModels.find((item) => item.id === 'DEVICE:main-light').screen;
  const box = await rect('.twin-3d-stage canvas');
  for (const count of [1, 2]) {
    await send('Input.dispatchMouseEvent', {type:'mousePressed',x:box.x+screen[0],y:box.y+screen[1],button:'left',clickCount:count});
    await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:box.x+screen[0],y:box.y+screen[1],button:'left',clickCount:count});
  }
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"] input[type="color"]')`);
  await settle();
  check('double click on geometry smoothly focuses selected device', (await scene()).camera.some((value,i)=>Math.abs(value-beforeFocus.camera[i])>.1));
  check('interaction does not refetch whole house', (await scene()).snapshotRequests === snapshotCount);
  await screenshot('desktop-selected-light');
  await click('Đóng chi tiết');
  await send('Emulation.setDeviceMetricsOverride', {width:768,height:1024,deviceScaleFactor:1,mobile:false});
  await settle();
  await evaluate(`document.querySelector('[aria-label="Thiết bị trong không gian"] button').click()`);
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"]')`);
  await delay(800);
  check('tablet selection brings control panel into view', await evaluate(`(()=>{const b=document.querySelector('[aria-label="Bảng điều khiển ngôi nhà"]').getBoundingClientRect();return b.top>=-10&&b.top<window.innerHeight})()`));
  check('tablet has no horizontal page overflow', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth+1`));
  await screenshot('tablet-interactions');
  await send('Emulation.setDeviceMetricsOverride', {width:320,height:860,deviceScaleFactor:1,mobile:false});
  await delay(600);
  check('320px layout keeps room navigation and controls within the page', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth+1`));
  await screenshot('mobile-interactions');
  const errors = events.filter((event) => event.method === 'Runtime.exceptionThrown');
  check('no uncaught browser exceptions', errors.length === 0);
  await writeFile(resolve(evidence, 'results.json'), JSON.stringify({results,errors,note:'Isolated real WebGL browser with mocked HESTA REST/WebSocket transport; no hardware commands.'},null,2));
  await send('Browser.close');
} finally { socket?.close(); chrome.kill(); }
