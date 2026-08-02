import React, { type CSSProperties } from 'react';
import { BookmarkHollowIcon, ChevronSmallDownIcon, ChevronSmallRightIcon, ComponentIcon, ExpandAltIcon, GridIcon, StructureIcon } from '@storybook/icons';
import { Badge, Button, EmptyTabContent, IconButton, TabButton } from 'storybook/internal/components';
import { addons, types, useAddonState, useChannel, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { type StorybookTheme, useTheme } from 'storybook/theming';
import { ADDON_ID, REQUEST_EVENT, VERDICT_EVENT, type DesignPanelPayload } from './preview.js';

const TAB_ID = `${ADDON_ID}/tab`;
const COMPOSITION_VIEW = '$composition';
const element = React.createElement;
const tiers = ['atom', 'molecule', 'organism', 'template'] as const;
const AtomIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => element('svg', { ...props, viewBox: '1 1 22 22', fill: 'none', 'aria-hidden': true },
  element('ellipse', { cx: 12, cy: 12, rx: 9, ry: 3.7, stroke: 'currentColor', strokeWidth: 1.7 }),
  element('ellipse', { cx: 12, cy: 12, rx: 9, ry: 3.7, stroke: 'currentColor', strokeWidth: 1.7, transform: 'rotate(60 12 12)' }),
  element('ellipse', { cx: 12, cy: 12, rx: 9, ry: 3.7, stroke: 'currentColor', strokeWidth: 1.7, transform: 'rotate(120 12 12)' }),
  element('circle', { cx: 12, cy: 12, r: 1.8, fill: 'currentColor' }),
);
const tierIcons = { atom: AtomIcon, molecule: ComponentIcon, organism: GridIcon, template: StructureIcon };
const tierColors = { atom: 'var(--ad-agentic)', molecule: 'var(--ad-accent)', organism: 'var(--ad-positive)', template: 'var(--ad-warning)' };
type Tab = 'inventory' | 'coverage' | 'violations';
type Finding = { rule: string; category: string; path: string; message: string };
type Result = { criterionId?: string; status?: string; reason?: string; evidence?: Finding[] };

const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, minHeight: '100vh', width: '100%', boxSizing: 'border-box' as const, padding: '32px 20px 0', color: 'var(--ad-text)', background: 'var(--ad-canvas)', fontFamily: 'var(--ad-font)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { margin: 0, color: 'var(--ad-text)', fontSize: 17, fontWeight: 700 },
  meta: { color: 'var(--ad-muted)', fontFamily: 'var(--ad-font)', fontSize: 11, lineHeight: 1.4 },
  tabs: { display: 'flex', gap: 0, margin: '0 -20px', padding: 0, borderBottom: '1px solid var(--ad-line)' },
  section: { marginBottom: 6 },
  sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, color: 'var(--ad-muted)', fontSize: 10, fontWeight: 600 },
  treeGroup: { display: 'grid', gridTemplateColumns: '14px 17px minmax(0, 1fr) auto', justifyContent: 'stretch', gap: 7, width: '100%', padding: '0 6px', color: 'var(--ad-text)', textAlign: 'left' as const },
  treeGroupLabel: { overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--ad-tree-size)', fontWeight: 'var(--ad-tree-weight)' },
  treeChildren: { marginLeft: 39 },
  treeIcon: { width: 14, height: 14, flexShrink: 0 },
  atomIcon: { width: 17, height: 17, flexShrink: 0 },
  chevronIcon: { width: 14, height: 14, flexShrink: 0 },
  row: { display: 'grid', gridTemplateColumns: 'minmax(150px, .7fr) minmax(180px, 1.2fr) 90px', gap: 12, alignItems: 'center', padding: '9px 11px', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)', marginBottom: 5 },
  inventoryRow: { display: 'grid', gridTemplateColumns: '17px minmax(0, 1fr) auto', gap: 8, alignItems: 'center', width: '100%', minHeight: 34, padding: '5px 7px', overflow: 'visible', borderRadius: 'var(--ad-radius)', color: 'var(--ad-text)', fontWeight: 'var(--ad-tree-weight)', textAlign: 'left' as const },
  selectedRow: { background: 'var(--ad-selected)', color: 'var(--ad-selected-text)', boxShadow: 'none', fontWeight: 'var(--ad-tree-selected-weight)' },
  inventoryName: { color: 'inherit', fontFamily: 'var(--ad-font)', fontSize: 'var(--ad-tree-size)', fontWeight: 'inherit', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis' },
  name: { color: 'inherit', font: '600 11px var(--ad-mono)', overflow: 'hidden', textOverflow: 'ellipsis' },
  detail: { color: 'var(--ad-muted)', fontSize: 10, lineHeight: 1.4 },
  chip: { margin: '2px 3px 2px 0', fontFamily: 'var(--ad-mono)' },
  finding: { padding: '10px 12px', marginBottom: 6, border: '1px solid var(--ad-line)', borderLeft: '3px solid var(--ad-negative)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  tierBadge: { display: 'inline-flex', alignItems: 'center', justifySelf: 'end', gap: 5, padding: '3px 8px', border: '1px solid var(--ad-line)', borderRadius: 999, background: 'var(--ad-panel)', fontSize: 10, fontWeight: 600, textTransform: 'capitalize' as const },
  workspace: { display: 'grid', gridTemplateColumns: 'minmax(250px, 290px) minmax(0, 1fr)', flex: '1 1 auto', minHeight: 'calc(100vh - 108px)', marginRight: -20, gap: 0, alignItems: 'stretch' },
  inventory: { minWidth: 0, marginLeft: -20, padding: '8px 6px 24px', borderRight: '1px solid var(--ad-line)' },
  inspector: { display: 'flex', flexDirection: 'column' as const, position: 'relative' as const, minWidth: 0, height: '100%', padding: 0 },
  componentMeta: { display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 10, minHeight: 45, padding: '7px 42px 7px 12px', borderBottom: '1px solid var(--ad-line)', background: 'var(--ad-canvas)' },
  componentIdentity: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  componentMetaTitle: { color: 'var(--ad-text)', fontSize: 'var(--ad-tree-size)', fontWeight: 'var(--ad-tree-selected-weight)' },
  componentMetaDetails: { display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: '5px 14px', minHeight: 24, paddingLeft: 10, borderLeft: '1px solid var(--ad-line)' },
  componentMetaGroup: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ad-muted)', fontSize: 11, fontWeight: 600, lineHeight: '18px' },
  componentMetaChip: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, marginRight: 3, padding: '4px 7px', borderRadius: 20, fontFamily: 'var(--ad-font)', fontSize: 10, fontWeight: 600, lineHeight: '12px', letterSpacing: 0 },
  previewFrame: { position: 'relative' as const, display: 'flex', flex: '1 1 auto', minHeight: 0 },
  preview: { display: 'block', flex: '1 1 auto', width: '100%', minHeight: 'calc(100vh - 154px)', border: 0, borderRadius: 0, background: 'var(--ad-panel)' },
  previewAction: { position: 'absolute' as const, top: 8, right: 8, zIndex: 2, border: '1px solid var(--ad-line)', background: 'var(--ad-panel)' },
};

