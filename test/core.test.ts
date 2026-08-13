import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectDocument, collectStylesheet, designContext, inspectEvidence, inspectStyles, loadContract, parseContract, verifyEvidence, type DesignEvidence } from '../src/public.js';
import { contract, evidence, source } from './fixtures.js';

describe('contract', () => {
  it('parses Atomic Design, policy, links, and graph context', () => {
    const parsed = contract();
    expect(parsed.components.map((item) => item.tier)).toEqual(['atom', 'molecule', 'atom', 'template']);
    expect(parsed.components.find((item) => item.name === 'card')?.parts).toEqual(['button', 'text']);
    expect(parsed.components.find((item) => item.name === 'button')).toMatchObject({ inlineSizing: 'bounded', allowFullWidth: true });
    expect(parsed.surfaces[0]?.template).toBe('shell');
    const context = designContext(parsed);
    expect(context.graph.edges).toContainEqual({ from: 'design://contract/aurora', relation: 'exemplifies', to: 'rtw://design/button' });
    expect(context.graph.edges).toContainEqual({ from: 'design://component/card', relation: 'composes', to: 'design://component/button' });
    expect(context.contract.tokens).toEqual({ 'color.action.primary': '#2563eb', 'space.sm': '8px', 'space.md': '12px', 'space.lg': '16px', 'radius.md': '10px', 'fontSize.caption': '12px', 'fontSize.body': '16px' });
    expect(designContext(parseContract(source)).contract.tokens).toEqual(['tokens.json']);
  });

  it('loads and flattens DTCG token sources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'assay-design-'));
    const file = join(directory, 'contract.toml');
    await writeFile(file, source);
    await writeFile(join(directory, 'tokens.json'), JSON.stringify({ color: { $type: 'color', action: { primary: { $value: '#00f' } }, $description: 'colors' }, ignored: 1 }));
    const loaded = await loadContract(file);
    expect(loaded.tokens).toEqual({ 'color.action.primary': '#00f' });
    expect(loaded.tokenMeta).toEqual({ 'color.action.primary': { type: 'color', group: 'color', section: 'action' } });
    expect(parseContract(source, [{ space: { $type: 'dimension', sm: { $value: { value: 8, unit: 'px' } } } }]).tokenMeta?.['space.sm']).toEqual({ type: 'dimension', group: 'space' });
  });

  it('merges an org language through extends and detects cycles', async () => {
    const { mergeContracts } = await import('../src/index.js');
    const root = await mkdtemp(join(tmpdir(), 'assay-design-lang-'));
    const language = join(root, 'language.toml');
    const app = join(root, 'app.toml');
    await writeFile(join(root, 'tokens.json'), JSON.stringify({ space: { sm: { $value: { value: 8, unit: 'px' } } }, color: { brand: { $value: '#111' } } }));
    await writeFile(language, `schema = 1\nname = "org"\ntoken_files = ["tokens.json"]\n[[components]]\nname = "button"\ntier = "atom"\n`);
    await writeFile(app, `schema = 1\nname = "traveler"\nextends = ["language.toml"]\n[[components]]\nname = "card"\ntier = "molecule"\nparts = ["button"]\n[[surfaces]]\nname = "home"\nrequired_components = ["card"]\n`);
    const loaded = await loadContract(app);
    expect(loaded.name).toBe('traveler');
    expect(loaded.extends).toEqual(['language.toml']);
    expect(loaded.components.map((item) => item.name).sort()).toEqual(['button', 'card']);
    expect(loaded.tokens).toMatchObject({ 'space.sm': '8px', 'color.brand': '#111' });
    const sealed = parseContract(`schema=1\nname="a"\n[[components]]\nname="button"\ntier="atom"\n`);
    const override = parseContract(`schema=1\nname="b"\n[[components]]\nname="button"\ntier="atom"\nvariants=["primary"]\n`);
    expect(() => mergeContracts(sealed, override)).toThrow(/sealed component:button/);
    const extensible = parseContract(`schema=1\nname="a"\n[inheritance]\nextension_points=["component:button"]\n[[components]]\nname="button"\ntier="atom"\n`);
    expect(mergeContracts(extensible, override).components[0]?.variants).toEqual(['primary']);
    const tokenBase = { ...extensible, tokens: { 'color.brand': '#000' }, extensionPoints: ['token:color.brand'] };
    expect(mergeContracts(tokenBase, { ...parseContract('schema=1\nname="brand"'), tokens: { 'color.brand': '#fff' } }).tokens?.['color.brand']).toBe('#fff');
    expect(() => mergeContracts({ ...tokenBase, extensionPoints: [] }, { ...parseContract('schema=1\nname="brand"'), tokens: { 'color.brand': '#fff' } })).toThrow(/sealed token:color.brand/);
    const opinionated = parseContract('schema=1\nname="org"\n[policies]\nmax_primary_actions_per_region=3\n[scales]\nspace=["gap"]');
    await writeFile(language, 'schema=1\nname="org"\n[policies]\nmax_primary_actions_per_region=3\n[scales]\nspace=["gap"]');
    await writeFile(app, 'schema=1\nname="app"\nextends=["language.toml"]');
    const inherited = await loadContract(app);
    expect(inherited.policies.maxPrimaryActionsPerRegion).toBe(3);
    expect(inherited.scales.space).toEqual(['gap']);
    expect(() => mergeContracts(opinionated, parseContract('schema=1\nname="app"\n[policies]\nmax_primary_actions_per_region=2'), true)).toThrow(/sealed policy:maxPrimaryActionsPerRegion/);
    await writeFile(language, `schema = 1\nname = "org"\nextends = ["app.toml"]\n`);
    await expect(loadContract(app)).rejects.toThrow(/extends cycle/);
  });

  it.each([
    ['schema = 2\nname="x"', 'schema must be 1'],
    ['schema=1\nname="x"\ncomponents={}', 'components and surfaces'],
    ['schema=1\nname="x"\ncomponents=["x"]', 'must be a table'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="page"', 'Atomic Design tier'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="atom"\n[[components]]\nname="x"\ntier="atom"', 'declared twice'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="atom"\ninline_sizing="wide"', 'inline_sizing'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="atom"\nallow_full_width="yes"', 'allow_full_width'],
    ['schema=1\nname="x"\ntoken_files="x"', 'array of strings'],
    ['schema=1\nname="x"\n[policies]\nmax_primary_actions_per_region=-1', 'non-negative integer'],
    ['schema=1\nname="x"\n[policies]\nmax_heading_jump="no"', 'max_heading_jump'],
    ['schema=1\nname="x"\n[policies]\nbutton_label_pattern=2', 'non-empty string'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="atom"\nparts=["x"]', 'cannot compose'],
    ['schema=1\nname="x"\n[[components]]\nname="x"\ntier="molecule"\nparts=["missing"]', 'undeclared component'],
    ['schema=1\nname="x"\n[[components]]\nname="small"\ntier="molecule"\nparts=["large"]\n[[components]]\nname="large"\ntier="organism"', 'cannot compose'],
    ['schema=1\nname="x"\n[[components]]\nname="a"\ntier="molecule"\nparts=["b"]\n[[components]]\nname="b"\ntier="molecule"\nparts=["a"]', 'composition cycle'],
    ['schema=1\nname="x"\n[[components]]\nname="atom"\ntier="atom"\n[[surfaces]]\nname="page"\ntemplate="atom"', 'declared template'],
    ['schema=1\nname="x"\n[[surfaces]]\nname="page"\nrequired_components=["missing"]', 'undeclared component'],
    ['schema=1\nname="x"\n[[surfaces]]\nname="page"\n[[surfaces]]\nname="page"', 'declared twice'],
    ['schema=1\nname="x"\n[scales]\nspace=2', 'scales.space'],
  ])('rejects invalid input: %s', (input, message) => expect(() => parseContract(input)).toThrow(message));
});

