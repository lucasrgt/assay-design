import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/mcp.js', () => ({ startMcp: vi.fn() }));
import { main, runCli } from '../src/cli.js';
import { startMcp } from '../src/mcp.js';

describe('CLI', () => {
  let output: string[];
  const io = { out: (value: string) => output.push(value), error: (value: string) => output.push(value) };
  beforeEach(() => { output = []; vi.clearAllMocks(); });

  it('initializes without overwriting and diagnoses the contract', async () => {
    const directory = join(await mkdtemp(join(tmpdir(), 'assay-design-cli-')), '.design');
    expect(await runCli(['init', '--dir', directory], io)).toBe(0);
    expect(JSON.parse(output[0]!).created).toEqual(['contract.toml', 'tokens.tokens.json']);
    output = [];
    expect(await runCli(['init', '--dir', directory], io)).toBe(0);
    expect(JSON.parse(output[0]!).created).toEqual([]);
    output = [];
    expect(await runCli(['doctor', '--contract', join(directory, 'contract.toml')], io)).toBe(0);
    expect(JSON.parse(output[0]!).ok).toBe(true);
  });

  it('prints context, exports a contract, and verifies evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'assay-design-cli-'));
    const directory = join(root, '.design');
    const contract = join(directory, 'contract.toml');
    await runCli(['init', '--dir', directory], io);
    output = [];
    expect(await runCli(['context', '--contract', contract], io)).toBe(0);
    expect(JSON.parse(output[0]!).graph.nodes[0].kind).toBe('design-contract');
    const exported = join(root, 'contract.json');
    expect(await runCli(['export', '--contract', contract, '--out', exported], io)).toBe(0);
    expect(JSON.parse(await readFile(exported, 'utf8')).name).toBe('my-design-system');
    const evidence = join(root, 'evidence.json');
    await writeFile(evidence, JSON.stringify({ surface: 'example', nodes: [{ component: 'button', variant: 'primary', state: 'default', role: 'button', text: 'Create', slots: ['label'] }], coverage: { states: ['default'], themes: ['light', 'dark'], viewports: ['mobile', 'desktop'], locales: ['en'] } }));
    output = [];
    expect(await runCli(['check', '--contract', contract, '--evidence', evidence], io)).toBe(0);
    expect(JSON.parse(output[0]!).outcome).toBe('pass');
    await writeFile(evidence, JSON.stringify({ surface: 'unknown', nodes: [] }));
    expect(await runCli(['check', '--contract', contract, '--evidence', evidence], io)).toBe(1);
  });

  it('handles help, invalid commands, and MCP startup', async () => {
    expect(await runCli([], io)).toBe(0);
    expect(output[0]).toContain('Usage');
    expect(await runCli(['wat'], io)).toBe(2);
    expect(await runCli(['mcp', '--contract', 'custom.toml'], io)).toBe(0);
    expect(startMcp).toHaveBeenCalledWith(expect.stringContaining('custom.toml'));
  });

  it('uses the process console and maps thrown errors to an exit code', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await runCli([]);
    await runCli(['wat']);
    expect(log).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    await main(['doctor', '--contract', 'missing.toml']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