type ThemeVariables = CSSProperties & Record<`--ad-${string}`, string>;
const darkenHex = (color: string, amount: number) => {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return color;
  const red = Number.parseInt(match[1]!, 16) / 255;
  const green = Number.parseInt(match[2]!, 16) / 255;
  const blue = Number.parseInt(match[3]!, 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = delta === 0 ? 0 : max === red ? 60 * (((green - blue) / delta) % 6) : max === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4);
  return `hsl(${hue < 0 ? hue + 360 : hue} ${saturation * 100}% ${Math.max(0, lightness - amount) * 100}%)`;
};
const themeVariables = (theme: StorybookTheme): ThemeVariables => ({
  '--ad-canvas': theme.background.content,
  '--ad-panel': theme.background.app,
  '--ad-hover': theme.background.hoverable,
  '--ad-selected': theme.base === 'dark' ? darkenHex(theme.color.secondary, .18) : theme.color.secondary,
  '--ad-selected-text': theme.color.lightest,
  '--ad-line': theme.appBorderColor,
  '--ad-text': theme.fgColor.default,
  '--ad-muted': theme.fgColor.muted,
  '--ad-accent': theme.fgColor.accent,
  '--ad-agentic': theme.fgColor.agentic,
  '--ad-story': theme.color.seafoam,
  '--ad-positive': theme.fgColor.positive,
  '--ad-warning': theme.fgColor.warning,
  '--ad-negative': theme.fgColor.negative,
  '--ad-font': theme.typography.fonts.base,
  '--ad-mono': theme.typography.fonts.mono,
  '--ad-tree-size': `${theme.typography.size.s2}px`,
  '--ad-tree-weight': `${theme.typography.weight.regular}`,
  '--ad-tree-selected-weight': `${theme.typography.weight.bold}`,
  '--ad-radius': `${theme.appBorderRadius}px`,
});

