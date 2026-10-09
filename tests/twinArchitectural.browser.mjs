// Real Chromium WebGL, selection, realtime, fallback and responsive checks.
// Start Vite first. Uses software WebGL so it also runs on headless CI hosts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const evidence = resolve('docs/evidence/neonplan-port');
const optimizationEvidence = resolve('docs/evidence/twin-optimization');
const profile = resolve('.tmp/twin-architectural-chrome-' + Date.now());
const testUrl = process.env.TEST_3D_URL ?? 'http://127.0.0.1:5173/tests/twin-layout-preview.html?reference=1';
assert.ok((await fetch(testUrl)).ok, 'Vite fixture must be running before WebGL verification');
const multiFloorUrl = new URL(testUrl);
multiFloorUrl.search = '?multifloor=1';
multiFloorUrl.hash = '';
await mkdir(evidence, { recursive: true });
await mkdir(optimizationEvidence, { recursive: true });
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
    await writeFile(resolve(optimizationEvidence, name + '.png'), Buffer.from(data, 'base64'));
  };
  const rect = (selector) => evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height}; })()`);

  const scene = () => evaluate('window.__twinFixtureScene()');
  const settle = () => evaluate(`new Promise((resolve,reject) => { let last='', stable=0, ticks=0; const rounded=values=>values?.map(v=>Math.round(v*10000)); const tick=()=>{const scene=window.__twinFixtureScene(); const value=scene && JSON.stringify({camera:rounded(scene.camera),target:rounded(scene.target),floors:scene.floors.map(f=>Math.round(f.y*1000))}); stable=value===last?stable+1:0;last=value;if(stable>=6)resolve();else if(++ticks>200)reject(new Error('Camera did not settle: '+value));else setTimeout(tick,120);};tick();})`);
  const stageScreenshot = async name => { await evaluate('window.scrollTo(0,0)'); const b=await rect('.twin-3d-stage'); const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...b,scale:1}});await writeFile(resolve(evidence,name+'.png'),Buffer.from(data,'base64')); };
  const clickRoom = id => evaluate(`document.querySelector('[data-twin-room-id="${id}"]').click()`);
  const clickNode = id => evaluate(`document.querySelector('.twin-3d-marker[data-node-id="${id}"]').click()`);
  const geometryIds = s => s.meshes.filter(m=>m.role==='solid').map(m=>m.geometry);
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Log.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: testUrl });
  await waitFor(`document.querySelector('.twin-3d-stage canvas') !== null && window.__twinFixtureScene()?.render.triangles>1000`); await settle();
  const initial=await scene();
  check('actual WebGL scene renders architecture and merged procedural furniture',initial.render.triangles>10000 && initial.meshes.some(m=>m.role==='solid' && m.positions>5000));
  check('default view is HOUSE / auto walls / important markers',await evaluate(`(()=>{const s=document.querySelector('.twin-3d-stage');return s.dataset.floorMode==='house'&&s.dataset.wallMode==='auto'&&s.dataset.markerMode==='important';})()`));
  check('house fills 70–85% of limiting viewport dimension',Math.max(initial.extent.width,initial.extent.height)>=.7 && Math.max(initial.extent.width,initial.extent.height)<=.86);
  check('only two warnings have markers; seven objects still have physical models',await evaluate(`document.querySelectorAll('.twin-3d-marker').length===2`) && initial.deviceModels.length===7);
  check('no permanent inspector consumes viewport',await evaluate(`!document.querySelector('.twin-3d-panel')`));
  check('room labels use real four room identifiers',await evaluate(`document.querySelectorAll('[data-twin-room-id]').length===4`));
  check('lamp power produces actual PointLights and emissive models',initial.lights.length===2&&initial.deviceModels.find(d=>d.id==='DEVICE:main-light').emissive>0);
  await screenshot('house-day-desktop'); await stageScreenshot('house-day-viewport');
  check('DAYLIGHT is the renderer default', await evaluate(`document.querySelector('.twin-3d-stage').dataset.theme==='DAYLIGHT'`));
  check('legacy coordinates are explicitly INFERRED', await evaluate(`document.querySelector('[data-geometry-source]').dataset.geometrySource==='INFERRED'`));
  check('desktop pixel ratio is bounded', initial.dpr <= 1.5);
  for (const [label,theme,background] of [['Blueprint','BLUEPRINT','153747'],['Night','NIGHT','182738'],['Daylight','DAYLIGHT','e9eff4']]) {
    await click(label); await settle();
    check(`${theme} changes only the renderer and retains architecture geometry`, await evaluate(`document.querySelector('.twin-3d-stage').dataset.theme===${JSON.stringify(theme)}`) && JSON.stringify(geometryIds(await scene()))===JSON.stringify(geometryIds(initial)));
    check(`${theme} updates the actual Three.js background`, (await scene()).background===background);
    await screenshot('theme-'+theme.toLowerCase()+'-desktop');
  }
  const initialMasks=initial.meshes.find(m=>m.role==='solid').masks.glass.value;
  await click('Mặt sau'); await settle();
  check('orbit changes camera-facing wall glass buckets', (await scene()).meshes.find(m=>m.role==='solid').masks.glass.value!==initialMasks);
  await screenshot('camera-back-auto');
  await click('Cắt tường'); await settle();
  check('cut mode hides upper wall vertices through GPU masks',(await scene()).meshes.filter(m=>m.role==='solid').every(m=>m.masks.standing.value===0&&m.masks.glass.value===0));
  await click('Phối cảnh'); await settle(); await screenshot('floor-cutaway'); await stageScreenshot('floor-cutaway-viewport');
  await click('Từ trên'); await settle(); await screenshot('top-floor-plan');
  check('top view moves camera above architecture',(await scene()).camera[1]>(await scene()).camera[0]);
  await click('Phối cảnh'); await click('Tường tự động'); await settle();
  await click('Tất cả');
  await waitFor(`document.querySelector('.twin-3d-stage').dataset.markerMode==='all' && document.querySelectorAll('.twin-3d-marker').length===7`);
  check('explicit markers ALL reveals all seven nodes',await evaluate(`document.querySelectorAll('.twin-3d-marker').length===7`));
  await click('Ẩn marker'); await waitFor(`document.querySelectorAll('.twin-3d-marker').length===0`); check('markers can be hidden',await evaluate(`document.querySelectorAll('.twin-3d-marker').length===0`));
  await click('Quan trọng');
  await clickRoom('living'); await settle();
  check('select room opens room panel without replacing house geometry',await evaluate(`!!document.querySelector('[aria-label="Chi tiết phòng Phòng khách"]')`) && JSON.stringify(geometryIds(await scene()))===JSON.stringify(geometryIds(initial)));
  await screenshot('selected-room');
  await click('Đóng chi tiết'); await settle();
  check('closing inspector expands the canvas', (await scene()).size.width>1000);
  await click('Danh sách phòng và thiết bị'); await click('Đèn chính'); await settle();
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]')?.textContent.includes('Bật')`);
  check('tree device selection opens capability controls and focuses device',await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='single' && !!document.querySelector('[aria-label="Điều khiển thiết bị"] input[type="color"]')`));
  await screenshot('selected-device');
  await evaluate(`document.querySelector('details').open=true`);
  await click('Device → OFF'); await settle();
  const off=await scene();
  check('backend OFF event removes only its light and emissive state',off.lights.length===1&&off.deviceModels.find(d=>d.id==='DEVICE:main-light').emissive===0);
  check('device event leaves merged architectural geometry identities unchanged',JSON.stringify(geometryIds(off))===JSON.stringify(geometryIds(initial)));
  await screenshot('light-off');
  await click('Bật');
  await waitFor(`document.querySelector('[aria-label="Điều khiển thiết bị"]')?.textContent.includes('đã xác nhận')`);
  check('successful command ACK does not optimistically turn the light on',(await scene()).devices['main-light'].currentState.power==='OFF'&&(await scene()).lights.length===1);
  await click('Device → RGB 35%'); await settle();
  const rgb=await scene();
  check('confirmed RGB and brightness update PointLight colour / intensity',rgb.lights.some(l=>l.color==='ff642d'&&Math.abs(l.intensity-5.6)<.01));
  await screenshot('light-rgb');
  await click('Đóng chi tiết'); await click('Toàn bộ nhà'); await settle();
  await click('Nhiệt độ'); await settle();
  check('stale temperature leaves floor neutral',(await scene()).roomSurfaces.find(r=>r.id==='living').opacity===0);
  await click('Sensor → 30'); await settle();
  const heat=await scene();
  check('fresh temperature event colours actual room surface',heat.roomSurfaces.find(r=>r.id==='living').opacity>.7&&heat.roomSurfaces.find(r=>r.id==='living').color!==initial.roomSurfaces.find(r=>r.id==='living').color);
  check('sensor event does not refetch the house or rebuild walls',heat.snapshotRequests===1&&JSON.stringify(geometryIds(heat))===JSON.stringify(geometryIds(initial)));
  await screenshot('temperature-heatmap'); await stageScreenshot('temperature-heatmap-viewport');
  await click('Bình thường'); await settle(); check('Normal completely removes surface heatmap',(await scene()).roomSurfaces.every(r=>r.opacity===0));
  await click('Độ ẩm'); await settle(); check('humidity heatmap uses matching sensor surfaces',(await scene()).roomSurfaces.filter(r=>r.opacity>.7).length===2); await screenshot('humidity-heatmap');
  await click('CO₂'); await settle(); check('CO2 never borrows temperature or humidity readings',(await scene()).roomSurfaces.every(r=>r.opacity===0));
  await click('Bình thường');
  for (const [width,height] of [[1024,900],[768,1024],[390,844],[320,760]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
    check(`viewport ${width}px has no horizontal overflow`,await evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
    check(`viewport ${width}px refits actual house`,Math.max((await scene()).extent.width,(await scene()).extent.height)<=1);
    await screenshot('responsive-'+width);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:multiFloorUrl.href});
  await waitFor(`window.__twinFixtureScene?.()?.floors.length===3`);await settle();
  const whole=await scene();
  check('multi-floor HOUSE is default with architectural elevation',await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='house'`)&&whole.floors.map(f=>f.y).every((y,i)=>Math.abs(y-i*2.5)<.01));
  check('whole-house overview suppresses room label piles',await evaluate(`document.querySelectorAll('[data-twin-room-id]').length===0`));
  await screenshot('whole-house-default');await stageScreenshot('whole-house-viewport');
  await click('Tách tầng');await settle();const exploded=await scene();
  check('EXPLODED is opt-in and increases each storey gap',exploded.floors[2].y-whole.floors[2].y>4.5);
  await screenshot('exploded-floors');await stageScreenshot('exploded-viewport');
  await chooseFloor('Chọn tầng trong mô hình 3D',2);await settle();
  check('floor navigation isolates and focuses SINGLE FLOOR',(await scene()).floors.length===1&&(await scene()).floors[0].name.endsWith(':2')&&await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='single'`));
  await screenshot('single-floor');await stageScreenshot('single-floor-viewport');
  await click('Toàn bộ nhà');await settle();check('whole-house navigation restores all three architectural floors',(await scene()).floors.length===3&&await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='house'`));
  await click('Chỉnh sửa trong 2D');
  await waitFor(`!!document.querySelector('button') && [...document.querySelectorAll('button')].some(b=>b.textContent.includes('Lưu bố cục')&&!b.disabled)`);
  await click('Lưu bố cục');
  await waitFor(`document.querySelector('[data-geometry-source]')?.dataset.geometrySource==='PERSISTED'`);
  check('explicit Save persists inferred architecture through the existing layout API', await evaluate(`document.querySelector('[data-geometry-source]').dataset.geometrySource==='PERSISTED'`));
  await send('Page.reload');
  await waitFor(`document.querySelector('[data-geometry-source]')?.dataset.geometrySource==='PERSISTED' && window.__twinFixtureScene?.()?.floors.length===3`);await settle();
  check('backend layout reload retains all three persisted storeys', (await scene()).floors.length===3);
  await screenshot('persisted-whole-house-desktop');
  const modelUrl=new URL(testUrl);modelUrl.search='?reference=1&models=1';modelUrl.hash='';await send('Page.navigate',{url:modelUrl.href});
  await waitFor(`window.__twinFixtureScene?.()?.deviceModels.length===13`);await settle();
  const modelInitial=await scene();
  check('fan / camera / TV / door / window / blind all render physical geometry',['fan','camera','tv','door','window','blind'].every(id=>modelInitial.deviceModels.find(d=>d.id==='DEVICE:'+id)?.meshes>0));
  // Hit the actual Three.js lamp geometry, rather than a DOM marker or sidebar button.
  const lampScreen=modelInitial.deviceModels.find(d=>d.id==='DEVICE:main-light').screen, canvasRect=await rect('.twin-3d-stage canvas');
  for (let count=1;count<=2;count++) {
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:canvasRect.x+lampScreen[0],y:canvasRect.y+lampScreen[1],button:'left',clickCount:count});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:canvasRect.x+lampScreen[0],y:canvasRect.y+lampScreen[1],button:'left',clickCount:count});
  }
  await waitFor(`!!document.querySelector('[aria-label="Điều khiển thiết bị"]')`);await settle();
  check('double click physical lamp opens panel and fits mounted model',await evaluate(`document.querySelector('.twin-3d-stage').dataset.floorMode==='single'`)&&(await scene()).size.width<modelInitial.size.width);
  await screenshot('model-double-click-focus');await click('Đóng chi tiết');await click('Toàn bộ nhà');await settle();
  await evaluate(`window.__twinFixtureEmitDevice('fan',{power:'ON',speed:90})`);const fanBefore=(await scene()).deviceModels.find(d=>d.id==='DEVICE:fan').animation;await delay(300);
  check('powered fan rotates physical blade group',JSON.stringify((await scene()).deviceModels.find(d=>d.id==='DEVICE:fan').animation)!==JSON.stringify(fanBefore));
  await evaluate(`window.__twinFixtureEmitDevice('fan',{power:'OFF',speed:90})`);await delay(200);const fanStopped=(await scene()).deviceModels.find(d=>d.id==='DEVICE:fan').animation;await delay(250);
  check('OFF fan stops physical blades',JSON.stringify((await scene()).deviceModels.find(d=>d.id==='DEVICE:fan').animation)===JSON.stringify(fanStopped));
  const frameIds=s=>s.meshes.filter(m=>m.role==='plain'&&m.positions>100).map(m=>m.geometry);
  const doorBefore=frameIds(await scene());await evaluate(`window.__twinFixtureEmitDevice('door',{open:true})`);await delay(1000);
  check('door state animates ported leaf geometry',JSON.stringify(frameIds(await scene()))!==JSON.stringify(doorBefore));
  const windowBefore=(await scene()).deviceModels.find(d=>d.id==='DEVICE:window').geometry;
  const blindBefore=(await scene()).deviceModels.find(d=>d.id==='DEVICE:blind').geometry;
  await evaluate(`window.__twinFixtureEmitDevice('window',{state:'TILTED'});window.__twinFixtureEmitDevice('blind',{position:75});window.__twinFixtureEmitDevice('tv',{power:'ON'})`);await delay(1000);
  check('window tilt changes actual sash geometry',JSON.stringify((await scene()).deviceModels.find(d=>d.id==='DEVICE:window').geometry)!==JSON.stringify(windowBefore));
  check('blind percentage changes actual cover geometry',JSON.stringify((await scene()).deviceModels.find(d=>d.id==='DEVICE:blind').geometry)!==JSON.stringify(blindBefore));
  check('TV ON emissive changes the screen model',(await scene()).deviceModels.find(d=>d.id==='DEVICE:tv').emissive>0);
  await screenshot('device-models-active');
  const errors=events.filter(e=>e.method==='Runtime.exceptionThrown');
  const shaderErrors=events.filter(e=>e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'&&JSON.stringify(e).includes('Shader'));
  check('real browser reports no uncaught exception or shader error',errors.length===0&&shaderErrors.length===0);
  await writeFile(resolve(evidence,'browser-results.json'),JSON.stringify({results,errors,shaderErrors,framing:initial.extent,reference:'NeonPlan bb5261d docs/images/view-day.jpg',note:'Real WebGL renderer; mocked HESTA transport, no ESP32 hardware in this suite'},null,2));
  await send('Page.navigate',{url:new URL('/docs/evidence/neonplan-port/comparison.html',testUrl).href});await delay(800);await screenshot('side-by-side-comparison',false);
  await send('Browser.close');
} finally { socket?.close(); chrome.kill(); }
