import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { contract, evidence, source } from './fixtures.js';

const { serveStdio } = vi.hoisted(() => ({ serveStdio: vi.fn((factory: () => unknown) => ({ factory })) }));
vi.mock('@modelcontextprotocol/server/stdio', () => ({ serveStdio }));
import { createMcpServer, mcpOperations, startMcp } from '../src/mcp.js';
import { activateFigma, scanFigma } from '../src/figma.js';
import storybook, { evaluateStory, evaluateStoryPanel } from '../src/storybook/preview.js';
import { managerEntries, previewAnnotations } from '../src/storybook/preset.js';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'assay-design-mcp-'));
  const file = join(directory, 'contract.toml');
  await writeFile(file, source);
  await writeFile(join(directory, 'tokens.json'), JSON.stringify({ color: { action: { primary: { $value: '#00f' } } } }));
  return file;
}

describe('MCP', () => {
  it('shares context, export, and AVP verification operations', async () => {
    const file = await fixture();
    expect((await mcpOperations.context(file)).contract.name).toBe('aurora');
    expect((await mcpOperations.export(file)).tokens).toEqual({ 'color.action.primary': '#00f' });
    expect((await mcpOperations.verify(file, evidence())).outcome).toBe('pass');
    expect((await mcpOperations.recall(file, 'card on dashboard', ['Card.tsx'])).components.some((item) => item.name === 'card')).toBe(true);
    expect((await mcpOperations.recall(file)).components.length).toBeGreaterThan(0);
    expect((await mcpOperations.audit(file, [], ['empty.tsx'])).coverage.status).toBe('empty');
    const server = createMcpServer(file);
    const tools = (server as any)._registeredTools;
    expect((await tools.design_context.handler({})).structuredContent.contract.name).toBe('aurora');
    expect((await tools.design_export.handler({ contract: file })).structuredContent.name).toBe('aurora');
    expect((await tools.design_verify.handler({ evidence: evidence() })).structuredContent.outcome).toBe('pass');
    expect((await tools.design_audit.handler({ declarations: [], sources: ['empty.tsx'] })).structuredContent.coverage.status).toBe('empty');
    expect((await tools.design_recall.handler({ task: 'card', paths: ['Card.tsx'] })).structuredContent.contract).toBe('aurora');
    expect((await tools.design_recall.handler({})).structuredContent.paths).toEqual([]);
    expect((await tools.design_fleet.handler({ members: [{ name: 'app', declarations: [{ origin: 'x', property: 'padding', value: '7px' }] }] })).structuredContent.contract).toBe('aurora');
    expect(startMcp(file)).toBeDefined();
    expect(startMcp()).toBeDefined();
    expect(serveStdio).toHaveBeenCalled();
  });
});

describe('Storybook', () => {
  it('evaluates the rendered story with the common core', async () => {
    document.body.innerHTML = '<div data-ds="card"><span data-ds-slot="content"></span></div>';
    expect((await evaluateStory(contract(), 'dashboard')).outcome).toBe('fail');
    expect((await evaluateStoryPanel(contract(), 'dashboard')).contract.components.some((item) => item.name === 'card')).toBe(true);
    const legacy = { ...contract(), groups: undefined } as unknown as Parameters<typeof evaluateStoryPanel>[0];
    expect((await evaluateStoryPanel(legacy, 'dashboard')).contract.groups).toEqual({ sharedLabel: 'Shared', foundations: [], composition: [] });
    expect(managerEntries(['base'])[0]).toBe('base');
    expect(managerEntries().at(-1)).toMatch(/manager\.js$/);
    expect(previewAnnotations()).toEqual(expect.arrayContaining([expect.stringMatching(/storybook-addon-pseudo-states.*preview/)]));
    expect(previewAnnotations().at(-1)).toMatch(/preview\.js$/);
  });

  it('decorates configured stories and emits their verdict', async () => {
    vi.useFakeTimers();
    const channel = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
    const Story = vi.fn(() => 'story');
    const decorator = (storybook as any).decorators[0];
    expect(decorator(Story, { parameters: {}, channel }, channel)).toBe('story');
    decorator(Story, { parameters: { designHarness: { contract: contract(), surface: 'dashboard', coverage: { states: [] } } }, channel }, channel);
    await vi.runAllTimersAsync();
    expect(channel.emit).toHaveBeenCalledWith('assay-design/verdict', expect.objectContaining({ outcome: 'fail' }));
    vi.useRealTimers();
  });
});

describe('Figma', () => {
  const makeApi = () => {
    const messages: any[] = [];
    const ui: { onmessage?: (message: any) => Promise<void>; postMessage(message: unknown): void } = { postMessage: (message) => { messages.push(message); } };
    return {
      messages,
      api: {
        currentPage: { name: 'Dashboard', findAllWithCriteria: () => [{ name: 'Button/Primary', type: 'COMPONENT', children: [{ name: 'slot: label', type: 'TEXT' }] }, { name: 'Card=Default', type: 'COMPONENT_SET' }] },
        variables: { getLocalVariablesAsync: async () => [{ name: 'color/action/primary' }] },
        ui,
        showUI: vi.fn(),
      },
    };
  };

  it('normalizes components, slots, variables, and page names', async () => {
    const { api } = makeApi();
    expect(await scanFigma(api)).toEqual({ surface: 'dashboard', source: 'figma', nodes: [{ component: 'button', slots: ['label'] }, { component: 'card' }], tokens: ['color.action.primary'] });
  });

  it('handles scan, verify, and malformed contract messages', async () => {
    const { api, messages } = makeApi();
    activateFigma(api, '<p>ui</p>');
    expect(api.showUI).toHaveBeenCalledWith('<p>ui</p>', { width: 420, height: 480 });
    await api.ui.onmessage!({ type: 'scan' });
    await api.ui.onmessage!({ type: 'verify', contract: contract() });
    await api.ui.onmessage!({ type: 'verify', contract: {} });
    expect(messages.map((message) => message.type)).toEqual(['evidence', 'verdict', 'error']);
  });
});
