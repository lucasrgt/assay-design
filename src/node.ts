import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { assertComposition, mergeContracts, parseContract, type DesignContract } from './index.js';
import { flattenTokenDocuments } from './tokens.js';

async function loadTokens(file: string, tokenFiles: readonly string[]) {
  const dir = dirname(file);
  return flattenTokenDocuments(await Promise.all(tokenFiles.map(async (path) => JSON.parse(await readFile(resolve(dir, path), 'utf8')))));
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
  Object.assign(parsed, await loadTokens(absolute, parsed.tokenFiles));
  const contract = merged ? mergeContracts(merged, parsed, true) : parsed;
  assertComposition(contract);
  return contract;
}
