import React from 'react';
import { AddonPanel } from 'storybook/internal/components';
import { addons, types, useChannel } from 'storybook/manager-api';
import { ADDON_ID, REQUEST_EVENT, VERDICT_EVENT, type DesignPanelPayload } from './preview.js';

const PANEL_ID = `${ADDON_ID}/panel`;
const element = React.createElement;
const tiers = ['atom', 'molecule', 'organism', 'template'] as const;
type Tab = 'inventory' | 'composition' | 'coverage' | 'violations';
type Finding = { rule: string; category: string; path: string; message: string };
type Result = { criterionId?: string; status?: string; reason?: string; evidence?: Finding[] };

const color = { canvas: '#09120f', panel: '#0f1b17', line: '#20362d', text: '#e6f0eb', muted: '#7f958c', lime: '#b8f34a', red: '#fb7185', cyan: '#6ee7b7' };
const styles = {
  root: { minHeight: '100%', padding: 18, color: color.text, background: color.canvas, fontFamily: 'Inter, ui-sans-serif, system-ui' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 14 },
  eyebrow: { color: color.muted, fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' as const },
  title: { margin: '4px 0 2px', color: color.text, fontSize: 17, fontWeight: 750 },
  meta: { color: color.muted, font: '10px ui-monospace, monospace' },
  badge: { padding: '6px 9px', borderRadius: 999, fontSize: 9, fontWeight: 800, letterSpacing: '.08em' },
  tabs: { display: 'flex', gap: 4, paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${color.line}` },
  tab: { padding: '7px 10px', border: 0, borderRadius: 6, color: color.muted, background: 'transparent', cursor: 'pointer', fontSize: 11 },
  section: { marginBottom: 15 },
  sectionTitle: { display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: color.muted, fontSize: 9, fontWeight: 750, letterSpacing: '.1em', textTransform: 'uppercase' as const },
  row: { display: 'grid', gridTemplateColumns: 'minmax(150px, .7fr) minmax(180px, 1.2fr) 90px', gap: 12, alignItems: 'center', padding: '9px 11px', border: `1px solid ${color.line}`, borderRadius: 7, background: color.panel, marginBottom: 5 },
  name: { color: color.text, font: '600 11px ui-monospace, monospace' },
  detail: { color: color.muted, fontSize: 10, lineHeight: 1.4 },
  status: { justifySelf: 'end', fontSize: 9, fontWeight: 750, textTransform: 'uppercase' as const },
  chip: { display: 'inline-block', padding: '3px 6px', margin: '2px 4px 2px 0', border: `1px solid ${color.line}`, borderRadius: 999, color: '#a9bbb4', font: '9px ui-monospace, monospace' },
  empty: { padding: 22, border: `1px dashed ${color.line}`, borderRadius: 8, color: color.muted, textAlign: 'center' as const, fontSize: 11 },
  finding: { padding: '10px 12px', marginBottom: 6, border: `1px solid ${color.line}`, borderLeft: `3px solid ${color.red}`, borderRadius: 7, background: color.panel },
};

const findingsOf = (payload: DesignPanelPayload): Finding[] => (payload.results as Result[]).flatMap((result) => result.evidence ?? []);
const countObserved = (payload: DesignPanelPayload, name: string) => payload.evidence.nodes.filter((node) => node.component === name).length;
const componentIssues = (payload: DesignPanelPayload, name: string) => {
  const indexes = new Set(payload.evidence.nodes.flatMap((node, index) => node.component === name ? [index] : []));
  return findingsOf(payload).filter((finding) => [...indexes].some((index) => finding.path === `nodes[${index}]` || finding.path.startsWith(`nodes[${index}].`)));
};
const chips = (values: readonly string[]) => values.length ? values.map((value) => element('span', { key: value, style: styles.chip }, value)) : [element('span', { key: 'empty', style: styles.detail }, '—')];

function Inventory({ payload }: { payload: DesignPanelPayload }) {
  return element(React.Fragment, null, ...tiers.map((tier) => {
    const components = payload.contract.components.filter((component) => component.tier === tier);
    return element('section', { key: tier, style: styles.section },
      element('div', { style: styles.sectionTitle }, element('span', null, `${tier}s`), element('span', null, components.length)),
      ...(components.length ? components.map((component) => {
        const observed = countObserved(payload, component.name);
        const issues = componentIssues(payload, component.name).length;
        const status = issues ? `${issues} issue${issues === 1 ? '' : 's'}` : observed ? `${observed} observed` : 'not observed';
        return element('div', { key: component.name, style: styles.row },
          element('span', { style: styles.name }, component.name),
          element('div', { style: styles.detail },
            component.parts.length ? element('div', null, 'parts ', ...chips(component.parts)) : null,
            component.variants.length ? element('div', null, 'variants ', ...chips(component.variants)) : null,
            component.states.length ? element('div', null, 'states ', ...chips(component.states)) : null,
            component.requiredSlots.length ? element('div', null, 'slots ', ...chips(component.requiredSlots)) : null,
          ),
          element('span', { style: { ...styles.status, color: issues ? color.red : observed ? color.lime : color.muted } }, status),
        );
      }) : [element('div', { key: 'empty', style: styles.empty }, `No ${tier}s declared`)]),
    );
  }));
}

function Composition({ payload }: { payload: DesignPanelPayload }) {
  const parents = payload.contract.components.filter((component) => component.parts.length);
  return element('div', null,
    element('div', { style: styles.sectionTitle }, element('span', null, 'Declared Atomic composition'), element('span', null, `${parents.reduce((sum, item) => sum + item.parts.length, 0)} edges`)),
    ...(parents.length ? parents.map((component) => element('div', { key: component.name, style: styles.row },
      element('span', { style: styles.name }, component.name),
      element('div', null, ...component.parts.map((part) => element('span', { key: part, style: styles.chip }, `→ ${part}`))),
      element('span', { style: { ...styles.status, color: color.cyan } }, component.tier),
    )) : [element('div', { key: 'empty', style: styles.empty }, 'No component composition declared')]),
  );
}

function Coverage({ payload }: { payload: DesignPanelPayload }) {
  const observed = new Set(payload.evidence.nodes.map((node) => node.component));
  const axes = payload.evidence.coverage ?? {};
  return element('div', null, ...payload.contract.surfaces.map((surface) => {
    const current = surface.name === payload.evidence.surface;
    const required = [...new Set([...surface.requiredComponents, ...(surface.template ? [surface.template] : [])])];
    const covered = required.filter((name) => observed.has(name)).length;
    return element('section', { key: surface.name, style: { ...styles.section, padding: 12, border: `1px solid ${current ? '#4d6f29' : color.line}`, borderRadius: 8, background: color.panel } },
      element('div', { style: styles.sectionTitle }, element('span', null, surface.name), element('span', null, current ? 'current story' : 'declared')),
      element('div', { style: styles.detail }, `components ${current ? covered : 0}/${required.length}`, element('div', null, ...required.map((name) => element('span', { key: name, style: { ...styles.chip, color: current && observed.has(name) ? color.lime : color.muted } }, name)))),
      current ? element('div', { style: styles.detail }, ...(['states', 'themes', 'viewports', 'locales'] as const).map((axis) => element('div', { key: axis }, `${axis} `, ...chips(axes[axis] ?? [])))) : null,
    );
  }));
}

function Violations({ payload }: { payload: DesignPanelPayload }) {
  const findings = findingsOf(payload);
  if (!findings.length) return element('div', { style: styles.empty }, 'No contract violations in the rendered story.');
  return element('div', null, ...findings.map((finding, index) => element('div', { key: `${finding.rule}-${index}`, style: styles.finding },
    element('div', { style: { ...styles.name, color: color.red } }, finding.rule),
    element('div', { style: { ...styles.meta, margin: '3px 0 6px' } }, finding.path),
    element('div', { style: styles.detail }, finding.message),
  )));
}

function Workbench({ payload }: { payload: DesignPanelPayload }) {
  const [tab, setTab] = React.useState<Tab>('inventory');
  const passing = payload.outcome === 'pass';
  const findings = findingsOf(payload);
  const observed = new Set(payload.evidence.nodes.map((node) => node.component)).size;
  const tabs: [Tab, string, number][] = [
    ['inventory', 'Inventory', payload.contract.components.length],
    ['composition', 'Composition', payload.contract.components.reduce((sum, item) => sum + item.parts.length, 0)],
    ['coverage', 'Coverage', payload.contract.surfaces.length],
    ['violations', 'Violations', findings.length],
  ];
  const content = tab === 'inventory' ? element(Inventory, { payload }) : tab === 'composition' ? element(Composition, { payload }) : tab === 'coverage' ? element(Coverage, { payload }) : element(Violations, { payload });
  return element('div', { style: styles.root },
    element('header', { style: styles.header },
      element('div', null, element('div', { style: styles.eyebrow }, 'Assay Design / live evidence'), element('div', { style: styles.title }, payload.contract.name), element('div', { style: styles.meta }, `${payload.contract.components.length} declared · ${observed} observed · ${payload.evidence.surface}`)),
      element('span', { style: { ...styles.badge, color: passing ? '#142409' : '#2a0c12', background: passing ? color.lime : color.red } }, passing ? 'PASS' : 'FAIL'),
    ),
    element('nav', { style: styles.tabs }, ...tabs.map(([id, label, count]) => element('button', { key: id, onClick: () => setTab(id), style: { ...styles.tab, color: tab === id ? color.text : color.muted, background: tab === id ? color.panel : 'transparent' } }, `${label} ${count}`))),
    content,
  );
}

function Panel({ active }: { active: boolean }) {
  const [payload, setPayload] = React.useState<DesignPanelPayload>();
  const emit = useChannel({ [VERDICT_EVENT]: (next: DesignPanelPayload) => setPayload(next) });
  React.useEffect(() => {
    if (active) emit(REQUEST_EVENT);
  }, [active, emit]);
  return element(AddonPanel, { active, children: payload ? element(Workbench, { payload }) : element('div', { style: styles.empty }, 'Render a story with parameters.designHarness to inspect its design contract.') });
}

addons.register(ADDON_ID, () => addons.add(PANEL_ID, { type: types.PANEL, title: 'Design Contract', match: ({ viewMode }) => viewMode === 'story', render: ({ active }) => element(Panel, { active: Boolean(active) }) }));
