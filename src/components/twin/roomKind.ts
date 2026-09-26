export function roomKind(name: string) {
  const value = name.toLocaleLowerCase();
  if (/living|khách/.test(value)) return 'living';
  if (/bed|ngủ/.test(value)) return 'bedroom';
  if (/kitchen|bếp/.test(value)) return 'kitchen';
  if (/bath|tắm|vệ sinh/.test(value)) return 'bathroom';
  return 'other';
}

