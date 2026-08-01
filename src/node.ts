import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseContract, type DesignContract } from './index.js';

function tokenPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const row = value as Record<string, unknown>;
  if ('$value' in row) return prefix ? [prefix] : [];
  return Object.entries(row).flatMap(([key, child]) => key.startsWith('$') ? [] : tokenPaths(child, prefix ? `${prefix}.${key}` : key));
}

export async function loadContract(file = '.design/contract.toml'): Promise<DesignContract> {
  const contract = parseContract(await readFile(file, 'utf8'));
  const tokenNames = (await Promise.all(contract.tokenFiles.map(async (path) => tokenPaths(JSON.parse(await readFile(resolve(dirname(file), path), 'utf8')))))).flat();
  return { ...contract, tokenNames };
}
