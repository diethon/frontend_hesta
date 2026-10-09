// Adapted from NeonPlan 3D, bb5261d29fc45ba0bb4a586bca2500f94ec9ea1d.
// Copyright (c) 2026 Mastershort. MIT; see THIRD_PARTY_NOTICES.md.
// Day-style neutral pattern; no integrations or external assets.

import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace, MeshBasicMaterial, NormalBlending } from "three";

/** Pattern atlas: 3 × 2 tiles of 1 m each (wood, oak, tiles / carpet, stone, concrete), faint cyan lines. */
export function makePatternTexture(): CanvasTexture {
  const T = 256;
  const canvas = document.createElement("canvas");
  canvas.width = T * 3;
  canvas.height = T * 2;
  const ctx = canvas.getContext("2d")!;
  const line = (x0: number, y0: number, x1: number, y1: number, alpha: number) => {
    ctx.strokeStyle = `rgba(92,83,71,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  ctx.lineWidth = 2;
  const tile = (col: number, row: number, draw: (ox: number, oy: number) => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(col * T, row * T, T, T);
    ctx.clip();
    draw(col * T, row * T);
    ctx.restore();
  };
  // wood: planks 0.2 m wide along x with staggered joints
  tile(0, 0, (ox, oy) => {
    for (let i = 0; i < 5; i++) {
      const y = oy + (i * T) / 5 + 0.75;
      line(ox, y, ox + T, y, 0.09);
      const j = ox + ((i * 0.37) % 1) * T;
      line(j, y, j, y + T / 5, 0.07);
    }
  });
  // oak: narrower planks along z
  tile(1, 0, (ox, oy) => {
    for (let i = 0; i < 7; i++) {
      const x = ox + (i * T) / 7 + 0.75;
      line(x, oy, x, oy + T, 0.08);
      const j = oy + ((i * 0.53) % 1) * T;
      line(x, j, x + T / 7, j, 0.06);
    }
  });
  // tiles: 0.25 m grid
  tile(2, 0, (ox, oy) => {
    for (let i = 0; i < 4; i++) {
      const p = (i * T) / 4 + 0.75;
      line(ox + p, oy, ox + p, oy + T, 0.1);
      line(ox, oy + p, ox + T, oy + p, 0.1);
    }
  });
  // carpet: plain (also used for slab sides)
  // stone: 0.5 m slabs in a running bond
  tile(1, 1, (ox, oy) => {
    for (let r = 0; r < 2; r++) {
      const y = oy + (r * T) / 2 + 0.75;
      line(ox, y, ox + T, y, 0.09);
      const shift = r ? T / 4 : 0;
      for (const x of [shift, shift + T / 2]) line(ox + x + 0.75, y, ox + x + 0.75, y + T / 2, 0.09);
    }
  });
  // concrete: 1 m grid and a faint speckle
  tile(2, 1, (ox, oy) => {
    line(ox + 0.75, oy, ox + 0.75, oy + T, 0.08);
    line(ox, oy + 0.75, ox + T, oy + 0.75, 0.08);
    ctx.fillStyle = "rgba(92,83,71,0.05)";
    for (let i = 0; i < 90; i++) ctx.fillRect(ox + ((i * 97) % T), oy + ((i * 61 + (i * i) % 37) % T), 2, 2);
  });
  const tex = new CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Additive floor pattern: picks the atlas tile per vertex and repeats it every metre. */
export function patternMaterial(texture: CanvasTexture): MeshBasicMaterial {
  const m = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: NormalBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 tile;\nvarying vec2 vFp3dTile;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFp3dTile = tile;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vFp3dTile;").replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
        vec2 fp3dCell = fract(vMapUv);
        vec2 fp3dUv = (vFp3dTile + 0.004 + fp3dCell * 0.992) / vec2(3.0, 2.0);
        // gradients of the unwrapped coordinates avoid mip seams at the tile borders
        vec4 sampledDiffuseColor = textureGrad(map, fp3dUv, dFdx(vMapUv) / vec2(3.0, 2.0), dFdy(vMapUv) / vec2(3.0, 2.0));
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  m.customProgramCacheKey = () => "fp3d-pattern";
  return m;
}

