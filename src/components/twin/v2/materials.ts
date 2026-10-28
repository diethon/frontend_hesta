// Architectural materials are isolated from UI colors and are shared by furnishings.
export const palette = {
  wall: '#f5f3ed', wallEdge: '#e2dfd4', oak: '#b8946a', oakLight: '#d6b793',
  oakDark: '#8c6b4c', fabric: '#dfded3', cushion: '#f3f1e7', sage: '#94a78b',
  dark: '#374344', metal: '#8d9695', leaf: '#627f52', leafLight: '#8aa56d',
  white: '#fffdf7', blue: '#5bc0eb', screen: '#22383d', terracotta: '#bf8e70',
}

export const lighting = { sun: '#fff1df', sky: '#e3edf4', ground: '#a68a6d', fill: '#d4e7f5', softbox: '#fff5e8' } as const
export const gardenFinish = { grass: '#aebba1', stone: '#e4e5dc' } as const

// Physical asset colors; these are not interface design tokens.
export const detail = {
  pot: '#dcd7c9',
  soil: '#514436',
  tanPillow: '#bea58b',
  sageThrow: '#a6b1a2',
  seam: '#d0cfc4',
  paper: '#e8e3d5',
  book: '#c2b297',
  duvet: '#a5b8ae',
  ivorySeam: '#e5e2d8',
  bedThrow: '#e7dfce',
  taupePillow: '#b9a184',
  coffee: '#5e4534',
  glass: '#e3eeea',
  placemat: '#b9ad94',
  napkin: '#d6d8c9',
  keyboard: '#c3cbc8',
  officeFabric: '#8f9e9b',
  carPaint: '#dbe4e5',
  carGlass: '#6b8991',
  carTailLight: '#b86f64',
} as const
