#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { designContext, verifyEvidence, type DesignEvidence } from './index.js';
import { loadContract } from './node.js';
import { startMcp } from './mcp.js';

export interface CliIo { out(value: string): void; error(value: string): void }
const contractTemplate = `schema = 1
name = "my-design-system"
token_files = ["tokens.tokens.json"]

[policies]
max_primary_actions_per_region = 1
max_heading_jump = 1
require_icon_intent = true
button_label_pattern = "^[A-Z][^.!?]*$"

[icons.add]
allowed = ["plus"]

[[components]]
name = "button"
tier = "atom"
variants = ["primary", "secondary"]
states = ["default", "disabled", "loading"]
roles = ["button"]
required_slots = ["label"]

[[surfaces]]
name = "example"
required_components = ["button"]
states = ["default"]
themes = ["light", "dark"]
viewports = ["mobile", "desktop"]
locales = ["en"]
`;
const tokenTemplate = { color: { action: { primary: { $type: 'color', $value: '#2563eb' } } }, space: { control: { $type: 'dimension', $value: { value: 8, unit: 'px' } } } };
const usage = 'Usage: assay-design <init|doctor|context|check|export|mcp> [--contract path] [--evidence path] [--out path]';
const option = (args: string[], name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const absent = async (path: string) => { try { await access(path); return false; } catch { return true; } };

export async function runCli(args: string[], io: CliIo = { out: console.log, error: console.error }): Promise<number> {
  const [command] = args;
  const contractPath = resolve(option(args, '--contract') ?? '.design/contract.toml');
  if (!command || command === 'help' || command === '--help') { io.out(usage); return 0; }
  if (command === 'mcp') { startMcp(contractPath); return 0; }
  if (command === 'init') {
    const directory = resolve(option(args, '--dir') ?? '.design');
    const contract = resolve(directory, 'contract.toml');
    const tokens = resolve(directory, 'tokens.tokens.json');
    await mkdir(directory, { recursive: true });
    const createContract = await absent(contract);
    const createTokens = await absent(tokens);
    if (createContract) await writeFile(contract, contractTemplate, 'utf8');
    if (createTokens) await writeFile(tokens, `${JSON.stringify(tokenTemplate, null, 2)}\n`, 'utf8');
    io.out(JSON.stringify({ initialized: directory, created: [...(createContract ? ['contract.toml'] : []), ...(createTokens ? ['tokens.tokens.json'] : [])] }));
    return 0;
  }
  if (!['doctor', 'context', 'check', 'export'].includes(command)) { io.error(usage); return 2; }
  const contract = await loadContract(contractPath);
  if (command === 'doctor') {
    io.out(JSON.stringify({ ok: true, contract: contract.name, components: contract.components.length, surfaces: contract.surfaces.length, tokens: contract.tokenNames?.length ?? 0 }));
    return 0;
  }
  const output = command === 'context' ? designContext(contract) : command === 'export' ? contract : await verifyEvidence(contract, JSON.parse(await readFile(resolve(option(args, '--evidence') ?? ''), 'utf8')) as DesignEvidence);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  const destination = option(args, '--out');
  if (destination) await writeFile(resolve(destination), serialized, 'utf8'); else io.out(serialized.trimEnd());
  return command === 'check' && 'outcome' in output && output.outcome !== 'pass' ? 1 : 0;
}

export async function main(args = process.argv.slice(2)) {
  try { process.exitCode = await runCli(args); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) void main();
