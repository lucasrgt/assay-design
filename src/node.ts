import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { assertComposition, mergeContracts, parseContract, type DesignContract } from './index.js';

function tokenValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object' && 'value' in value) return `${String((value as Record<string, unknown>).value)}${String((value as Record<string, unknown>).unit ?? '')}`;
  return String(value);
}

function tokenEntries(value: unknown, prefix = ''): [string, string][] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const row = value as Record<string, unknown>;
  if ('$value' in row) return prefix ? [[prefix, tokenValue(row.$value)]] : [];
  return Object.entries(row).flatMap(([key, child]) => key.startsWith('$') ? [] : tokenEntries(child, prefix ? `${prefix}.${key}` : key));
}

async function loadTokens(file: string, tokenFiles: readonly string[]) {
  const dir = dirname(file);
  return Object.fromEntries((await Promise.all(tokenFiles.map(async (path) => tokenEntries(JSON.parse(await readFile(resolve(dir, path), 'utf8')))))).flat());
}

export async function loadContract(file = '.design/contract.toml', seen = new Set<string>()): Promise<DesignContract> {
  const absolute = resolve(file);
  if (seen.has(absolute)) throw new Error(`extends cycle includes "${absolute}"`);
  seen.add(absolute);
  const parsed = parseContract(await readFile(absolute, 'utf8'));
  const dir = dirname(absolute);
  let merged: DesignContract | undefined;
  for (const parent of parsed.extends) {
    const base = await loadContract(resolve(dir, parent), new Set(seen));
    merged = merged ? mergeContracts(merged, base) : base;
  }
  parsed.tokens = await loadTokens(absolute, parsed.tokenFiles);
  const contract = merged ? mergeContracts(merged, parsed, true) : parsed;
  assertComposition(contract);
  return contract;
}
