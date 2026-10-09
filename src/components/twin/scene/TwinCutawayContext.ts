import { createContext } from 'react';
import type { FoldMasks } from '../neonplan/viewer/fold';
/** Render uniforms only. Runtime device data remains in HESTA Redux selectors. */
export const TwinCutawayContext = createContext<{ masks: FoldMasks; cutHeight: number; themeUniform:{value:number} } | null>(null);
