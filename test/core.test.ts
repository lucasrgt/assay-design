import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectDocument, designContext, inspectEvidence, loadContract, parseContract, verifyEvidence, type DesignEvidence } from '../src/public.js';
import { contract, evidence, source } from './fixtures.js';

describe('contract', () => {
  it('parses Atomic Design, policy, links, and graph context', () => {
    const parsed = contract();
    expect(parsed.components.map((item) => item.tier)).toEqual(['atom', 'molecule', 'atom']);
    expect(parsed.surfaces[0]?.template).toBe('shell');
    const context = designContext(parsed);
    expect(context.graph.edges).toContainEqual({ from: 'design://contract/aurora', relation: 'exemplifies', to: 'rtw://design/button' });
    expect(context.contract.tokens).toEqual(['color.action.primary']);
    expect(designContext(parseContract(source)).contract.tokens).toEqual(['tokens.json']);
  });

  it('loads and flattens DTCG token sources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'assay-design-'));
    const file = join(directory, 'contract.toml');
    await writeFile(file, source);
    await writeFile(join(directory, 'tokens.json'), JSON.stringify({ color: { action: { primary: { $type: 'color', $value: '#00f' } }, $description: 'colors' }, ignored: 1 }));
    expect((await loadContract(file)).tokenNames).toEqual(['color.action.primary']);
  });

  it.each([
    ['schema = 2\nname="x"', 'schema must be 1'],
    ['schema=1\nname="x"\ncomponents={}', 'components and surfaces'],
    ['schema=1\nname="x"\ncomponents=["x"]', 'must be a table'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="page"', 'Atomic Design tier'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="atom"\n[[components]]\nname="x"\ntier="atom"', 'declared twice'],
    ['schema=1\nname="x"\ntoken_files="x"', 'array of strings'],
    ['schema=1\nname="x"\n[policies]\nmax_primary_actions_per_region=-1', 'non-negative integer'],
    ['schema=1\nname="x"\n[policies]\nmax_heading_jump="no"', 'max_heading_jump'],
    ['schema=1\nname="x"\n[policies]\nbutton_label_pattern=2', 'non-empty string'],
  ])('rejects invalid input: %s', (input, message) => expect(() => parseContract(input)).toThrow(message));
});

describe('evidence', () => {
  it('accepts a conforming surface through AVP', async () => {
    expect(inspectEvidence(contract(), evidence())).toEqual([]);
    const verdict = await verifyEvidence(contract(), evidence());
    expect(verdict.outcome).toBe('pass');
    expect(verdict.results).toHaveLength(5);
  });

  it('reports every deterministic category with actionable paths', async () => {
    const broken: DesignEvidence = {
      surface: 'dashboard', tokens: ['legacy.red'],
      nodes: [
        { component: 'ghost' },
        { component: 'button', variant: 'loud', state: 'broken', role: 'link', action: 'primary', region: 'hero', icon: 'plus', text: 'create!', headingLevel: 1, tokens: ['legacy.red'] },
        { component: 'button', variant: 'primary', state: 'default', role: 'button', action: 'primary', region: 'hero', icon: 'minus', iconIntent: 'add', text: 'Create', headingLevel: 3 },
      ],
      coverage: { states: ['default'], themes: ['light'], viewports: [], locales: [] },
    };
    const findings = inspectEvidence(contract(), broken);
    expect(new Set(findings.map((item) => item.category))).toEqual(new Set(['components', 'properties', 'composition', 'semantics', 'coverage']));
    expect(findings.some((item) => item.message.includes('2 primary actions'))).toBe(true);
    expect(findings.some((item) => item.message.includes('Heading jumps'))).toBe(true);
    const verdict = await verifyEvidence(contract(), broken);
    expect(verdict.outcome).toBe('fail');
    expect(verdict.results.every((item) => item.status === 'fail')).toBe(true);
  });

  it('distinguishes unknown surfaces and required component coverage', () => {
    expect(inspectEvidence(contract(), { surface: 'missing', nodes: [] })[0]?.message).toContain('not declared');
    const findings = inspectEvidence(contract(), { surface: 'dashboard', nodes: [], coverage: { states: [], themes: [], viewports: [], locales: [] } });
    expect(findings.some((item) => item.message.includes('requires component'))).toBe(true);
  });

  it('collects data-ds and legacy data-ui DOM seams', () => {
    document.body.innerHTML = `<main data-ui-region="hero"><h1 data-ui="text" data-role="heading" data-token="color.action.primary">Title</h1><button data-ui="button" data-variant="primary" data-state="default" data-role="button" data-action="primary"><span data-ui-slot="label">Create</span></button></main>`;
    const collected = collectDocument(document, 'dashboard', { states: ['default'] });
    expect(collected.nodes[0]).toMatchObject({ component: 'text', role: 'heading', region: 'hero', headingLevel: 1, tokens: ['color.action.primary'] });
    expect(collected.nodes[1]?.slots).toEqual(['label']);
    const button = document.querySelector('button')!;
    button.setAttribute('data-ds', 'button');
    button.setAttribute('data-ds-icon', 'plus');
    button.setAttribute('data-ds-icon-intent', 'add');
    expect(collectDocument(button, 'dashboard').nodes[0]).toMatchObject({ component: 'button', icon: 'plus', iconIntent: 'add' });
  });
});
