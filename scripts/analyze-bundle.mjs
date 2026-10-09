import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const label = process.argv[2] ?? 'after';
const chunks = JSON.parse(await readFile('dist/bundle-analysis.json', 'utf8'));
for (const c of chunks) { const code=await readFile('dist/'+c.file); c.bytes=code.length;c.gzip=gzipSync(code).length; }
const byFile=new Map(chunks.map(c=>[c.file,c]));
function closure(files,seen=new Set()) { for(const file of files){if(seen.has(file)||!byFile.has(file))continue;seen.add(file);closure(byFile.get(file).imports,seen);}return seen; }
const initial=[...closure(chunks.filter(c=>c.entry).map(c=>c.file))];
const initialModules=initial.flatMap(file=>byFile.get(file).modules);
const threeInitial=initialModules.filter(m=>/node_modules\/(three\/|@react-three\/|three-stdlib\/)/.test(m.id));
const twinEntry=chunks.find(c=>c.modules.some(m=>m.id.endsWith('/Twin3DView.tsx')));
const twinFiles=twinEntry?[...closure([twinEntry.file])].filter(f=>!initial.includes(f)):[];
const models=[];
async function scan(path) { for(const item of await readdir(path,{withFileTypes:true})){const name=path+'/'+item.name;if(item.isDirectory())await scan(name);else if(/\.(glb|gltf)$/i.test(name))models.push({file:name,bytes:(await stat(name)).size});} }
await scan('dist');
const sum=(files,key)=>files.reduce((n,f)=>n+byFile.get(f)[key],0);
const report={label,initial:{files:initial,bytes:sum(initial,'bytes'),gzip:sum(initial,'gzip'),threeModules:threeInitial},digitalTwin:{files:twinFiles,bytes:sum(twinFiles,'bytes'),gzip:sum(twinFiles,'gzip')},models,chunks};
await mkdir('docs/evidence/twin-optimization',{recursive:true});
await writeFile(`docs/evidence/twin-optimization/bundle-${label}.json`,JSON.stringify(report,null,2));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
await writeFile(`docs/evidence/twin-optimization/bundle-${label}.html`,`<!doctype html><meta charset="utf-8"><title>HESTA bundle ${label}</title><style>body{font:14px system-ui;margin:24px;background:#f4f7fa;color:#0f172a}section{padding:16px;margin:12px 0;background:white;border:1px solid #cbd5e1;border-radius:12px}.modules{display:flex;flex-wrap:wrap;gap:3px}.module{padding:7px;background:#dceaf2;flex-grow:1;min-width:80px;overflow-wrap:anywhere}small{display:block}</style><h1>HESTA bundle ${label}</h1><p>Initial ${(report.initial.gzip/1024).toFixed(1)} KiB gzip · Digital Twin async ${(report.digitalTwin.gzip/1024).toFixed(1)} KiB gzip · Three.js in initial: ${threeInitial.length}</p>`+chunks.map(c=>`<section><h2>${c.file} · ${(c.gzip/1024).toFixed(1)} KiB gzip</h2><div class="modules">${c.modules.filter(m=>m.bytes>0).sort((a,b)=>b.bytes-a.bytes).map(m=>`<div class="module" style="flex-basis:${Math.max(80,Math.sqrt(m.bytes)*2)}px" title="${escape(m.id)}"><small>${escape(m.id)}</small>${m.bytes} rendered bytes</div>`).join('')}</div></section>`).join(''));
console.log(JSON.stringify({initial:report.initial,digitalTwin:report.digitalTwin,models},null,2));
assert.equal(threeInitial.length,0,'Dashboard initial dependency graph must exclude Three.js / R3F');