const findingsOf = (payload: DesignPanelPayload): Finding[] => (payload.results as Result[]).flatMap((result) => result.evidence ?? []);
const displayName = (name: string) => name.split('-').map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(' ');
const metadataColors: Record<string, string> = { parts: 'var(--ad-accent)', variants: 'var(--ad-agentic)', states: 'var(--ad-warning)', slots: 'var(--ad-story)' };
const countObserved = (payload: DesignPanelPayload, name: string) => payload.evidence.nodes.filter((node) => node.component === name).length;
const componentIssues = (payload: DesignPanelPayload, name: string) => {
  const indexes = new Set(payload.evidence.nodes.flatMap((node, index) => node.component === name ? [index] : []));
  return findingsOf(payload).filter((finding) => [...indexes].some((index) => finding.path === `nodes[${index}]` || finding.path.startsWith(`nodes[${index}].`)));
};
const chips = (values: readonly string[]) => values.length ? values.map((value) => element('span', { key: value, style: styles.chip }, element(Badge, { compact: true, status: 'neutral' }, value))) : [element('span', { key: 'empty', style: styles.detail }, '—')];
const metadataChips = (values: readonly string[], color: string, selected?: string, onSelect?: (value: string) => void) => values.map((value) => {
  const active = selected === value;
  const style = { ...styles.componentMetaChip, color, background: `color-mix(in srgb, ${color} ${active ? 24 : 10}%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} ${active ? 55 : 25}%, transparent)`, ...(onSelect ? { border: 0, cursor: 'pointer' } : {}) };
  return onSelect
    ? element('button', { key: value, type: 'button', style, 'aria-pressed': active, onClick: () => onSelect(value) }, displayName(value))
    : element('span', { key: value, style }, displayName(value));
});
const argsQuery = (args: Record<string, string | number | boolean | null>) => Object.entries(args).map(([key, value]) => `${key}:${String(value)}`).join(';');
const tierBadge = (tier: (typeof tiers)[number], compact = false) => {
  const TierIcon = tierIcons[tier];
  const iconSize = compact ? tier === 'atom' ? 12 : 11 : undefined;
  return element('span', { style: { ...styles.tierBadge, ...(compact ? { gap: 3, padding: '2px 6px', fontSize: 9 } : {}) } },
    element(TierIcon, { style: { ...(tier === 'atom' ? styles.atomIcon : styles.treeIcon), ...(iconSize ? { width: iconSize, height: iconSize } : {}), color: tierColors[tier] } }),
    element('span', null, tier),
  );
};

