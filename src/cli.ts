#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectStylesheet, designContext, verifyEvidence, type DesignEvidence } from './index.js';
import { auditPopulation, auditFleet, applyPromotions, collectUtilities, planPromotions, recallDesign } from './coherence.js';
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

[[components]]
name = "action-group"
tier = "molecule"
parts = ["button"]

[[components]]
name = "toolbar"
tier = "organism"
parts = ["action-group"]

[[components]]
name = "page-shell"
tier = "template"
parts = ["toolbar"]

[[surfaces]]
name = "example"
template = "page-shell"
required_components = ["page-shell", "toolbar", "action-group", "button"]
states = ["default"]
themes = ["light", "dark"]
viewports = ["mobile", "desktop"]
locales = ["en"]
`;
const tokenTemplate = { color: { action: { primary: { $type: 'color', $value: '#2563eb' } } }, space: { control: { $type: 'dimension', $value: { value: 8, unit: 'px' } } } };
const usage = 'Usage: assay-design <init|doctor|context|recall|check|audit|fleet|promote|export|mcp> [--contract path] [--evidence path] [--styles file-or-dir] [--source file-or-dir] [--member name=file-or-dir] [--task text] [--path path] [--threshold n] [--tokens path --apply] [--out path]';
const option = (args: string[], name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const repeated = (args: string[], name: string) => args.flatMap((value, index) => value === name && args[index + 1] ? [args[index + 1]!] : []);
const absent = async (path: string) => { try { await access(path); return false; } catch { return true; } };
const supported = /\.(css|tsx?|jsx?|astro|vue|svelte)$/i;
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

async function expandInputs(inputs: readonly string[]): Promise<string[]> {
  const walk = async (path: string): Promise<string[]> => {
    const absolute = resolve(path);
    const info = await stat(absolute);
    if (info.isFile()) return supported.test(absolute) && !/\.(test|spec|stories)\.[^.]+$/i.test(absolute) ? [absolute] : [];
    if (!info.isDirectory()) return [];
    const entries = await readdir(absolute, { withFileTypes: true });
    return (await Promise.all(entries.flatMap((entry) => ignoredDirectories.has(entry.name) ? [] : [walk(resolve(absolute, entry.name))]))).flat();
  };
  return [...new Set((await Promise.all(inputs.map(walk))).flat())].sort();
}

async function scanInputs(inputs: readonly string[]) {
  const sources = await expandInputs(inputs);
  const css = sources.filter((path) => /\.css$/i.test(path));
  const code = sources.filter((path) => !/\.css$/i.test(path));
  const sheets = Object.fromEntries(await Promise.all(css.map(async (path) => [path, await readFile(path, 'utf8')])));
  const declarations = [...(css.length ? collectStylesheet(sheets) : []), ...(await Promise.all(code.map(async (path) => collectUtilities(await readFile(path, 'utf8'), path)))).flat()];
  return { sources, declarations };
}

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
  if (!['doctor', 'context', 'recall', 'check', 'audit', 'fleet', 'promote', 'export'].includes(command)) { io.error(usage); return 2; }
  const contract = await loadContract(contractPath);
  if (command === 'doctor') {
    io.out(JSON.stringify({ ok: true, contract: contract.name, extends: contract.extends, components: contract.components.length, surfaces: contract.surfaces.length, tokens: Object.keys(contract.tokens ?? {}).length }));
    return 0;
  }
  const loadStyles = async () => {
    return scanInputs([...repeated(args, '--styles'), ...repeated(args, '--source')]);
  };
  if (command === 'recall') {
    const scan = await loadStyles();
    const census = scan.declarations.length ? auditPopulation(contract, scan.declarations, Number(option(args, '--threshold') ?? 8)).census : [];
    const task = option(args, '--task');
    const brief = recallDesign(contract, { ...(task ? { task } : {}), paths: repeated(args, '--path'), census });
    const serialized = `${JSON.stringify(brief, null, 2)}\n`;
    const destination = option(args, '--out');
    if (destination) await writeFile(resolve(destination), serialized, 'utf8'); else io.out(serialized.trimEnd());
    return 0;
  }
  if (command === 'fleet') {
    const groups = new Map<string, string[]>();
    for (const value of repeated(args, '--member')) {
      const split = value.indexOf('=');
      if (split <= 0) throw new Error(`--member expects name=path, got "${value}"`);
      const name = value.slice(0, split);
      const path = value.slice(split + 1);
      groups.set(name, [...(groups.get(name) ?? []), path]);
    }
    if (!groups.size) throw new Error('fleet requires at least one --member name=path');
    const members = await Promise.all([...groups].map(async ([name, paths]) => ({ name, ...await scanInputs(paths) })));
    const report = auditFleet(contract, members, Number(option(args, '--threshold') ?? 8));
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    const destination = option(args, '--out');
    if (destination) await writeFile(resolve(destination), serialized, 'utf8'); else io.out(serialized.trimEnd());
    return report.members.some((member) => member.findings.length) ? 1 : 0;
  }
  if (command === 'promote') {
    const scan = await loadStyles();
    const report = auditPopulation(contract, scan.declarations, { systematicThreshold: Number(option(args, '--threshold') ?? 8), sources: scan.sources });
    const plan = planPromotions(report.census);
    const tokenPath = resolve(option(args, '--tokens') ?? (contract.tokenFiles[0] ? resolve(dirname(contractPath), contract.tokenFiles[0]) : resolve(dirname(contractPath), 'tokens.tokens.json')));
    const existing = await absent(tokenPath) ? {} : JSON.parse(await readFile(tokenPath, 'utf8')) as Record<string, unknown>;
    const applied = applyPromotions(existing, plan);
    const apply = args.includes('--apply');
    if (apply) {
      await mkdir(dirname(tokenPath), { recursive: true });
      await writeFile(tokenPath, `${JSON.stringify(applied.tree, null, 2)}\n`, 'utf8');
    }
    const serialized = `${JSON.stringify({ contract: contract.name, tokens: tokenPath, applied: apply, proposals: applied.written, existed: applied.existed, skipped: plan.skipped.length, coverage: report.coverage }, null, 2)}\n`;
    const destination = option(args, '--out');
    if (destination) await writeFile(resolve(destination), serialized, 'utf8'); else io.out(serialized.trimEnd());
    return applied.written.length || applied.existed.length ? 0 : plan.entries.length ? 0 : 1;
  }
  if (command === 'audit') {
    const scan = await loadStyles();
    const report = auditPopulation(contract, scan.declarations, { systematicThreshold: Number(option(args, '--threshold') ?? 8), sources: scan.sources, requireSubjects: true });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    const destination = option(args, '--out');
    if (destination) await writeFile(resolve(destination), serialized, 'utf8'); else io.out(serialized.trimEnd());
    return report.findings.length ? 1 : 0;
  }
  const verify = async () => {
    const evidence = JSON.parse(await readFile(resolve(option(args, '--evidence') ?? ''), 'utf8')) as DesignEvidence;
    const scan = await loadStyles();
    evidence.styles = [...(evidence.styles ?? []), ...scan.declarations];
    return verifyEvidence(contract, evidence);
  };
  const output = command === 'context' ? designContext(contract) : command === 'export' ? contract : await verify();
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  const destination = option(args, '--out');
  if (destination) await writeFile(resolve(destination), serialized, 'utf8'); else io.out(serialized.trimEnd());
  return command === 'check' && 'outcome' in output && output.outcome !== 'pass' ? 1 : 0;
}

export async function main(args = process.argv.slice(2)) {
  try { process.exitCode = await runCli(args); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))) void main();
