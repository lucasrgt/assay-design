export interface DesignTokenMeta { type?: string; group: string; section?: string }

function tokenValue(value: unknown): string {
  if (Array.isArray(value)) return value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item)) ? value.join(', ') : JSON.stringify(value);
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if ('value' in row) return `${String(row.value)}${String(row.unit ?? '')}`;
    return JSON.stringify(value);
  }
  return String(value);
}

type TokenEntry = { name: string; value: string; meta: DesignTokenMeta };

function entries(value: unknown, prefix = '', inheritedType?: string, inheritedGroup?: string): TokenEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const row = value as Record<string, unknown>;
  const declaredType = typeof row.$type === 'string' ? row.$type : undefined;
  const type = declaredType ?? inheritedType;
  if ('$value' in row) {
    if (!prefix) return [];
    const parent = prefix.includes('.') ? prefix.slice(0, prefix.lastIndexOf('.')) : prefix;
    const group = inheritedGroup ?? parent;
    const section = parent !== group && parent.startsWith(`${group}.`) ? parent.slice(group.length + 1) : undefined;
    return [{ name: prefix, value: tokenValue(row.$value), meta: { ...(type ? { type } : {}), group, ...(section ? { section } : {}) } }];
  }
  const group = declaredType && prefix ? prefix : inheritedGroup;
  return Object.entries(row).flatMap(([key, child]) => key.startsWith('$') ? [] : entries(child, prefix ? `${prefix}.${key}` : key, type, group));
}

export function flattenTokenDocuments(documents: readonly unknown[]) {
  const flattened = documents.flatMap((document) => entries(document));
  return {
    tokens: Object.fromEntries(flattened.map(({ name, value }) => [name, value])),
    tokenMeta: Object.fromEntries(flattened.map(({ name, meta }) => [name, meta])),
  };
}