describe('evidence', () => {
  it('accepts a conforming surface through AVP', async () => {
    expect(inspectEvidence(contract(), evidence())).toEqual([]);
    const verdict = await verifyEvidence(contract(), evidence());
    expect(verdict.outcome).toBe('pass');
    expect(verdict.results).toHaveLength(8);
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
    expect(new Set(findings.map((item) => item.category))).toEqual(new Set(['components', 'properties', 'composition', 'semantics', 'coverage', 'tokens']));
    expect(findings.some((item) => item.message.includes('2 primary actions'))).toBe(true);
    expect(findings.some((item) => item.message.includes('Heading jumps'))).toBe(true);
    const verdict = await verifyEvidence(contract(), broken);
    expect(verdict.outcome).toBe('fail');
    expect(verdict.results.filter((item) => item.status === 'fail')).toHaveLength(6);
  });

  it('distinguishes unknown surfaces and required component coverage', () => {
    expect(inspectEvidence(contract(), { surface: 'missing', nodes: [] }).some((item) => item.message.includes('not declared'))).toBe(true);
    const findings = inspectEvidence(contract(), { surface: 'dashboard', nodes: [], coverage: { states: [], themes: [], viewports: [], locales: [] } });
    expect(findings.some((item) => item.message.includes('requires component'))).toBe(true);
  });

  it('enforces Atomic Design parent hierarchy and declared parts', () => {
    const upward = evidence();
    upward.nodes[1]!.parent = 3;
    expect(inspectEvidence(contract(), upward).some((item) => item.message.includes('cannot contain'))).toBe(true);
    const undeclaredPart = evidence();
    undeclaredPart.nodes[2]!.parent = 0;
    expect(inspectEvidence(contract(), undeclaredPart).some((item) => item.message.includes('does not declare'))).toBe(true);
    const invalidParent = evidence();
    invalidParent.nodes[2]!.parent = 99;
    expect(inspectEvidence(contract(), invalidParent).some((item) => item.message.includes('Parent index'))).toBe(true);
  });

  it('collects data-ds and legacy data-ui DOM seams', () => {
    document.body.innerHTML = `<main data-ui="shell" data-ui-region="hero"><section data-ui="card"><h1 data-ui="text" data-role="heading" data-token="color.action.primary">Title</h1><button data-ui="button" data-variant="primary" data-state="default" data-role="button" data-action="primary"><span data-ui-slot="label">Create</span></button></section></main>`;
    const collected = collectDocument(document, 'dashboard', { states: ['default'] });
    expect(collected.nodes[2]).toMatchObject({ component: 'text', parent: 1, role: 'heading', region: 'hero', headingLevel: 1, tokens: ['color.action.primary'] });
    expect(collected.nodes[3]).toMatchObject({ component: 'button', parent: 1, slots: ['label'] });
    const button = document.querySelector('button')!;
    button.setAttribute('data-ds', 'button');
    button.setAttribute('data-ds-icon', 'plus');
    button.setAttribute('data-ds-icon-intent', 'add');
    expect(collectDocument(button, 'dashboard').nodes[0]).toMatchObject({ component: 'button', icon: 'plus', iconIntent: 'add' });
  });

  it('does not report synthetic DOM user-agent defaults as authored design', () => {
    document.body.innerHTML = '<h2 data-ui="text">Unstyled title</h2>';
    const rendered = collectDocument(document, 'dashboard');
    expect(rendered.styles ?? []).toEqual([]);
    expect(inspectEvidence(contract(), rendered).some((finding) => ['tokens/unbound-color', 'tokens/off-scale-one-off'].includes(finding.rule))).toBe(false);
    document.body.innerHTML = '<span data-ui="text" style="color:#2563eb">Inline token color</span>';
    expect(collectDocument(document, 'dashboard').styles).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'color', value: 'rgb(37, 99, 235)' }),
    ]));
    document.body.innerHTML = '<button data-ui="button" style="padding:8px;border:1px solid #2563eb;font:700 16px/20px sans-serif">Create</button>';
    expect(collectDocument(document, 'dashboard').styles).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'padding-top', value: '8px' }),
      expect.objectContaining({ property: 'border-color', value: 'rgb(37, 99, 235)' }),
      expect.objectContaining({ property: 'font-size', value: '16px' }),
    ]));
  });

  it('rejects rendered colors that match no design token', () => {
    document.body.innerHTML = `<span data-ui="text" style="color: #2563eb">Token color</span>`;
    const aligned = collectDocument(document, 'dashboard');
    expect(aligned.styles).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'color', value: 'rgb(37, 99, 235)', subject: 'text' })]));
    expect(inspectEvidence(contract(), aligned).some((finding) => finding.rule === 'tokens/unbound-color')).toBe(false);
    document.querySelector('span')!.setAttribute('style', 'color: #000000');
    const findings = inspectEvidence(contract(), collectDocument(document, 'dashboard'));
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'tokens/unbound-color', category: 'tokens', message: expect.stringContaining('rgb(0, 0, 0)') }),
    ]));
    const palette = { ...contract(), tokens: { ...contract().tokens, 'color.content': '#000', 'color.surface': '#fff', 'color.border': '#f00' } };
    document.body.innerHTML = `<span data-ui="text" style="color:#000;background:#fff;border:1px solid #f00">Aligned</span>`;
    const rendered = collectDocument(document, 'dashboard');
    expect(rendered.styles?.map((item) => item.property)).toEqual(expect.arrayContaining(['color', 'background-color', 'border-color']));
    expect(inspectEvidence(palette, rendered).some((finding) => finding.rule === 'tokens/unbound-color')).toBe(false);
  });

  it('ignores computed border colors when no border is rendered', () => {
    document.body.innerHTML = '<main data-ui="screen"><div data-ui="stack"></div></main>';
    const rendered = collectDocument(document, 'dashboard');
    expect(rendered.styles?.filter((item) => item.property.includes('border') && item.property.includes('color')) ?? []).toEqual([]);
  });

  it('owns slots locally and applies theme-aware semantic color bindings', () => {
    const bound = contract();
    bound.tokens = { ...bound.tokens, 'color.dark.content.primary': '#f8fafb', 'color.dark.content.onAction': '#000', 'color.dark.action.primary': '#3fc4e1' };
    const text = bound.components.find((component) => component.name === 'text')!;
    text.styleBindings = [{ property: 'color', role: 'heading', tokens: ['color.content.primary'] }];
    const button = bound.components.find((component) => component.name === 'button')!;
    button.appearances = ['solid', 'outline'];
    button.styleBindings = [
      { property: 'background-color', variant: 'primary', appearance: 'solid', tokens: ['color.action.primary'] },
      { property: 'color', slot: 'label', variant: 'primary', appearance: 'solid', tokens: ['color.content.onAction'] },
    ];
    document.documentElement.dataset.theme = 'dark';
    document.body.innerHTML = `<main data-ui="shell"><section data-ui="card"><span data-ui="text" data-role="heading" style="color:#000">Heading</span><button data-ui="button" data-variant="primary" data-appearance="solid" style="background:#3fc4e1"><span data-ui-slot="label" style="color:#000">Create</span></button></section></main>`;
    const rendered = collectDocument(document, 'dashboard');
    expect(rendered.nodes[0]?.slots).toBeUndefined();
    expect(rendered.nodes[1]?.slots).toBeUndefined();
    expect(rendered.nodes[3]).toMatchObject({ appearance: 'solid', slots: ['label'] });
    const mismatches = inspectEvidence(bound, rendered).filter((finding) => finding.rule === 'tokens/semantic-color-mismatch');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.path).toContain('text');
    delete document.documentElement.dataset.theme;
  });

  it('requires container-filling components to declare a sanctioned full-width exception', () => {
    document.body.innerHTML = `<div id="region" style="padding: 0 28px; border: 1px solid transparent"><button data-ds="button" data-variant="secondary"><span data-ds-slot="label">Continue</span></button></div>`;
    const region = document.querySelector('#region')!;
    const button = document.querySelector('button')!;
    Object.defineProperty(region, 'getBoundingClientRect', { value: () => ({ width: 400 }) });
    Object.defineProperty(button, 'getBoundingClientRect', { value: () => ({ width: 342 }) });
    const implicit = collectDocument(button, 'dashboard');
    expect(implicit.nodes[0]).toMatchObject({ component: 'button', widthMode: 'full', inlineSize: 342, containerInlineSize: 342 });
    expect(inspectEvidence(contract(), implicit)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'coherence/inline-sizing', category: 'coherence' }),
    ]));

    button.setAttribute('data-ds-width', 'full');
    expect(inspectEvidence(contract(), collectDocument(button, 'dashboard')).some((finding) => finding.rule === 'coherence/inline-sizing')).toBe(false);
    const forbidden = contract();
    forbidden.components.find((component) => component.name === 'button')!.allowFullWidth = false;
    expect(inspectEvidence(forbidden, collectDocument(button, 'dashboard'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'component/full-width-not-allowed', category: 'properties' }),
    ]));
  });

  it('normalizes the default flex min-height before comparing component styles', () => {
    document.body.innerHTML = `<div><span data-ui="text" data-role="caption" style="min-height:auto">One</span><span data-ui="text" data-role="caption" style="min-height:0">Two</span></div>`;
    const evidence = collectDocument(document, 'dashboard');
    const minHeights = evidence.styles?.filter((item) => item.property === 'min-height').map((item) => item.value);
    expect(minHeights).toEqual(['0px', '0px']);
    expect(inspectEvidence(contract(), evidence).some((finding) => finding.rule === 'coherence/property-drift' && finding.path.includes('min-height'))).toBe(false);
  });

  it('rejects rendered component geometry and elevation outside semantic bindings', () => {
    const bound = contract();
    bound.tokens = { ...bound.tokens, 'size.control.entry': '56px', 'radius.lg': '12px', 'elevation.md': '0 6px 16px rgba(16, 24, 40, 0.08)' };
    const button = bound.components.find((component) => component.name === 'button')!;
    button.styleBindings = [
      { property: 'min-height', variant: 'primary', tokens: ['size.control.entry'] },
      { property: 'border-radius', variant: 'primary', tokens: ['radius.lg'] },
      { property: 'box-shadow', variant: 'primary', tokens: ['elevation.md'] },
    ];
    document.body.innerHTML = `<button data-ui="button" data-variant="primary" style="min-height:48px;border-radius:8px;box-shadow:0 2px 4px rgba(16,24,40,.06)"><span data-ui-slot="label">Continue</span></button>`;
    const rendered = collectDocument(document, 'dashboard');
    expect(rendered.styles).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'min-height', value: '48px' }),
      expect.objectContaining({ property: 'border-radius', value: '8px' }),
      expect.objectContaining({ property: 'box-shadow' }),
    ]));
    expect(inspectEvidence(bound, rendered).filter((finding) => finding.rule === 'tokens/semantic-style-mismatch')).toHaveLength(3);

    document.querySelector('button')!.setAttribute('style', 'min-height:56px;border-radius:12px;box-shadow:0 6px 16px rgba(16,24,40,.08)');
    expect(inspectEvidence(bound, collectDocument(document, 'dashboard')).some((finding) => ['tokens/semantic-style-mismatch', 'tokens/missing-semantic-style'].includes(finding.rule))).toBe(false);
    document.querySelector('button')!.setAttribute('style', 'min-height:56px;border-radius:12px');
    expect(inspectEvidence(bound, collectDocument(document, 'dashboard'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'tokens/missing-semantic-style', message: expect.stringContaining('box-shadow') }),
    ]));
  });
});

