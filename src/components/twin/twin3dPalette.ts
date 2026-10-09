export interface Twin3DPalette {
  app: string;
  surface: string;
  line: string;
  text: string;
  muted: string;
  primary: string;
  primaryHover: string;
  mint: string;
  success: string;
  successSoft: string;
  warning: string;
  lightOn: string;
  warningSoft: string;
  off: string;
  offSoft: string;
  errorSoft: string;
  infoSoft: string;
  wood: string;
  woodLight: string;
  fabric: string;
  fabricAccent: string;
  leaf: string;
  leafDark: string;
  glass: string;
  metal: string;
  dark: string;
  rug: string;
  wall: string;
  floorMint: string;
  floorBlue: string;
  ground: string;
  heatHigh: string;
}

const token = (styles: CSSStyleDeclaration, name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

export function readTwin3DPalette(): Twin3DPalette {
  const styles = getComputedStyle(document.documentElement);
  return {
    app: token(styles, '--color-twin-app', '#f5f7fa'),
    surface: token(styles, '--color-surface', '#ffffff'),
    line: token(styles, '--color-twin-border', '#cbd5e1'),
    text: token(styles, '--color-twin-text', '#0f172a'),
    muted: token(styles, '--color-twin-muted', '#64748b'),
    primary: token(styles, '--color-twin-selected', '#3b82f6'),
    primaryHover: token(styles, '--color-twin-selected', '#3b82f6'),
    mint: token(styles, '--color-mint', '#7bdcb5'),
    success: token(styles, '--color-twin-success', '#22c55e'),
    successSoft: token(styles, '--color-success-soft', '#e8faf0'),
    warning: token(styles, '--color-twin-warning', '#f59e4a'),
    lightOn: token(styles, '--color-twin-on', '#f6c453'),
    warningSoft: token(styles, '--color-warning-soft', '#fff7e0'),
    off: token(styles, '--color-twin-off', '#94a3b8'),
    offSoft: token(styles, '--color-off-soft', '#f4f8fb'),
    errorSoft: token(styles, '--color-error-soft', '#fff0f0'),
    infoSoft: token(styles, '--color-twin-scene', '#eef2f6'),
    wood: token(styles, '--color-twin-wood', '#a96f3f'),
    woodLight: token(styles, '--color-twin-wood-light', '#d9a46a'),
    fabric: token(styles, '--color-twin-fabric', '#d1dce1'),
    fabricAccent: token(styles, '--color-twin-fabric-accent', '#91afc0'),
    leaf: token(styles, '--color-twin-leaf', '#78ad86'),
    leafDark: token(styles, '--color-twin-leaf-dark', '#4f8767'),
    glass: token(styles, '--color-twin-glass', '#bfe3ef'),
    metal: token(styles, '--color-twin-metal', '#a8b7c0'),
    dark: token(styles, '--color-twin-dark', '#485864'),
    rug: token(styles, '--color-twin-rug', '#cbb8a1'),
    wall: token(styles, '--color-twin-wall', '#d2dde2'),
    floorMint: token(styles, '--color-twin-floor-mint', '#dce9df'),
    floorBlue: token(styles, '--color-twin-floor-blue', '#d5e5ed'),
    ground: token(styles, '--color-twin-ground', '#b8d0bf'),
    heatHigh: token(styles, '--color-twin-heat-high', '#f97316'),
  };
}
