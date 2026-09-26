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
}

const token = (styles: CSSStyleDeclaration, name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

export function readTwin3DPalette(): Twin3DPalette {
  const styles = getComputedStyle(document.documentElement);
  return {
    app: token(styles, '--color-app', '#f8fcff'),
    surface: token(styles, '--color-surface', '#ffffff'),
    line: token(styles, '--color-line', '#dceaf2'),
    text: token(styles, '--color-text', '#3a4a5a'),
    muted: token(styles, '--color-muted', '#6b7c8f'),
    primary: token(styles, '--color-primary', '#5bc0eb'),
    primaryHover: token(styles, '--color-primary-hover', '#3dafd9'),
    mint: token(styles, '--color-mint', '#7bdcb5'),
    success: token(styles, '--color-success', '#6edfa3'),
    successSoft: token(styles, '--color-success-soft', '#e8faf0'),
    warning: token(styles, '--color-warning', '#ffd166'),
    warningSoft: token(styles, '--color-warning-soft', '#fff7e0'),
    off: token(styles, '--color-off', '#d6e4ec'),
    offSoft: token(styles, '--color-off-soft', '#f4f8fb'),
    errorSoft: token(styles, '--color-error-soft', '#fff0f0'),
    infoSoft: token(styles, '--color-info-soft', '#eef9ff'),
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
  };
}