const stylesheet = `:root { --space-sm: 8px; --brand: #2563eb; }
.button { padding: var(--space-sm); border-radius: 10px; color: var(--brand); margin: 0 }
.rogue { padding: 13px; color: #ff0000; gap: var(--missing); letter-spacing: 0.04em }
@media (min-width: 700px) { .button { padding: var(--nope, 4px) } }`;

describe('styles', () => {
  it('resolves visible references across stylesheet inputs', () => {
    const split = collectStylesheet({ 'tokens.css': ':root { --space-sm: 8px }', 'ui.css': '.a { gap: var(--space-sm) }' });
    expect(split).toEqual([{ origin: 'ui.css .a', subject: '.a', property: 'gap', value: '8px' }]);
    const declarations = collectStylesheet({ 'app.css': stylesheet });
    expect(declarations.find((item) => item.property === 'border-radius')?.origin).toBe('app.css .button');
    expect(declarations.find((item) => item.origin === 'app.css .button' && item.property === 'padding')?.value).toBe('8px');
    expect(declarations.find((item) => item.origin === 'app.css .button' && item.property === 'color')?.value).toBe('#2563eb');
    expect(declarations.find((item) => item.property === 'gap')?.unresolved).toEqual(['--missing']);
    expect(declarations.filter((item) => item.property.startsWith('--'))).toEqual([]);
    expect(declarations.filter((item) => item.property === 'padding').at(-1)?.value).toBe('4px');
  });

  it('separates unresolved references from off-scale one-offs and coherence drift', () => {
    const findings = inspectStyles(contract(), collectStylesheet({ 'app.css': stylesheet }));
    const message = (category: string) => findings.filter((item) => item.category === category).map((item) => item.message);
    expect(message('tokens')).toEqual(['Replace raw color "#ff0000" with a semantic design token', 'Reference "--missing" resolves to no value in the design language']);
    expect(message('scale').some((item) => item.includes('"13px"') && item.includes('one-off'))).toBe(true);
    expect(message('scale').some((item) => item.includes('"#ff0000"'))).toBe(true);
    expect(message('coherence').some((item) => item.includes('padding') && item.includes('4px') && item.includes('8px'))).toBe(true);
    expect(findings.some((item) => item.path.includes('letter-spacing'))).toBe(false);
    expect(findings.some((item) => item.message.includes('"10px"') && item.category === 'scale')).toBe(false);
  });

  it('validates semantic utility names against declared tokens', async () => {
    const { collectUtilities } = await import('../src/coherence.js');
    expect(inspectStyles(contract(), collectUtilities('className="p-lg text-body rounded-md"', 'Button.tsx')).filter((item) => item.category === 'tokens')).toEqual([]);
    const findings = inspectStyles(contract(), collectUtilities('className="bg-legacy duration-slow"', 'Button.tsx'));
    expect(findings.filter((item) => item.category === 'tokens').map((item) => item.message)).toEqual([
      'Utility "bg-legacy" maps to no declared token (color.legacy or color.legacy.DEFAULT)',
      'Utility "duration-slow" maps to no declared token (motion.slow)',
    ]);
  });

  it('skips scale judgment when the language declares no token values', () => {
    const findings = inspectStyles(parseContract(source), collectStylesheet(stylesheet));
    expect(findings.map((item) => item.category)).toEqual(['tokens', 'tokens']);
  });

  it('honours a contract that redeclares which properties a scale governs', async () => {
    const narrowed = { ...contract(), scales: parseContract(`${source}\n[scales]\nspace = ["gap"]\n`).scales };
    expect(narrowed.scales).toEqual({ space: ['gap'] });
    expect(inspectStyles(narrowed, collectStylesheet('.a { padding: 13px; gap: 9px }')).map((item) => item.message)).toEqual(['"9px" is an off-scale space one-off (1 use)']);
    const verdict = await verifyEvidence(contract(), { ...evidence(), styles: collectStylesheet('.a { padding: 13px }') });
    expect(verdict.outcome).toBe('fail');
    expect(verdict.results.filter((item) => item.status === 'fail')).toHaveLength(1);
  });
});

