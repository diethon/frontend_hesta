// Real canvas picking and capability commands in an isolated mock transport fixture.
// Start Vite first. Uses software WebGL so it also runs on headless CI hosts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const evidence = resolve('.tmp/twin-interaction-evidence');
const profile = resolve('.tmp/twin-architectural-chrome-' + Date.now());
const testUrl = process.env.TEST_3D_URL ?? 'http://localhost:5173/tests/twin-layout-preview.html?reference=1&models=1&interactions=1';
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
    } else {
      events.push(message);
      // Test navigation explicitly discards only this isolated fixture's draft.
      // Preserve the production beforeunload guard and answer its native prompt.
      if (message.method === 'Page.javascriptDialogOpening' && message.params.type === 'beforeunload') {
        void send('Page.handleJavaScriptDialog', { accept: true });
      }
    }
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
    for (let i = 0; i < 600; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
    console.error(await evaluate(`JSON.stringify({ text: document.body.innerText, floors: document.querySelectorAll('[data-twin-floor-label]').length, markers: document.querySelectorAll('.twin-3d-stage button[data-world-y]').length })`));
    console.error(JSON.stringify(events.filter(e => e.method==='Runtime.exceptionThrown' || e.method==='Log.entryAdded').slice(-8)));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async (text) => {
    const found = await evaluate(`(() => { const e = [...document.querySelectorAll('button,a,summary')].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)}); if (!e) return false; e.click(); return true; })()`);
    assert.ok(found, `Control exists: ${text}`); await delay(120);
  };
  const setTheme = async (theme) => {
    await evaluate(`(() => { const select = document.querySelector('select[aria-label="Ánh sáng mô hình 3D"]'); select.value = '${theme}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(`document.querySelector('.twin-3d-stage').dataset.theme === '${theme}'`);
  };
  const screenshot = async (name, fullPage = true) => {
    await evaluate('window.scrollTo(0, 0)');
    await evaluate('window.__twinFixtureFlushFrame()');
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
    // Distant room clusters deliberately replace individual DOM badges; devices
    // remain accessible through the real room-scoped sidebar.
    await waitFor(`document.querySelector('.twin-3d-marker[data-node-id="${id}"]') || [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Chọn thiết bị '+window.__twinFixtureScene().devices['${id}'].name)`);
    await evaluate(`(()=>{const marker=document.querySelector('.twin-3d-marker[data-node-id="${id}"]');const row=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Chọn thiết bị '+window.__twinFixtureScene().devices['${id}'].name);(marker||row).click()})()`);
  };
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Log.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1050, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: testUrl });
  await waitFor(`window.__twinFixtureScene?.()?.deviceModels.length === 13`);
  await settle();
  check('bright Daylight renderer is the default', await evaluate(`document.querySelector('.twin-3d-stage').dataset.theme==='DAYLIGHT'`));
  check('desktop uses real house explorer scene and control columns', await evaluate(`!!document.querySelector('[aria-label="Sơ đồ nhà"]') && !!document.querySelector('[aria-label="Bảng điều khiển thông minh"]') && !!document.querySelector('[aria-label="Thống kê ngôi nhà"]')`));
  check('shared HESTA sidebar retains every home navigation item and selected Twin', await evaluate(`(()=>{const nav=document.querySelector('.app-sidebar nav');return !!nav && nav.querySelectorAll('button').length>=7 && nav.querySelector('[aria-current="page"]')?.textContent.includes('Digital Twin')})()`));
  check('Twin content clears the fixed application sidebar', await evaluate(`document.querySelector('.twin-premium-dashboard').getBoundingClientRect().left>=256`));
  check('sensor history is never replaced with fabricated charts', await evaluate(`document.querySelectorAll('[aria-label="Thống kê ngôi nhà"] canvas,[aria-label="Thống kê ngôi nhà"] svg polyline').length===0`));
  await screenshot('desktop-overview');
  const roomCamera = (await scene()).camera;
  const roomGeometry = (await scene()).meshes.filter(mesh => mesh.role === 'solid').map(mesh => mesh.geometry);
  await click('Xem phòng Phòng ngủ');
  await settle();
  check('room selection preserves camera and architectural geometry', (await scene()).camera.every((value, index) => Math.abs(value-roomCamera[index]) < .01) && JSON.stringify((await scene()).meshes.filter(mesh => mesh.role === 'solid').map(mesh => mesh.geometry)) === JSON.stringify(roomGeometry));
  check('room info follows the selected business room', await evaluate(`document.querySelector('[aria-label="Thông tin phòng"]').textContent.includes('Phòng ngủ')`));
  await click('Đóng chi tiết');
  const expandedWidth = (await rect('.twin-3d-stage')).width;
  await click('Ẩn hoặc hiện bảng điều khiển');
  await settle();
  check('hiding controls gives the scene more space', (await rect('.twin-3d-stage')).width > expandedWidth && await evaluate(`!document.querySelector('.twin-controls-column')`));
  await click('Ẩn hoặc hiện bảng điều khiển');
  await settle();
  if (!process.env.TWIN_DASHBOARD_ONLY) {
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
  await evaluate('window.__twinFixtureCommandHold=true');
  await click('Bật');
  check('command locks duplicate controls while awaiting ACK', await evaluate(`document.querySelector('[aria-label="Điều khiển thiết bị"] button[aria-label="Bật"]').disabled`));
  await evaluate('window.__twinFixtureCommandHold=false');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]').textContent.includes('Thiết bị đã xác nhận')`);
  check('power goes through existing manual command endpoint', await evaluate(`window.__twinFixtureRequests().some(r=>r.method==='post' && r.url==='/devices/main-light/commands' && r.body.action==='TURN_ON')`));
  check('ACK alone does not change confirmed OFF state', (await scene()).devices['main-light'].currentState.power === 'OFF');
  await evaluate(`window.__twinFixtureEmitDevice('main-light', {power:'ON',brightness:35,r:40,g:90,b:180})`);
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"] button[aria-label="Tắt"]')`);
  check('WebSocket state changes physical illumination', (await scene()).lights.some((light) => light.intensity > 0 && light.color === '285ab4'));
  const wallsBeforeColors = (await scene()).meshes.filter((mesh) => mesh.role === 'solid').map((mesh) => mesh.geometry);
  await setTheme('COZY');
  for (const [name, r, g, b, hex] of [['red',255,40,30,'ff281e'],['green',30,230,70,'1ee646'],['blue',35,90,255,'235aff']]) {
    await evaluate(`window.__twinFixtureEmitDevice('main-light',{power:'ON',brightness:'75',color:{r:${r},g:${g},b:${b}}})`);
    await waitFor(`window.__twinFixtureScene().deviceModels.find(d=>d.id==='DEVICE:main-light').diffusers.includes('${hex}')`);
    check(`confirmed ${name} reaches both the visible diffuser and physical light`, (await scene()).lights.some((light) => light.color === hex && light.intensity > 0));
    await screenshot(`confirmed-light-${name}`);
  }
  check('RGB updates keep architectural geometry intact', JSON.stringify((await scene()).meshes.filter((mesh) => mesh.role === 'solid').map((mesh) => mesh.geometry)) === JSON.stringify(wallsBeforeColors));
  await evaluate(`window.__twinFixtureEmitDevice('main-light',{power:'ON',brightness:'15',color:'#235aff'})`);
  await waitFor(`window.__twinFixtureScene().lights.some(l=>l.color==='235aff'&&l.intensity===2.4)`);
  check('numeric-string brightness changes physical intensity', (await scene()).lights.some((light) => light.color === '235aff' && light.intensity === 2.4));
  await screenshot('confirmed-light-dimmed');
  await evaluate(`window.__twinFixtureEmitDevice('main-light',{power:'OFF',brightness:75,color:'#235aff'})`);
  await waitFor(`!window.__twinFixtureScene().lights.some(l=>l.color==='235aff')`);
  check('OFF removes actual colored light and emission', (await scene()).deviceModels.find((model) => model.id === 'DEVICE:main-light').emissive === 0);
  await screenshot('confirmed-light-off');
  await evaluate(`window.__twinFixtureEmitDevice('main-light',{power:'ON',brightness:35,r:40,g:90,b:180})`);
  await setTheme('DAYLIGHT');
  await waitFor(`window.__twinFixtureScene().lights.some(l=>l.color==='285ab4')`);
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
  await waitFor(`JSON.stringify(window.__twinFixtureScene().deviceModels.find(item => item.id === 'DEVICE:door').geometry) !== ${JSON.stringify(JSON.stringify(doorBefore))}`);
  check('confirmed opening state changes actual door geometry', JSON.stringify((await scene()).deviceModels.find((item) => item.id === 'DEVICE:door').geometry) !== JSON.stringify(doorBefore));
  await evaluate(`window.__twinFixtureCommandFailure=true`);
  await click('Đóng cửa');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"] [role="alert"]') !== null`);
  check('failed command is visible and keeps confirmed state', (await scene()).devices.door.currentState.open === true);
  await evaluate(`window.__twinFixtureCommandFailure=false`);
  await click('Đóng chi tiết');
  await clickNode('camera');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]')?.textContent.includes('chưa hỗ trợ điều khiển từ xa')`);
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
  await evaluate(`window.__twinFixtureEmitDevice('fan',{power:'ON',fan:'HIGH'})`);
  const fanRunning = (await scene()).deviceModels.find((model) => model.id === 'DEVICE:fan').animation;
  await delay(300);
  check('backend fan HIGH state rotates physical blades', JSON.stringify((await scene()).deviceModels.find((model) => model.id === 'DEVICE:fan').animation) !== JSON.stringify(fanRunning));
  await evaluate(`window.__twinFixtureEmitDevice('fan',{power:'ON',speed:'0'})`);
  await delay(200);
  const fanStopped = (await scene()).deviceModels.find((model) => model.id === 'DEVICE:fan').animation;
  await delay(200);
  check('confirmed numeric-string zero speed stops blades', JSON.stringify((await scene()).deviceModels.find((model) => model.id === 'DEVICE:fan').animation) === JSON.stringify(fanStopped));
  await screenshot('desktop-selected-light');
  await click('Đóng chi tiết');
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await settle();
  check('1440px displays explorer, scene and controls without overflow', await evaluate(`document.querySelector('.twin-3d-stage').getBoundingClientRect().width>=500 && !!document.querySelector('.twin-explorer-column') && !!document.querySelector('.twin-controls-column') && document.documentElement.scrollWidth<=window.innerWidth+1`));
  await screenshot('laptop-with-hesta-navigation');
  check('clustered rooms show their name without a duplicate room label', await evaluate(`(()=>{const clusters=[...document.querySelectorAll('[data-twin-marker-cluster]')];return clusters.every(cluster=>cluster.querySelector('strong')?.textContent.trim() && ![...document.querySelectorAll('[data-twin-room-id]')].some(label=>label.dataset.twinRoomId===cluster.dataset.twinMarkerCluster));})()`));
  await send('Emulation.setDeviceMetricsOverride', {width:1280,height:1050,deviceScaleFactor:1,mobile:false});
  await settle();
  await click('Danh sách tầng và phòng');
  check('laptop floor explorer remains accessible in a modal', await evaluate(`!!document.querySelector('dialog[open].twin-panel-left')`));
  await click('Đóng bảng điều khiển');
  await send('Emulation.setDeviceMetricsOverride', {width:768,height:1024,deviceScaleFactor:1,mobile:false});
  await settle();
  await click('Mở điều khiển thông minh');
  await evaluate(`document.querySelector('dialog[open] button[aria-label^="Chọn thiết bị "]').click()`);
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"]')`);
  await waitFor(`(()=>{const p=document.querySelector('[aria-label="Điều khiển thiết bị"]');if(!p?.querySelector('input[type="color"]'))return false;const b=p.getBoundingClientRect();return b.top>=0&&b.top<window.innerHeight-80})()`);
  check('tablet selection brings control panel into view', await evaluate(`(()=>{const b=document.querySelector('[aria-label="Điều khiển thiết bị"]').getBoundingClientRect();return b.top>=0&&b.top<window.innerHeight-80})()`));
  check('tablet has no horizontal page overflow', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth+1`));
  check('tablet controls use a native modal drawer', await evaluate(`!!document.querySelector('dialog[open].twin-panel-right')`));
  await screenshot('tablet-interactions');
  await send('Emulation.setDeviceMetricsOverride', {width:320,height:860,deviceScaleFactor:1,mobile:false});
  await delay(600);
  check('320px layout keeps room navigation and controls within the page', await evaluate(`document.documentElement.scrollWidth <= window.innerWidth+1`));
  await screenshot('mobile-interactions');
  await send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await waitFor(`document.querySelector('dialog[open]')===null`);
  check('mobile bottom sheet closes with Escape', await evaluate(`document.querySelector('dialog[open]')===null`));
  }
  await send('Emulation.setDeviceMetricsOverride', {width:1600,height:1050,deviceScaleFactor:1,mobile:false});
  if (!process.env.TWIN_INTERACTION_ONLY) {
  const multiFloorUrl = new URL(testUrl); multiFloorUrl.search='?multifloor=1&interactions=1'; multiFloorUrl.hash='';
  await send('Page.navigate',{url:multiFloorUrl.href});
  await waitFor(`window.__twinFixtureScene?.()?.floors.length===3`); await settle();
  check('whole-house default preserves three actual layout storeys', await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='house'`));
  await screenshot('premium-whole-house');
  await click('Xem tầng 2'); await waitFor(`window.__twinFixtureScene().floors.length===1`); await settle();
  check('House Explorer selects and fits the actual second floor', (await scene()).floors[0].name.endsWith(':floor:2'));
  await screenshot('premium-single-floor');
  const floorFraming = (await scene()).extent;
  check('single floor fills 70–85 percent of the limiting viewport axis', Math.max(floorFraming.width, floorFraming.height)>=.7 && Math.max(floorFraming.width, floorFraming.height)<=.85);
  const direction = snapshot => {
    const offset = snapshot.camera.map((value,i) => value-snapshot.target[i]);
    const length = Math.hypot(...offset);
    return offset.map(value => value/length);
  };
  const floorDirection = direction(await scene()), floorTarget = (await scene()).target;
  for (const theme of ['BLUEPRINT', 'NIGHT', 'DAYLIGHT']) {
    await evaluate(`(()=>{const s=document.querySelector('select[aria-label="Ánh sáng mô hình 3D"]');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor(`document.querySelector('.twin-3d-stage').dataset.theme==='${theme}'`);
    await delay(400);
    await settle();
    const themed = await scene();
    // Full-page capture can briefly resize the viewport. Radius may refit to
    // that aspect; the user's viewing direction and focal point must remain.
    check(`${theme} preserves camera view and framing`, direction(themed).every((value,i)=>Math.abs(value-floorDirection[i])<.001) && themed.target.every((value,i)=>Math.abs(value-floorTarget[i])<.01) && Math.max(themed.extent.width,themed.extent.height)>=.7 && Math.max(themed.extent.width,themed.extent.height)<=.86);
    check(`${theme} keeps the shared HESTA application palette`, await evaluate(`(()=>{const app=getComputedStyle(document.documentElement),twin=getComputedStyle(document.querySelector('.twin-premium-dashboard'));return ['--color-app','--color-primary','--color-primary-hover','--color-text','--color-muted','--color-line','--color-sidebar-active'].every(token=>twin.getPropertyValue(token).trim()===app.getPropertyValue(token).trim())})()`));
    await screenshot('premium-theme-'+theme.toLowerCase());
  }
  await click('Cả ngôi nhà'); await waitFor(`window.__twinFixtureScene().floors.length===3`); await settle();
  const houseSpacing=(await scene()).floors.map(f=>f.y).sort((a,b)=>a-b);
  await click('Hiển thị nâng cao'); await click('Tách tầng'); await settle();
  const explodedSpacing=(await scene()).floors.map(f=>f.y).sort((a,b)=>a-b);
  check('exploded mode separates storeys only when explicitly requested', explodedSpacing[2]-explodedSpacing[0]>houseSpacing[2]-houseSpacing[0]);
  await screenshot('premium-exploded');
  await click('Cả ngôi nhà'); await settle();
  await click('Hiện vị trí thiết bị và cảm biến');
  for (let i=0;i<4;i++) await click('Thu nhỏ mô hình');
  await settle();
  await waitFor(`document.querySelectorAll('[data-twin-marker-cluster]').length>0`);
  check('distant markers cluster by actual room', await evaluate(`document.querySelectorAll('[data-twin-marker-cluster]').length>0`));
  await screenshot('premium-marker-clusters');
  await evaluate(`document.querySelector('[data-twin-marker-cluster]').click()`); await settle();
  check('room cluster remains actionable and focuses the room', await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='single'`));
  }
  const errors = events.filter((event) => event.method === 'Runtime.exceptionThrown');
  check('no uncaught browser exceptions', errors.length === 0);
  await writeFile(resolve(evidence, process.env.TWIN_DASHBOARD_ONLY ? 'dashboard-results.json' : 'results.json'), JSON.stringify({results,errors,note:'Isolated real WebGL browser with mocked HESTA REST/WebSocket transport; no hardware commands.'},null,2));
  await send('Browser.close');
} finally { socket?.close(); chrome.kill(); }
