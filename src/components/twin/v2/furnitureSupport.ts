const supportedTypes = new Set([
  'sofa', 'armchair', 'bed', 'chair', 'office_chair', 'table', 'table_round',
  'coffee_table', 'desk', 'nightstand', 'wardrobe', 'shelf', 'sideboard',
  'dresser', 'tall_cabinet', 'kitchen', 'kitchen_wall', 'kitchen_tall',
  'island', 'fridge', 'fridge_smart', 'stove', 'sink', 'bathtub', 'shower',
  'wc', 'washbasin', 'tv_board', 'tv_wall', 'plant', 'rug', 'car',
])

/** Unsupported saved items keep their existing renderer and behaviour. */
export function hasV2Furniture(type: string): boolean { return supportedTypes.has(type) }