function Inventory({ payload, selected, onSelect }: { payload: DesignPanelPayload; selected: string; onSelect(name: string): void }) {
  const [collapsed, setCollapsed] = React.useState<Record<(typeof tiers)[number], boolean>>({ atom: false, molecule: false, organism: false, template: false });
  const edgeCount = payload.contract.components.reduce((sum, component) => sum + component.parts.length, 0);
  return element(React.Fragment, null,
    element(Button, { variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, active: selected === COMPOSITION_VIEW, onClick: () => onSelect(COMPOSITION_VIEW), style: { ...styles.inventoryRow, marginBottom: 8, ...(selected === COMPOSITION_VIEW ? styles.selectedRow : {}) } },
      element(StructureIcon, { style: { ...styles.treeIcon, ...(selected === COMPOSITION_VIEW ? {} : { color: 'var(--ad-muted)' }) } }),
      element('span', { style: styles.inventoryName }, 'Composition'),
      element(Badge, { compact: true, status: 'neutral' }, `${edgeCount} edges`),
    ),
    ...tiers.map((tier) => {
    const components = payload.contract.components.filter((component) => component.tier === tier);
    const TierIcon = tierIcons[tier];
    const isCollapsed = collapsed[tier];
    return element('section', { key: tier, style: styles.section },
      element(Button, {
        variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, 'aria-expanded': !isCollapsed,
        onClick: () => setCollapsed((current) => ({ ...current, [tier]: !current[tier] })), style: styles.treeGroup,
        children: [
          element(isCollapsed ? ChevronSmallRightIcon : ChevronSmallDownIcon, { key: 'chevron', style: { ...styles.chevronIcon, color: 'var(--ad-muted)' } }),
          element(TierIcon, { key: 'tier', style: { ...(tier === 'atom' ? styles.atomIcon : styles.treeIcon), color: tierColors[tier] } }),
          element('span', { key: 'label', style: styles.treeGroupLabel }, `${tier.charAt(0).toUpperCase()}${tier.slice(1)}s`),
          element(Badge, { key: 'count', compact: true, status: 'neutral' }, components.length),
        ],
      }),
      isCollapsed ? null : element('div', { style: styles.treeChildren }, ...(components.length ? components.map((component) => {
        const observed = countObserved(payload, component.name);
        const issues = componentIssues(payload, component.name).length;
        const status = issues ? `${issues} issue${issues === 1 ? '' : 's'}` : observed ? `${observed} observed` : 'not observed';
        const story = payload.stories[component.name];
        return element(Button, { key: component.name, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, active: selected === component.name, onClick: () => onSelect(component.name), style: { ...styles.inventoryRow, ...(selected === component.name ? styles.selectedRow : {}) } },
          element(BookmarkHollowIcon, { style: { ...styles.treeIcon, ...(selected === component.name ? {} : { color: 'var(--ad-story)' }) } }),
          element('span', { style: styles.inventoryName, title: component.name }, displayName(component.name)),
          element(Badge, { compact: true, status: issues || !story ? 'negative' : observed ? 'positive' : 'neutral' }, story ? status : 'story missing'),
        );
      }) : [element(EmptyTabContent, { key: 'empty', title: `No ${tier}s declared` })])),
    );
    }),
  );
}

function VisualInspector({ payload, name }: { payload: DesignPanelPayload; name: string }) {
  const [selections, setSelections] = React.useState<Record<string, Record<string, string>>>({});
  if (name === COMPOSITION_VIEW) return element('aside', { style: { ...styles.inspector, padding: 14 } }, element(Composition, { payload }));
  const component = payload.contract.components.find((item) => item.name === name);
  const story = payload.stories[name];
  if (!component) return element('aside', { style: styles.inspector }, element(EmptyTabContent, { title: 'Select a declared component' }));
  const groups: [string, readonly string[]][] = [['parts', component.parts], ['variants', component.variants], ['states', component.states], ['slots', component.requiredSlots]];
  const visibleGroups = groups.filter(([, values]) => values.length);
  const componentSelections = selections[name] ?? {};
  const controls = payload.controls?.[name] ?? {};
  const choose = (group: string, value: string) => setSelections((current) => ({ ...current, [name]: { ...current[name], [group]: value } }));
  const args = Object.assign({}, ...(['variants', 'states'] as const).map((group) => controls[group]?.[componentSelections[group] ?? component[group][0] ?? ''] ?? {}));
  const query = argsQuery(args);
  const source = story ? `iframe.html?id=${encodeURIComponent(story)}&viewMode=story&shortcuts=false${query ? `&args=${encodeURIComponent(query)}` : ''}` : '';
  return element('aside', { style: styles.inspector },
    element('div', { style: styles.componentMeta },
      element('span', { style: styles.componentIdentity }, tierBadge(component.tier, true), element('span', { style: styles.componentMetaTitle }, displayName(component.name))),
      visibleGroups.length ? element('span', { style: styles.componentMetaDetails }, ...visibleGroups.map(([label, values], index) => {
        const color = metadataColors[label] ?? 'var(--ad-muted)';
        const control = label === 'variants' || label === 'states' ? controls[label] : undefined;
        const selected = control ? componentSelections[label] ?? values[0] : undefined;
        return element('span', { key: label, style: { ...styles.componentMetaGroup, ...(index ? { paddingLeft: 14, borderLeft: '1px solid var(--ad-line)' } : {}) } }, element('span', null, displayName(label)), ...metadataChips(values, color, selected, control ? (value) => choose(label, value) : undefined));
      })) : null,
    ),
    element('div', { style: styles.previewFrame },
      story
        ? element('iframe', { title: `${component.name} canonical story`, src: source, style: styles.preview })
        : element(EmptyTabContent, { title: 'No canonical story mapped', description: 'Map the component to a Storybook story to inspect its rendered implementation.' }),
      story ? element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', ariaLabel: 'Open in canvas', asChild: true, style: styles.previewAction }, element('a', { href: `?path=/story/${encodeURIComponent(story)}${query ? `&args=${encodeURIComponent(query)}` : ''}`, target: '_top', title: 'Open in canvas' }, element(ExpandAltIcon))) : null,
    ),
  );
}

