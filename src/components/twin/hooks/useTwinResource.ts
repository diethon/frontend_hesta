import { useEffect, useMemo } from 'react';

interface Disposable { dispose: () => void }
interface Entry { resource: Disposable; users: number }
const cache = new Map<string,Entry>();
function retain(entry:Entry,key:string) {
  entry.users++;
  return ()=>{entry.users--;queueMicrotask(()=>{if(entry.users===0&&cache.get(key)===entry){entry.resource.dispose();cache.delete(key);}});};
}

/** Shared immutable geometry/texture; last committed owner disposes it (StrictMode safe). */
export function useTwinResource<T extends Disposable>(key:string, create:()=>T):T {
  const entry=useMemo(()=>{let value=cache.get(key);if(!value){value={resource:create(),users:0};cache.set(key,value);}return value;},[key,create]);
  useEffect(()=>retain(entry,key),[entry,key]);
  return entry.resource as T;
}
