import type { Twin3DPalette } from '../twin3dPalette';
import type { Material } from 'three';

export type TwinRendererTheme = 'DAYLIGHT' | 'BLUEPRINT' | 'NIGHT';
export const themeEnvironment = {
  DAYLIGHT: { background:'#E9EFF4', ground:'#BCCBBE', sky:'#f7f8fa', hemisphere:.55, sun:1.5, fill:.15, exposure:.95, tint:[1,1,1] },
  BLUEPRINT: { background:'#153747', ground:'#1e4758', sky:'#bfd7e5', hemisphere:.9, sun:.7, fill:.3, exposure:1, tint:[.43,.7,.82] },
  NIGHT: { background:'#182738', ground:'#253d47', sky:'#8ca9c9', hemisphere:.25, sun:.2, fill:.08, exposure:.95, tint:[.55,.67,.84] },
} as const;

/** Renderer palette only; application CSS/theme never changes. */
export function rendererPalette(base: Twin3DPalette, theme: TwinRendererTheme): Twin3DPalette {
  const env=themeEnvironment[theme];
  return { ...base, infoSoft:env.background,ground:env.ground,...(theme==='DAYLIGHT'?{}:{surface:theme==='NIGHT'?'#768b9d':'#b3d0de',wall:'#8aa7b8',dark:'#35485b',fabric:'#829ba9',text:'#e3edf4'}) };
}

/** Patch colours on the GPU; theme switches keep BufferGeometry and fold masks alive. */
export function themeMaterial<T extends Material>(material:T, uniform:{value:number}):T {
  if (material.userData.twinThemeUniform === uniform) return material;
  material.userData.twinThemeUniform = uniform;
  const previous=material.onBeforeCompile.bind(material), key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=> {
    previous(shader,renderer);
    shader.uniforms.uTwinTheme=uniform;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform int uTwinTheme;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(uTwinTheme==1) { float value=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=mix(vec3(.035,.12,.19),vec3(.43,.7,.82),clamp(value,0.0,1.0)); }
      if(uTwinTheme==2) diffuseColor.rgb*=vec3(.55,.67,.84);`);
  };
  const cacheKey=key(); material.customProgramCacheKey=()=>cacheKey+'-hesta-renderer-theme';
  return material;
}
export const themeIndex=(theme:TwinRendererTheme)=>theme==='DAYLIGHT'?0:theme==='BLUEPRINT'?1:2;
