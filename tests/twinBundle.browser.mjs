// Production dashboard network verification. All backend requests stay mocked.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.env.TEST_PRODUCTION_URL ?? 'http://127.0.0.1:4173';
assert.ok((await fetch(origin)).ok, 'Start the production preview first');
const chunks = JSON.parse(await readFile('dist/bundle-analysis.json', 'utf8'));
const forbidden = new Set(chunks.filter(c => c.modules.some(m => /node_modules\/(three\/|@react-three\/|three-stdlib\/)/.test(m.id) || m.id.endsWith('/DigitalTwinPage.tsx'))).map(c => c.file));
const profile = resolve('.tmp/twin-bundle-chrome-' + Date.now());
const evidence = resolve('docs/evidence/twin-optimization');
await mkdir(profile, { recursive: true });
await mkdir(evidence, { recursive: true });
const chrome = spawn(process.env.TEST_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let port;
  for (let i=0;i<100;i++) { try { port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break; } catch { await delay(100); } }
  assert.ok(port, 'Chrome debugging port');
  const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;
  const pending=new Map(), scripts=new Set();
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>reject(new Error(method+' timed out')),30000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));});
  socket.addEventListener('message',({data})=>{
    const m=JSON.parse(data);
    if(m.id){const task=pending.get(m.id);if(!task)return;pending.delete(m.id);clearTimeout(task.timeout);if(m.error)task.reject(new Error(JSON.stringify(m.error)));else task.resolve(m.result);}
    if(m.method==='Network.requestWillBeSent'&&new URL(m.params.request.url).pathname.endsWith('.js'))scripts.add(new URL(m.params.request.url).pathname.slice(1));
    if(m.method==='Fetch.requestPaused') {
      const url=new URL(m.params.request.url),requestId=m.params.requestId;
      if(url.origin===origin&&!url.pathname.startsWith('/api/'))void send('Fetch.continueRequest',{requestId});
      else if(url.pathname.endsWith('/my-homes'))void send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'authorization,content-type'}],body:Buffer.from(JSON.stringify({code:1000,result:[]})).toString('base64')});
      else void send('Fetch.failRequest',{requestId,errorReason:'Aborted'});
    }
  });
  await Promise.all([send('Page.enable'),send('Runtime.enable'),send('Network.enable'),send('Fetch.enable',{patterns:[{urlPattern:'*'}]})]);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('accessToken','fixture-only-token');localStorage.setItem('userInfo',JSON.stringify({id:'fixture-user',fullName:'Bundle QA',email:'bundle@example.test',platformRole:'USER',provider:'LOCAL',status:'ACTIVE',createdAt:'2026-10-04T00:00:00Z'}));window.WebSocket=class extends EventTarget{static OPEN=1;readyState=3;send(){}close(){}};`});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/home'});
  let ready=false;
  for(let i=0;i<200;i++){const r=await send('Runtime.evaluate',{expression:`location.pathname==='/home'&&!!document.querySelector('aside')`,returnByValue:true});if(r.result.value){ready=true;break;}await delay(100);}
  assert.ok(ready,'Authenticated production dashboard renders');
  await delay(1500);
  const unexpected=[...scripts].filter(f=>forbidden.has(f));
  assert.deepEqual(unexpected,[],'Dashboard must not download Three.js, R3F or DigitalTwinPage');
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(resolve(evidence,'production-dashboard.png'),Buffer.from(shot.data,'base64'));
  await writeFile(resolve(evidence,'production-dashboard-network.json'),JSON.stringify({route:'/home',scripts:[...scripts],forbiddenLoaded:unexpected,backend:'mocked; no outgoing HESTA requests'},null,2));
  console.log('PASS production dashboard renders without loading Three.js / R3F / DigitalTwinPage', [...scripts]);
  await send('Browser.close');
} finally { socket?.close();chrome.kill(); }