function Composition({ payload }: { payload: DesignPanelPayload }) {
  const parents = payload.contract.components.filter((component) => component.parts.length);
  return element('div', null,
    element('div', { style: styles.sectionTitle }, element('span', null, 'Declared Atomic composition'), element(Badge, { compact: true, status: 'neutral' }, `${parents.reduce((sum, item) => sum + item.parts.length, 0)} edges`)),
    ...(parents.length ? parents.map((component) => element('div', { key: component.name, style: styles.row },
      element('span', { style: styles.name }, component.name),
      element('div', null, ...component.parts.map((part) => element('span', { key: part, style: styles.chip }, element(Badge, { compact: true, status: 'neutral' }, `→ ${part}`)))),
      tierBadge(component.tier),
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
  const api = useStorybookApi();
  const { storyId } = useStorybookState();
  const [tab, setTab] = React.useState<Tab>('inventory');
  const activeComponent = Object.entries(payload.stories).find(([, story]) => story === storyId)?.[0];
  const [selected, setSelected] = React.useState(() => activeComponent ?? payload.contract.components.find((component) => payload.stories[component.name])?.name ?? payload.contract.components[0]?.name ?? '');
  React.useEffect(() => {
    setSelected((current) => activeComponent ?? (current === COMPOSITION_VIEW || payload.contract.components.some((component) => component.name === current) ? current : payload.contract.components[0]?.name ?? ''));
  }, [activeComponent, payload]);
  const selectComponent = (name: string) => {
    setSelected(name);
    const story = payload.stories[name];
    if (story && story !== storyId) api.selectStory(story);
  };
  const passing = payload.outcome === 'pass';
  const findings = findingsOf(payload);
  const tabs: [Tab, string, number][] = [
    ['inventory', 'Atomic View', payload.contract.components.length],
    ['coverage', 'Coverage', payload.contract.surfaces.length],
    ['violations', 'Violations', findings.length],
  ];
  const content = tab === 'inventory'
    ? element('div', { style: styles.workspace }, element('div', { style: styles.inventory }, element(Inventory, { payload, selected, onSelect: selectComponent })), element(VisualInspector, { payload, name: selected }))
    : element('div', { style: { padding: '14px 0 24px' } }, tab === 'coverage' ? element(Coverage, { payload }) : element(Violations, { payload }));
  return element('div', { style: { ...styles.root, ...themeVariables(theme as StorybookTheme) } },
    element('header', { style: styles.header },
      element('div', { style: styles.title }, payload.contract.name),
      element(Badge, { status: passing ? 'positive' : 'negative' }, passing ? 'PASS' : 'FAIL'),
    ),
    element('nav', { style: styles.tabs }, ...tabs.map(([id, label, count]) => element(TabButton, { key: id, active: tab === id, onClick: () => setTab(id), style: { gap: 6 }, children: [label, element(Badge, { key: 'count', compact: true, status: id === 'violations' && count ? 'negative' : 'neutral' }, count)] }))),
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
  const [persistedPayload, setPersistedPayload] = useAddonState<DesignPanelPayload | undefined>(`${ADDON_ID}/last-payload`, undefined);
  const emit = useChannel({});
  React.useEffect(() => {
    const update = (next: DesignPanelPayload) => {
      setPayload(next);
      setPersistedPayload(next, { persistence: 'session' });
    };
    subscribers.add(update);
    if (cachedPayload) update(cachedPayload);
    emit(REQUEST_EVENT);
    return () => { subscribers.delete(update); };
  }, [emit, setPersistedPayload]);
  const visiblePayload = payload ?? persistedPayload;
  return visiblePayload ? element(Workbench, { payload: visiblePayload }) : element('div', { style: { ...styles.root, ...themeVariables(theme as StorybookTheme) } }, element(EmptyTabContent, { title: 'No live design evidence', description: 'Open a story with parameters.designHarness, then return to Design Contract.' }));
}

addons.register(ADDON_ID, () => {
  addons.getChannel().on(VERDICT_EVENT, cachePayload);
  addons.add(TAB_ID, { type: types.TAB, title: 'Design Contract', render: () => element(DesignPage) });
});