describe('population', () => {
  it('classifies systematic escapes as promote candidates and one-offs as failures', async () => {
    const { auditPopulation } = await import('../src/coherence.js');
    const repeated = Array.from({ length: 8 }, (_, index) => ({ origin: `ui.css .chip-${index}`, property: 'padding', value: '13px' }));
    const report = auditPopulation(contract(), [...repeated, { origin: 'ui.css .chip', property: 'padding', value: '7px' }], 8);
    expect(report.census.find((item) => item.value === '13px')).toMatchObject({ kind: 'systematic', count: 8, group: 'space' });
    expect(report.census.find((item) => item.value === '7px')).toMatchObject({ kind: 'oneOff', count: 1 });
    expect(report.findings.some((item) => item.message.includes('7px'))).toBe(true);
    expect(report.findings.some((item) => item.message.includes('13px'))).toBe(false);
  });

  it('collects named and arbitrary Tailwind utilities plus RN style literals', async () => {
    const { collectUtilities } = await import('../src/coherence.js');
    const declarations = collectUtilities(`className="text-[13px] p-[7px] md:p-lg text-body data-[state=open]:block" style={{ fontSize: 28, padding: 9 }}`, 'Screen.tsx');
    expect(declarations).toEqual(expect.arrayContaining([
      { origin: 'Screen.tsx text-[13px]', property: 'font-size', value: '13px' },
      { origin: 'Screen.tsx p-[7px]', property: 'padding', value: '7px' },
      { origin: 'Screen.tsx md:p-lg', property: 'padding', value: 'p-lg', tokenCandidates: ['space.lg'] },
      { origin: 'Screen.tsx text-body', property: 'font-size', value: 'text-body', tokenCandidates: ['fontSize.body', 'color.body', 'color.body.DEFAULT'] },
      { origin: 'Screen.tsx style', property: 'font-size', value: '28px' },
      { origin: 'Screen.tsx style', property: 'padding', value: '9px' },
    ]));
    expect(declarations.some((item) => item.origin.includes('data-'))).toBe(false);
    const families = collectUtilities('className="rounded-md bg-primary fill-primary stroke-primary duration-fast w-full -mt-sm tracking-wide leading-tight text-center mx-auto"; const locale = "pt-BR";');
    expect(families.map((item) => item.tokenCandidates ?? [])).toEqual(expect.arrayContaining([
      ['radius.md'], ['color.primary', 'color.primary.DEFAULT'], ['motion.fast'], ['space.sm'], [],
    ]));
    expect(families.some((item) => item.value === 'pt-BR')).toBe(false);
    expect(families.find((item) => item.value === 'text-center')).toMatchObject({ property: 'text-align' });
    expect(families.find((item) => item.value === 'text-center')).not.toHaveProperty('tokenCandidates');
    expect(families.find((item) => item.value === 'mx-auto')?.tokenCandidates).toBeUndefined();
    expect(collectUtilities('const locale = "pt-BR"')).toEqual([]);
    expect(collectUtilities('<div className="bg-surface-brand-subtle" />')[0]?.tokenCandidates).toEqual(expect.arrayContaining(['color.surface.brand-subtle']));
    expect(collectUtilities('<div className="text-hp-green-700" />')[0]?.tokenCandidates).toContain('color.hp-green.700');
    expect(collectUtilities('<svg className="stroke-2" />')[0]).toMatchObject({ property: 'stroke-width', value: 'stroke-2' });
    expect(collectUtilities('<svg className="fill-none" />')[0]).not.toHaveProperty('tokenCandidates');
    const rawColors = collectUtilities(`className="bg-[#2563eb]" style={{ color: '#2563eb', borderColor: 'rgb(0, 0, 0)' }}`, 'Button.tsx');
    expect(rawColors).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'background-color', value: '#2563eb', literal: true }),
      expect.objectContaining({ property: 'color', value: '#2563eb', literal: true }),
      expect.objectContaining({ property: 'border-color', value: 'rgb(0, 0, 0)', literal: true }),
    ]));
    expect(inspectStyles(contract(), rawColors).filter((finding) => finding.rule === 'tokens/raw-color-literal')).toHaveLength(3);
  });

  it('fails closed when an audit observes nothing or cannot compare subjects', async () => {
    const { auditPopulation } = await import('../src/coherence.js');
    const empty = auditPopulation(contract(), [], { sources: ['Screen.tsx'], requireSubjects: true });
    expect(empty.coverage).toMatchObject({ status: 'empty', observations: 0, unobservedSources: ['Screen.tsx'] });
    expect(empty.findings.map((item) => item.path)).toEqual(expect.arrayContaining(['audit.observations', 'audit.sources', 'audit.subjects']));
    const partial = auditPopulation(contract(), [{ origin: 'Screen.tsx p-lg', property: 'padding', value: 'p-lg' }], { sources: ['Screen.tsx'], requireSubjects: true });
    expect(partial.coverage.status).toBe('partial');
    expect(partial.findings.some((item) => item.path === 'audit.subjects')).toBe(true);
  });

  it('recalls filtered constraints and promotion candidates before edit', async () => {
    const { recallDesign } = await import('../src/coherence.js');
    const full = recallDesign(contract());
    expect(full.task).toBeUndefined();
    expect(full.components).toHaveLength(contract().components.length);
    expect(full.promote).toEqual([]);
    expect(full.rules.some((rule) => rule.includes('Promote'))).toBe(false);

    const brief = recallDesign(contract(), {
      task: 'tighten card padding on dashboard',
      paths: ['src/Card.tsx'],
      census: [
        { group: 'fontSize', value: '13px', count: 12, kind: 'systematic', origins: ['Screen.tsx'] },
        { group: 'space', value: '7px', count: 1, kind: 'oneOff', origins: ['chip'] },
      ],
    });
    expect(brief.components.map((item) => item.name)).toContain('card');
    expect(brief.surfaces.map((item) => item.name)).toContain('dashboard');
    expect(brief.promote).toEqual([{ group: 'fontSize', value: '13px', count: 12, kind: 'systematic', origins: ['Screen.tsx'] }]);
    expect(brief.rules.some((rule) => rule.includes('13px'))).toBe(true);
    expect(brief.scales.space?.values).toEqual(expect.arrayContaining(['8px', '12px', '16px']));

    expect(recallDesign(contract(), { task: 'edit text copy' }).components.map((item) => item.name)).toEqual(expect.arrayContaining(['text', 'card']));
    expect(recallDesign(contract(), { paths: ['layouts/shell'] }).surfaces[0]?.name).toBe('dashboard');
    expect(recallDesign(contract(), { task: 'zzzz-unknown' }).components).toEqual(contract().components);
    expect(recallDesign({ ...contract(), surfaces: [] }, { task: 'button' }).rules.some((rule) => rule.includes('Cover surface'))).toBe(false);
    expect(recallDesign({
      ...contract(),
      surfaces: [{ name: 'bare', requiredComponents: ['button'], states: [], themes: [], viewports: [], locales: [] }],
    }, { task: 'bare page' }).surfaces[0]?.name).toBe('bare');
  });

  it('reports equivalence-class divergence across sibling origins', async () => {
    const { auditPopulation, auditFleet } = await import('../src/coherence.js');
    const report = auditPopulation(contract(), [
      { origin: 'host/Card.tsx', subject: 'Card', property: 'padding', value: '16px' },
      { origin: 'traveler/Card.tsx', subject: 'Card', property: 'padding', value: '12px' },
    ]);
    expect(report.findings).toEqual([{ rule: 'coherence/property-drift', category: 'coherence', path: 'Card.{padding}', message: 'Card uses 2 different padding values: 12px, 16px' }]);
    const semantic = contract();
    semantic.components.find((item) => item.name === 'text')!.styleBindings = [
      { property: 'color', role: 'body', tokens: ['color.content.primary', 'color.content.secondary'] },
    ];
    semantic.tokens = { ...semantic.tokens, 'color.content.primary': '#111111', 'color.content.secondary': '#555555' };
    const sanctioned = auditPopulation(semantic, [
      { origin: 'Title.tsx', subject: 'text', component: 'text', role: 'body', property: 'color', value: 'rgb(17, 17, 17)' },
      { origin: 'Subtitle.tsx', subject: 'text', component: 'text', role: 'body', property: 'color', value: 'rgb(85, 85, 85)' },
    ]);
    expect(sanctioned.findings.some((item) => item.rule === 'coherence/property-drift')).toBe(false);
    const repeated = Array.from({ length: 8 }, (_, index) => ({ origin: `a-${index}`, property: 'padding', value: '13px' }));
    const fleet = auditFleet(contract(), [
      { name: 'traveler', declarations: repeated },
      { name: 'host', declarations: [...repeated, { origin: 'host', property: 'padding', value: '7px' }] },
    ], 8);
    expect(fleet.sharedSystematic.some((item) => item.value === '13px')).toBe(true);
    expect(fleet.ranking[0]?.name).toBe('traveler');
    expect(fleet.members.find((item) => item.name === 'host')?.findings.some((item) => item.message.includes('7px'))).toBe(true);

    const { planPromotions, applyPromotions } = await import('../src/coherence.js');
    const plan = planPromotions([{ group: 'space', value: '13px', count: 12, kind: 'systematic', origins: ['a'] }, { group: 'space', value: '7px', count: 1, kind: 'oneOff', origins: ['b'] }]);
    expect(plan.entries).toEqual([{ group: 'space', value: '13px', path: 'space.promoted.13px', count: 12 }]);
    const applied = applyPromotions({}, plan);
    expect(applied.written).toHaveLength(1);
    expect(applied.tree).toMatchObject({ space: { promoted: { '13px': { $type: 'dimension', $value: { value: 13, unit: 'px' } } } } });
    const colorPlan = planPromotions([{ group: 'color', value: '#abc', count: 9, kind: 'systematic', origins: ['c'] }]);
    expect(applyPromotions({}, colorPlan).tree).toMatchObject({ color: { promoted: { abc: { $type: 'color', $value: '#abc' } } } });
    const stringPlan = planPromotions([{ group: 'motion', value: 'ease-in', count: 9, kind: 'systematic', origins: ['d'] }]);
    const stringTree = applyPromotions({ motion: { promoted: {} } }, stringPlan).tree as { motion: { promoted: Record<string, { $type: string }> } };
    expect(stringTree.motion.promoted['ease-in']?.$type).toBe('string');
    const empty = auditFleet(contract(), [{ name: 'empty', declarations: [], sources: ['empty.tsx'] }], 8).members[0]!;
    expect(empty.coverage.status).toBe('empty');
    expect(empty.findings.map((item) => item.category)).toContain('coverage');
  });
});
