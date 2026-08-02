import React, { type CSSProperties } from 'react';
import { Badge, Button, EmptyTabContent, Link, TabButton } from 'storybook/internal/components';
import { addons, types, useChannel } from 'storybook/manager-api';
import { type StorybookTheme, useTheme } from 'storybook/theming';
import { ADDON_ID, REQUEST_EVENT, VERDICT_EVENT, type DesignPanelPayload } from './preview.js';

const TAB_ID = `${ADDON_ID}/tab`;
const element = React.createElement;
const tiers = ['atom', 'molecule', 'organism', 'template'] as const;
type Tab = 'inventory' | 'composition' | 'coverage' | 'violations';
type Finding = { rule: string; category: string; path: string; message: string };
type Result = { criterionId?: string; status?: string; reason?: string; evidence?: Finding[] };

const styles = {
  root: { minHeight: '100vh', width: '100%', padding: 20, color: 'var(--ad-text)', background: 'var(--ad-canvas)', fontFamily: 'var(--ad-font)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 14 },
  eyebrow: { color: 'var(--ad-muted)', fontSize: 11, fontWeight: 600 },
  title: { margin: '3px 0 2px', color: 'var(--ad-text)', fontSize: 17, fontWeight: 700 },
  meta: { color: 'var(--ad-muted)', font: '10px var(--ad-mono)' },
  tabs: { display: 'flex', gap: 2, marginBottom: 14, borderBottom: '1px solid var(--ad-line)' },
  section: { marginBottom: 13 },
  sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, color: 'var(--ad-muted)', fontSize: 10, fontWeight: 600 },
  row: { display: 'grid', gridTemplateColumns: 'minmax(150px, .7fr) minmax(180px, 1.2fr) 90px', gap: 12, alignItems: 'center', padding: '9px 11px', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)', marginBottom: 5 },
  inventoryRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '5px 8px', alignItems: 'center', width: '100%', minHeight: 34, padding: '6px 8px', borderRadius: 'var(--ad-radius)', color: 'var(--ad-text)', textAlign: 'left' as const },
  selectedRow: { background: 'var(--ad-hover)', boxShadow: 'inset 2px 0 var(--ad-accent)' },
  name: { color: 'var(--ad-text)', font: '600 11px var(--ad-mono)', overflow: 'hidden', textOverflow: 'ellipsis' },
  detail: { color: 'var(--ad-muted)', fontSize: 10, lineHeight: 1.4 },
  inventoryDetail: { gridColumn: '1 / -1', color: 'var(--ad-muted)', fontSize: 9, lineHeight: 1.35 },
  chip: { margin: '2px 3px 2px 0', fontFamily: 'var(--ad-mono)' },
  finding: { padding: '10px 12px', marginBottom: 6, border: '1px solid var(--ad-line)', borderLeft: '3px solid var(--ad-negative)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  workspace: { display: 'grid', gridTemplateColumns: 'minmax(250px, 290px) minmax(0, 1fr)', gap: 16, alignItems: 'start' },
  inventory: { minWidth: 0, paddingRight: 12, borderRight: '1px solid var(--ad-line)' },
  inspector: { position: 'sticky' as const, top: 0, minWidth: 0 },
  preview: { display: 'block', width: '100%', height: 'min(720px, 72vh)', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
};

type ThemeVariables = CSSProperties & Record<`--ad-${string}`, string>;
const themeVariables = (theme: StorybookTheme): ThemeVariables => ({
  '--ad-canvas': theme.background.content,
  '--ad-panel': theme.background.app,
  '--ad-hover': theme.background.hoverable,
  '--ad-line': theme.appBorderColor,
  '--ad-text': theme.fgColor.default,
  '--ad-muted': theme.fgColor.muted,
  '--ad-accent': theme.fgColor.accent,
  '--ad-positive': theme.fgColor.positive,
  '--ad-negative': theme.fgColor.negative,
  '--ad-font': theme.typography.fonts.base,
  '--ad-mono': theme.typography.fonts.mono,
  '--ad-radius': `${theme.appBorderRadius}px`,
});

const findingsOf = (payload: DesignPanelPayload): Finding[] => (payload.results as Result[]).flatMap((result) => result.evidence ?? []);
const countObserved = (payload: DesignPanelPayload, name: string) => payload.evidence.nodes.filter((node) => node.component === name).length;
const componentIssues = (payload: DesignPanelPayload, name: string) => {
  const indexes = new Set(payload.evidence.nodes.flatMap((node, index) => node.component === name ? [index] : []));
  return findingsOf(payload).filter((finding) => [...indexes].some((index) => finding.path === `nodes[${index}]` || finding.path.startsWith(`nodes[${index}].`)));
};
const chips = (values: readonly string[]) => values.length ? values.map((value) => element('span', { key: value, style: styles.chip }, element(Badge, { compact: true, status: 'neutral' }, value))) : [element('span', { key: 'empty', style: styles.detail }, '—')];

function Inventory({ payload, selected, onSelect }: { payload: DesignPanelPayload; selected: string; onSelect(name: string): void }) {
  return element(React.Fragment, null, ...tiers.map((tier) => {
    const components = payload.contract.components.filter((component) => component.tier === tier);
    return element('section', { key: tier, style: styles.section },
      element('div', { style: styles.sectionTitle }, element('span', null, `${tier}s`), element(Badge, { compact: true, status: 'neutral' }, components.length)),
      ...(components.length ? components.map((component) => {
        const observed = countObserved(payload, component.name);
        const issues = componentIssues(payload, component.name).length;
        const status = issues ? `${issues} issue${issues === 1 ? '' : 's'}` : observed ? `${observed} observed` : 'not observed';
        const story = payload.stories[component.name];
        return element(Button, { key: component.name, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, active: selected === component.name, onClick: () => onSelect(component.name), style: { ...styles.inventoryRow, ...(selected === component.name ? styles.selectedRow : {}) } },
          element('span', { style: styles.name }, component.name),
          element(Badge, { compact: true, status: issues || !story ? 'negative' : observed ? 'positive' : 'neutral' }, story ? status : 'story missing'),
          element('div', { style: styles.inventoryDetail },
            component.parts.length ? element('div', null, 'parts ', ...chips(component.parts)) : null,
            component.variants.length ? element('div', null, 'variants ', ...chips(component.variants)) : null,
            component.states.length ? element('div', null, 'states ', ...chips(component.states)) : null,
            component.requiredSlots.length ? element('div', null, 'slots ', ...chips(component.requiredSlots)) : null,
          ),
        );
      }) : [element(EmptyTabContent, { key: 'empty', title: `No ${tier}s declared` })]),
    );
  }));
}

function VisualInspector({ payload, name }: { payload: DesignPanelPayload; name: string }) {
  const component = payload.contract.components.find((item) => item.name === name);
  const story = payload.stories[name];
  if (!component) return element('aside', { style: styles.inspector }, element(EmptyTabContent, { title: 'Select a declared component' }));
  return element('aside', { style: styles.inspector },
    story
      ? element('iframe', { title: `${component.name} canonical story`, src: `iframe.html?id=${encodeURIComponent(story)}&viewMode=story&shortcuts=false`, style: styles.preview })
      : element(EmptyTabContent, { title: 'No canonical story mapped', description: 'Map the component to a Storybook story to inspect its rendered implementation.' }),
    story ? element('div', { style: { marginTop: 8, textAlign: 'right' } }, element(Link, { href: `?path=/story/${encodeURIComponent(story)}`, target: '_top', withArrow: true }, 'Open in canvas')) : null,
  );
}

function Composition({ payload }: { payload: DesignPanelPayload }) {
  const parents = payload.contract.components.filter((component) => component.parts.length);
  return element('div', null,
    element('div', { style: styles.sectionTitle }, element('span', null, 'Declared Atomic composition'), element(Badge, { compact: true, status: 'neutral' }, `${parents.reduce((sum, item) => sum + item.parts.length, 0)} edges`)),
    ...(parents.length ? parents.map((component) => element('div', { key: component.name, style: styles.row },
      element('span', { style: styles.name }, component.name),
      element('div', null, ...component.parts.map((part) => element('span', { key: part, style: styles.chip }, element(Badge, { compact: true, status: 'neutral' }, `→ ${part}`)))),
      element(Badge, { compact: true, status: 'active' }, component.tier),
    )) : [element(EmptyTabContent, { key: 'empty', title: 'No component composition declared' })]),
  );
}

function Coverage({ payload }: { payload: DesignPanelPayload }) {
  const observed = new Set(payload.evidence.nodes.map((node) => node.component));
  const axes = payload.evidence.coverage ?? {};
  return element('div', null, ...payload.contract.surfaces.map((surface) => {
    const current = surface.name === payload.evidence.surface;
    const required = [...new Set([...surface.requiredComponents, ...(surface.template ? [surface.template] : [])])];
    const covered = required.filter((name) => observed.has(name)).length;
    return element('section', { key: surface.name, style: { ...styles.section, padding: 12, border: `1px solid ${current ? 'var(--ad-accent)' : 'var(--ad-line)'}`, borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' } },
      element('div', { style: styles.sectionTitle }, element('span', null, surface.name), element(Badge, { compact: true, status: current ? 'active' : 'neutral' }, current ? 'current story' : 'declared')),
      element('div', { style: styles.detail }, `components ${current ? covered : 0}/${required.length}`, element('div', null, ...required.map((name) => element('span', { key: name, style: styles.chip }, element(Badge, { compact: true, status: current && observed.has(name) ? 'positive' : 'neutral' }, name))))),
      current ? element('div', { style: styles.detail }, ...(['states', 'themes', 'viewports', 'locales'] as const).map((axis) => element('div', { key: axis }, `${axis} `, ...chips(axes[axis] ?? [])))) : null,
    );
  }));
}

function Violations({ payload }: { payload: DesignPanelPayload }) {
  const findings = findingsOf(payload);
  if (!findings.length) return element(EmptyTabContent, { title: 'No contract violations', description: 'The rendered story satisfies its declared design contract.' });
  return element('div', null, ...findings.map((finding, index) => element('div', { key: `${finding.rule}-${index}`, style: styles.finding },
    element('div', { style: { ...styles.name, color: 'var(--ad-negative)' } }, finding.rule),
    element('div', { style: { ...styles.meta, margin: '3px 0 6px' } }, finding.path),
    element('div', { style: styles.detail }, finding.message),
  )));
}

function Workbench({ payload }: { payload: DesignPanelPayload }) {
  const theme = useTheme();
  const [tab, setTab] = React.useState<Tab>('inventory');
  const [selected, setSelected] = React.useState(() => payload.contract.components.find((component) => payload.stories[component.name])?.name ?? payload.contract.components[0]?.name ?? '');
  React.useEffect(() => {
    if (!payload.contract.components.some((component) => component.name === selected)) setSelected(payload.contract.components[0]?.name ?? '');
  }, [payload, selected]);
  const passing = payload.outcome === 'pass';
  const findings = findingsOf(payload);
  const observed = new Set(payload.evidence.nodes.map((node) => node.component)).size;
  const tabs: [Tab, string, number][] = [
    ['inventory', 'Inventory', payload.contract.components.length],
    ['composition', 'Composition', payload.contract.components.reduce((sum, item) => sum + item.parts.length, 0)],
    ['coverage', 'Coverage', payload.contract.surfaces.length],
    ['violations', 'Violations', findings.length],
  ];
  const content = tab === 'inventory'
    ? element('div', { style: styles.workspace }, element('div', { style: styles.inventory }, element(Inventory, { payload, selected, onSelect: setSelected })), element(VisualInspector, { payload, name: selected }))
    : tab === 'composition' ? element(Composition, { payload }) : tab === 'coverage' ? element(Coverage, { payload }) : element(Violations, { payload });
  return element('div', { style: { ...styles.root, ...themeVariables(theme as StorybookTheme) } },
    element('header', { style: styles.header },
      element('div', null, element('div', { style: styles.eyebrow }, 'Assay Design / live evidence'), element('div', { style: styles.title }, payload.contract.name), element('div', { style: styles.meta }, `${payload.contract.components.length} declared · ${observed} observed · ${Object.keys(payload.stories).length} stories · ${payload.evidence.surface}`)),
      element(Badge, { status: passing ? 'positive' : 'negative' }, passing ? 'PASS' : 'FAIL'),
    ),
    element('nav', { style: styles.tabs }, ...tabs.map(([id, label, count]) => element(TabButton, { key: id, active: tab === id, onClick: () => setTab(id), children: [label, ' ', element(Badge, { key: 'count', compact: true, status: id === 'violations' && count ? 'negative' : 'neutral' }, count)] }))),
    content,
  );
}

let cachedPayload: DesignPanelPayload | undefined;
const subscribers = new Set<(payload: DesignPanelPayload) => void>();
const cachePayload = (payload: DesignPanelPayload) => {
  cachedPayload = payload;
  for (const subscriber of subscribers) subscriber(payload);
};

function DesignPage() {
  const theme = useTheme();
  const [payload, setPayload] = React.useState(cachedPayload);
  const emit = useChannel({});
  React.useEffect(() => {
    subscribers.add(setPayload);
    emit(REQUEST_EVENT);
    return () => { subscribers.delete(setPayload); };
  }, [emit]);
  return payload ? element(Workbench, { payload }) : element('div', { style: { ...styles.root, ...themeVariables(theme as StorybookTheme) } }, element(EmptyTabContent, { title: 'No live design evidence', description: 'Open a story with parameters.designHarness, then return to Design Contract.' }));
}

addons.register(ADDON_ID, () => {
  addons.getChannel().on(VERDICT_EVENT, cachePayload);
  addons.add(TAB_ID, { type: types.TAB, title: 'Design Contract', render: () => element(DesignPage) });
});
