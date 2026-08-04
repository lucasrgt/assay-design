import React, { type CSSProperties } from 'react';
import { ArrowRightIcon, BrowserIcon, ComponentIcon, DocumentIcon, ExpandAltIcon, GridAltIcon, GridIcon, MoonIcon, SideBySideIcon, SunIcon } from '@storybook/icons';
import { Badge, Button, EmptyTabContent, IconButton, TabButton } from 'storybook/internal/components';
import { addons, types, useAddonState, useChannel, useGlobals, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { type StorybookTheme, useTheme } from 'storybook/theming';
import { projectAdvancedInspection, type AdvancedInspection } from './advanced.js';
import { FoundationPreview, foundationGroups, foundationSelection, selectedFoundation } from './foundations.js';
import { AtomIcon, AtomicNavigation } from './atomic-navigation.js';
import { COMPOSITION_VIEW, displayName, implementationsForSelection, implementationsOf, inspectableComponentNames, mappedComponentNames, mappedPages, pageBackedImplementations, pageSelection, selectedPage, selectionOwnsStory } from './atomic-navigation-model.js';
import { CoverageView } from './coverage.js';
import { ADDON_ID, REQUEST_EVENT, VERDICT_EVENT, type DesignPanelPayload, type DesignStoryImplementation } from './shared.js';

const TAB_ID = `${ADDON_ID}/tab`;
const element = React.createElement;
type Tier = 'atom' | 'molecule' | 'organism' | 'template';
const tierIcons = { atom: AtomIcon, molecule: ComponentIcon, organism: GridIcon, template: DocumentIcon };
const tierColors = { atom: 'var(--ad-agentic)', molecule: 'var(--ad-accent)', organism: 'var(--ad-positive)', template: 'var(--ad-warning)' };
const scrollbarCss = `.assay-scrollbar{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--ad-muted) 48%,transparent) transparent}.assay-scrollbar::-webkit-scrollbar{width:6px;height:6px}.assay-scrollbar::-webkit-scrollbar-track,.assay-scrollbar::-webkit-scrollbar-corner{background:transparent}.assay-scrollbar::-webkit-scrollbar-thumb{min-height:32px;border-radius:999px;background:color-mix(in srgb,var(--ad-muted) 48%,transparent)}.assay-scrollbar::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--ad-muted) 72%,transparent)}.assay-scrollbar::-webkit-scrollbar-button{display:none;width:0;height:0}`;
type Tab = 'inventory' | 'coverage' | 'violations';
type Finding = { rule: string; category: string; path: string; message: string };
type Result = { criterionId?: string; status?: string; reason?: string; evidence?: Finding[] };

const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' as const, padding: '0 20px', color: 'var(--ad-text)', background: 'var(--ad-canvas)', fontFamily: 'var(--ad-font)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, margin: '0 -20px', padding: '14px 20px', borderBottom: '1px solid var(--ad-line)' },
  title: { margin: 0, color: 'var(--ad-text)', fontSize: 17, fontWeight: 700 },
  meta: { color: 'var(--ad-muted)', fontFamily: 'var(--ad-font)', fontSize: 11, lineHeight: 1.4 },
  tabs: { display: 'flex', gap: 0, margin: '0 -20px', padding: 0, borderBottom: '1px solid var(--ad-line)' },
  section: { marginBottom: 6 },
  sectionTitle: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, color: 'var(--ad-muted)', fontSize: 10, fontWeight: 600 },
  treeGroup: { display: 'grid', gridTemplateColumns: '14px 17px minmax(0, 1fr)', justifyContent: 'stretch', gap: 7, width: '100%', padding: '0 6px', color: 'var(--ad-text)', textAlign: 'left' as const },
  treeGroupLabel: { overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--ad-tree-size)', fontWeight: 'var(--ad-tree-weight)' },
  treeChildren: { marginLeft: 39 },
  treeIcon: { width: 14, height: 14, flexShrink: 0 },
  atomIcon: { width: 17, height: 17, flexShrink: 0 },
  chevronIcon: { width: 14, height: 14, flexShrink: 0 },
  row: { display: 'grid', gridTemplateColumns: 'minmax(150px, .7fr) minmax(180px, 1.2fr) 90px', gap: 12, alignItems: 'center', padding: '9px 11px', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)', marginBottom: 5 },
  inventoryRow: { display: 'grid', gridTemplateColumns: '17px minmax(0, 1fr)', gap: 8, alignItems: 'center', width: '100%', minHeight: 34, padding: '5px 7px', overflow: 'visible', borderRadius: 'var(--ad-radius)', color: 'var(--ad-text)', fontWeight: 'var(--ad-tree-weight)', textAlign: 'left' as const },
  selectedRow: { background: 'var(--ad-selected)', color: 'var(--ad-selected-text)', boxShadow: 'none', fontWeight: 'var(--ad-tree-selected-weight)' },
  inventoryName: { color: 'inherit', fontFamily: 'var(--ad-font)', fontSize: 'var(--ad-tree-size)', fontWeight: 'inherit', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis' },
  name: { color: 'inherit', font: '600 11px var(--ad-mono)', overflow: 'hidden', textOverflow: 'ellipsis' },
  detail: { color: 'var(--ad-muted)', fontSize: 10, lineHeight: 1.4 },
  chip: { margin: '2px 3px 2px 0', fontFamily: 'var(--ad-mono)' },
  finding: { padding: '10px 12px', marginBottom: 6, border: '1px solid var(--ad-line)', borderLeft: '3px solid var(--ad-negative)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  tierBadge: { display: 'inline-flex', alignItems: 'center', justifySelf: 'end', gap: 5, padding: '3px 8px', border: '1px solid var(--ad-line)', borderRadius: 999, background: 'var(--ad-panel)', fontSize: 10, fontWeight: 600, textTransform: 'capitalize' as const },
  workspace: { display: 'grid', gridTemplateColumns: 'minmax(250px, 290px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)', flex: '1 1 0', minHeight: 0, margin: '0 -20px', gap: 0, alignItems: 'stretch', overflow: 'hidden' },
  inventory: { minWidth: 0, minHeight: 0, overflowY: 'auto' as const, overscrollBehavior: 'contain' as const, padding: '8px 6px 24px', borderRight: '1px solid var(--ad-line)' },
  inspector: { display: 'flex', flexDirection: 'column' as const, position: 'relative' as const, minWidth: 0, minHeight: 0, height: '100%', padding: 0, overflow: 'hidden' },
  componentMeta: { display: 'flex', flex: '0 0 auto', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 7, minHeight: 45, padding: '8px 12px 9px', borderBottom: '1px solid var(--ad-line)', background: 'var(--ad-canvas)' },
  componentMetaHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' },
  componentMetaActions: { display: 'inline-flex', alignItems: 'center', gap: 7 },
  advancedControl: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ad-muted)', fontSize: 10, fontWeight: 600 },
  advancedSwitch: { position: 'relative' as const, width: 28, height: 16, padding: 0, border: '1px solid var(--ad-line)', borderRadius: 999, background: 'var(--ad-panel)', cursor: 'pointer' },
  advancedSwitchKnob: { position: 'absolute' as const, top: 2, left: 2, width: 10, height: 10, borderRadius: '50%', background: 'var(--ad-muted)', transition: 'transform 120ms ease, background 120ms ease' },
  componentIdentity: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  componentMetaTitle: { color: 'var(--ad-text)', fontSize: 'var(--ad-tree-size)', fontWeight: 'var(--ad-tree-selected-weight)' },
  componentMetaDetails: { display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' as const, gap: 6, width: '100%', minHeight: 24 },
  componentMetaGroup: { display: 'flex', flex: '1 1 108px', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 4, minWidth: 108, padding: '6px 8px', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-canvas)' },
  componentMetaGroupHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 16 },
  componentMetaGroupLabel: { color: 'var(--ad-muted)', fontSize: 9, fontWeight: 700, lineHeight: '12px', letterSpacing: '.04em', textTransform: 'uppercase' as const },
  comparisonAction: { flexShrink: 0, width: 24, height: 24, margin: '-4px -4px -4px 0' },
  componentMetaValues: { display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 4, minHeight: 20 },
  componentMetaChip: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, marginRight: 3, padding: '4px 7px', borderRadius: 20, fontFamily: 'var(--ad-font)', fontSize: 10, fontWeight: 600, lineHeight: '12px', letterSpacing: 0 },
  previewFrame: { position: 'relative' as const, display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' },
  preview: { display: 'block', flex: '1 1 auto', width: '100%', height: '100%', minHeight: 0, border: 0, borderRadius: 0, background: 'var(--ad-panel)' },
  previewGallery: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignContent: 'start', gap: 10, width: '100%', height: '100%', minHeight: 0, padding: 10, boxSizing: 'border-box' as const, overflowY: 'auto' as const, overscrollBehavior: 'contain' as const, background: 'var(--ad-canvas)' },
  previewCard: { display: 'flex', flexDirection: 'column' as const, alignSelf: 'start', minWidth: 0, minHeight: 0, height: 'max-content', overflow: 'hidden', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  previewCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32, padding: '5px 8px', borderBottom: '1px solid var(--ad-line)', color: 'var(--ad-text)', fontSize: 11, fontWeight: 600 },
  previewCardFrame: { display: 'block', flex: '0 0 246px', width: '100%', height: 246, minHeight: 0, border: 0, background: 'var(--ad-panel)' },
  advancedPreview: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 282px', gridTemplateRows: 'minmax(0, 1fr)', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' },
  advancedCanvas: { position: 'relative' as const, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden' },
  factsPanel: { minWidth: 0, minHeight: 0, padding: '9px 10px', borderLeft: '1px solid var(--ad-line)', overflowY: 'auto' as const, color: 'var(--ad-text)', background: 'var(--ad-canvas)', fontFamily: 'var(--ad-mono)', fontSize: 10 },
  cardFactsPanel: { flex: '0 0 auto', padding: '8px 9px', borderTop: '1px solid var(--ad-line)', color: 'var(--ad-text)', background: 'var(--ad-canvas)', fontFamily: 'var(--ad-mono)', fontSize: 10 },
  factsHeading: { display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid var(--ad-line)', fontWeight: 700 },
  factsRow: { display: 'grid', gridTemplateColumns: '7px 68px minmax(0, 1fr)', gap: 5, alignItems: 'center', minHeight: 19 },
  factsValue: { overflow: 'hidden', color: 'var(--ad-muted)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  emptyPreview: { display: 'flex', flex: '1 1 auto', alignItems: 'center', justifyContent: 'center', minWidth: 0, minHeight: 'calc(100vh - 154px)' },
  previewAction: { position: 'absolute' as const, top: 8, right: 8, zIndex: 2, border: '1px solid var(--ad-line)', background: 'var(--ad-panel)' },
  compositionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '-14px -14px 14px', padding: '14px 16px 12px', borderBottom: '1px solid var(--ad-line)' },
  compositionTier: { marginBottom: 22 },
  compositionTierHeader: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, color: 'var(--ad-text)', fontSize: 'var(--ad-tree-size)', fontWeight: 'var(--ad-tree-selected-weight)' },
  compositionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 9 },
  compositionCard: { minWidth: 0, overflow: 'hidden', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  compositionParent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 42, padding: '7px 9px', borderBottom: '1px solid var(--ad-line)', color: 'var(--ad-text)', textAlign: 'left' as const },
  compositionIdentity: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 },
  compositionParts: { display: 'flex', flexDirection: 'column' as const, gap: 3, padding: '7px' },
  compositionPart: { display: 'grid', gridTemplateColumns: '14px 16px minmax(0, 1fr) auto', alignItems: 'center', gap: 7, width: '100%', minHeight: 32, padding: '4px 7px', color: 'var(--ad-text)', textAlign: 'left' as const },
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
  '--ad-foundation': theme.base === 'dark' ? '#ef9ab7' : '#c94f79',
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
const round = (value: number) => Math.round(value * 10) / 10;
const pseudoStateKeys: Record<string, string> = { hover: 'hover', active: 'active', pressed: 'active', click: 'active', focus: 'focus', 'focus-visible': 'focusVisible', 'focus-within': 'focusWithin' };
const implementationLabel = (implementation: DesignStoryImplementation) => implementation.label ?? implementation.platform ?? displayName(implementation.id);
const metadataChips = (values: readonly string[], _group: string, selected?: string, onSelect?: (value: string) => void, canSelect: (value: string) => boolean = () => true, labelOf: (value: string) => string = displayName) => values.map((value) => {
  const active = selected === value;
  const interactive = Boolean(onSelect && canSelect(value));
  const color = active ? 'var(--ad-accent)' : 'var(--ad-muted)';
  const style = { ...styles.componentMetaChip, color, background: active ? 'color-mix(in srgb, var(--ad-accent) 18%, transparent)' : 'transparent', boxShadow: `inset 0 0 0 1px ${active ? 'color-mix(in srgb, var(--ad-accent) 55%, transparent)' : 'var(--ad-line)'}`, ...(interactive ? { border: 0, cursor: 'pointer' } : {}) };
  return interactive
    ? element('button', { key: value, type: 'button', style, 'aria-pressed': active, onClick: () => onSelect?.(value) }, labelOf(value))
    : element('span', { key: value, style }, labelOf(value));
});
const argsQuery = (args: Record<string, string | number | boolean | null>) => Object.entries(args).map(([key, value]) => `${key}:${String(value)}`).join(';');
const tierBadge = (tier: Tier, compact = false) => {
  const TierIcon = tierIcons[tier];
  const iconSize = compact ? tier === 'atom' ? 12 : 11 : undefined;
  return element('span', { style: { ...styles.tierBadge, ...(compact ? { gap: 3, padding: '2px 6px', fontSize: 9 } : {}) } },
    element(TierIcon, { style: { ...(tier === 'atom' ? styles.atomIcon : styles.treeIcon), ...(iconSize ? { width: iconSize, height: iconSize } : {}), color: tierColors[tier] } }),
    element('span', null, tier),
  );
};

function InspectionFacts({ facts, compact = false }: { facts: AdvancedInspection[] | undefined; compact?: boolean }) {
  const fact = facts?.[0];
  if (!fact) return element('div', { className: compact ? undefined : 'assay-scrollbar', style: compact ? styles.cardFactsPanel : styles.factsPanel }, element('span', { style: styles.detail }, 'Waiting for rendered evidence…'));
  const partFacts = facts?.filter((item) => item.layer === 'part') ?? [];
  const headingStyle = { ...styles.factsHeading, margin: `0 -${compact ? 9 : 10}px 5px`, padding: `0 ${compact ? 9 : 10}px 5px` };
  const rows: [string, string, string][] = [
    ['Box', `${round(fact.size[0])} × ${round(fact.size[1])}`, 'var(--ad-accent)'],
    ['Padding', `T${fact.padding[0]} R${fact.padding[1]} B${fact.padding[2]} L${fact.padding[3]}`, 'var(--ad-warning)'],
    ['Content', `${round(fact.content[0])} × ${round(fact.content[1])}`, 'var(--ad-positive)'],
    ...(fact.slots.length ? [['Slots', fact.slots.filter(Boolean).join(', '), 'var(--ad-agentic)'] as [string, string, string]] : []),
    ...(fact.text ? [['Label', `“${fact.text.value}” · ${round(fact.text.width)} × ${round(fact.text.height)}`, 'var(--ad-agentic)'] as [string, string, string]] : []),
    ['Type', `${fact.font[1]} / ${fact.font[2]} · ${fact.font[3]}`, 'var(--ad-agentic)'],
    ['Radius', `${fact.radius}${fact.tokenMatches.radius ? ` · ${fact.tokenMatches.radius}` : ''}`, 'var(--ad-muted)'],
    ['Foreground', `${fact.colors.foreground.value}${fact.colors.foreground.token ? ` · ${fact.colors.foreground.token}` : ''}`, fact.colors.foreground.value],
    ['Background', `${fact.colors.background.value}${fact.colors.background.token ? ` · ${fact.colors.background.token}` : ''}`, fact.colors.background.value],
    ...(fact.colors.border ? [['Border', `${fact.colors.border.value}${fact.colors.border.token ? ` · ${fact.colors.border.token}` : ''}`, fact.colors.border.value] as [string, string, string]] : []),
  ];
  return element('div', { className: compact ? undefined : 'assay-scrollbar', style: compact ? styles.cardFactsPanel : styles.factsPanel },
    element('div', { style: headingStyle }, element('span', null, displayName(fact.component)), element('span', { style: { color: fact.raw.length ? 'var(--ad-warning)' : 'var(--ad-positive)' } }, fact.raw.length ? `${fact.raw.length} raw` : 'token aligned')),
    ...rows.map(([label, value, color]) => element('div', { key: label, style: styles.factsRow }, element('span', { style: { width: 6, height: 6, borderRadius: 2, background: color, boxShadow: 'inset 0 0 0 1px var(--ad-line)' } }), element('span', null, label), element('span', { style: styles.factsValue, title: value }, value))),
    ...(partFacts.length ? [element('div', { key: 'parts', style: { marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--ad-line)' } }, element('div', { style: { marginBottom: 4, color: 'var(--ad-muted)', fontWeight: 700 } }, 'Declared parts'), ...partFacts.map((part, index) => element('div', { key: `${part.component}-${index}`, style: styles.factsRow }, element('span', { style: { width: 6, height: 6, borderRadius: 2, background: part.color } }), element('span', null, displayName(part.component)), element('span', { style: styles.factsValue }, `${round(part.size[0])} × ${round(part.size[1])}`))))] : []),
  );
}

function VisualInspector({ payload, name, storyId, onSelectStory, onSelect }: { payload: DesignPanelPayload; name: string; storyId?: string; onSelectStory(id: string): void; onSelect(name: string): void }) {
  const [globals, updateGlobals] = useGlobals();
  const dark = globals.theme === 'dark';
  const [selections, setSelections] = React.useState<Record<string, Record<string, string>>>({});
  const [comparisonModes, setComparisonModes] = React.useState<Record<string, string>>({});
  const [advanced, setAdvanced] = React.useState(false);
  const [inspections, setInspections] = React.useState<Record<string, AdvancedInspection[]>>({});
  const inspectorRef = React.useRef<HTMLElement>(null);
  const theme = useTheme() as StorybookTheme;
  const inspectionPalette = { accent: theme.fgColor.accent, agentic: theme.fgColor.agentic, positive: theme.fgColor.positive, warning: theme.fgColor.warning, panel: theme.background.app, text: theme.fgColor.default, muted: theme.fgColor.muted };
  const syncFrame = (frame: HTMLIFrameElement) => {
    const key = frame.dataset.inspectionKey ?? '$single';
    const parts = payload.contract.components.find((component) => component.name === name)?.parts ?? [];
    projectAdvancedInspection(frame, name, advanced, payload.contract.tokens, inspectionPalette, (facts) => setInspections((current) => JSON.stringify(current[key]) === JSON.stringify(facts) ? current : { ...current, [key]: facts }), payload.contract.tokenMeta ?? {}, parts);
  };
  React.useEffect(() => { inspectorRef.current?.querySelectorAll('iframe').forEach(syncFrame); }, [advanced, name, payload.contract.tokens]);
  const foundation = selectedFoundation(name);
  const foundationGroup = foundation ? foundationGroups(payload.contract).find((group) => group.id === foundation) : undefined;
  if (foundationGroup) return element('aside', { ref: inspectorRef, style: styles.inspector }, element(FoundationPreview, { group: foundationGroup }));
  if (foundation) return element('aside', { ref: inspectorRef, style: styles.inspector }, element(EmptyTabContent, { title: 'Foundation is not available in this contract' }));
  if (name === COMPOSITION_VIEW) return element('aside', { ref: inspectorRef, className: 'assay-scrollbar', style: { ...styles.inspector, padding: 14, overflowY: 'auto' } }, element(Composition, { payload, onSelect }));
  const page = selectedPage(name);
  if (page) {
    const pageImplementation = implementationsOf(payload.pages?.[page])[0];
    const story = pageImplementation?.id;
    const pageLabel = pageImplementation?.label ?? displayName(page);
    const globals = `theme:${dark ? 'dark' : 'light'}`;
    return element('aside', { ref: inspectorRef, style: styles.inspector },
      element('div', { style: styles.componentMeta }, element('span', { style: styles.componentMetaHeading },
        element('span', { style: styles.componentIdentity }, element('span', { style: styles.tierBadge }, element(BrowserIcon, { style: { ...styles.treeIcon, color: 'var(--ad-story)' } }), 'Page'), element('span', { style: styles.componentMetaTitle }, pageLabel)),
        element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', active: dark, ariaLabel: dark ? 'Use light mode' : 'Use dark mode', title: dark ? 'Use light mode' : 'Use dark mode', onClick: () => updateGlobals({ theme: dark ? 'light' : 'dark' }), style: styles.comparisonAction }, dark ? element(SunIcon) : element(MoonIcon)),
      )),
      story ? element('iframe', { title: `${page} page`, src: `iframe.html?id=${encodeURIComponent(story)}&viewMode=story&shortcuts=false&globals=${encodeURIComponent(globals)}`, scrolling: 'auto', style: styles.preview }) : element('div', { style: styles.emptyPreview }, element(EmptyTabContent, { title: 'No page story mapped' })),
    );
  }
  const component = payload.contract.components.find((item) => item.name === name);
  const canonicalImplementations = implementationsOf(payload.stories[name]);
  const implementations = canonicalImplementations.length ? canonicalImplementations : pageBackedImplementations(payload, name);
  const implementation = implementations.find((item) => item.id === storyId) ?? implementations[0];
  if (!component) return element('aside', { ref: inspectorRef, style: styles.inspector }, element(EmptyTabContent, { title: 'Select a declared component' }));
  const widths = component.inlineSizing ? [component.inlineSizing, ...(component.allowFullWidth && component.inlineSizing !== 'full' ? ['full'] : [])] : [];
  const groups: [string, readonly string[]][] = [['parts', component.parts], ['variants', component.variants], ['appearances', component.appearances], ['states', component.states], ['widths', widths], ['slots', component.requiredSlots]];
  const visibleGroups = groups.filter(([, values]) => values.length);
  const groupValues = new Map(groups);
  const componentSelections = selections[name] ?? {};
  const controls = implementation?.controls ?? payload.controls?.[name] ?? {};
  const mode = comparisonModes[name] ?? '';
  const toggleMode = (next: string) => setComparisonModes((current) => ({ ...current, [name]: current[name] === next ? '' : next }));
  const choose = (group: string, value: string) => {
    setComparisonModes((current) => ({ ...current, [name]: '' }));
    setSelections((current) => ({ ...current, [name]: { ...current[name], [group]: value } }));
  };
  const selectImplementation = (id: string) => { setComparisonModes((current) => ({ ...current, [name]: '' })); onSelectStory(id); };
  const canSelect = (sourceControls: typeof controls, group: string, value: string) => Boolean(sourceControls[group]?.[value] || group === 'states' && pseudoStateKeys[value]);
  const renderable = (group: string, values: readonly string[]) => values.filter((value) => canSelect(controls, group, value));
  const previewOf = (target = implementation, override: Record<string, string> = {}) => {
    const targetControls = target?.controls ?? payload.controls?.[name] ?? {};
    const selected = { ...componentSelections, ...override };
    const args = Object.assign({}, ...Object.entries(targetControls).map(([group, values]) => values?.[selected[group] ?? groupValues.get(group)?.[0] ?? ''] ?? {}));
    const query = argsQuery(args);
    const pseudoState = pseudoStateKeys[selected.states ?? component.states[0] ?? ''];
    const globals = [`theme:${dark ? 'dark' : 'light'}`, pseudoState ? `pseudo.${pseudoState}:!true` : ''].filter(Boolean).join(';');
    const story = target?.id;
    return { story, query, globals, source: story ? `iframe.html?id=${encodeURIComponent(story)}&viewMode=story&shortcuts=false${query ? `&args=${encodeURIComponent(query)}` : ''}${globals ? `&globals=${encodeURIComponent(globals)}` : ''}` : '' };
  };
  const currentPreview = previewOf();
  const comparableGroups = visibleGroups.map(([label, values]) => [label, renderable(label, values)] as const).filter(([, values]) => values.length > 1);
  const hasOverview = implementations.length > 1 || comparableGroups.length > 0;
  const comparisonFrames = mode === 'implementations'
    ? implementations.map((item) => ({ key: `implementation:${item.id}`, label: implementationLabel(item), ...previewOf(item) }))
    : mode === '$all'
      ? [
          ...implementations.flatMap((item) => implementations.length > 1 ? [{ key: `implementation:${item.id}`, label: `Implementation · ${implementationLabel(item)}`, ...previewOf(item) }] : []),
          ...comparableGroups.flatMap(([group, values]) => values.map((value) => ({ key: `${group}:${value}`, label: `${displayName(group)} · ${displayName(value)}`, ...previewOf(implementation, { [group]: value }) }))),
        ]
      : comparableGroups.flatMap(([group, values]) => group === mode ? values.map((value) => ({ key: `${group}:${value}`, label: displayName(value), ...previewOf(implementation, { [group]: value }) })) : []);
  return element('aside', { ref: inspectorRef, style: styles.inspector },
    element('div', { style: styles.componentMeta },
      element('span', { style: styles.componentMetaHeading },
        element('span', { style: styles.componentIdentity }, tierBadge(component.tier, true), element('span', { style: styles.componentMetaTitle }, displayName(component.name))),
        element('span', { style: styles.componentMetaActions },
          element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', active: dark, ariaLabel: dark ? 'Use light mode' : 'Use dark mode', title: dark ? 'Use light mode' : 'Use dark mode', onClick: () => updateGlobals({ theme: dark ? 'light' : 'dark' }), style: styles.comparisonAction }, dark ? element(SunIcon) : element(MoonIcon)),
          element('span', { style: styles.advancedControl }, element('span', null, 'Advanced'), element('button', { type: 'button', role: 'switch', 'aria-checked': advanced, title: advanced ? 'Disable advanced inspection' : 'Enable advanced inspection', onClick: () => setAdvanced((value) => !value), style: { ...styles.advancedSwitch, ...(advanced ? { background: 'var(--ad-accent)', borderColor: 'var(--ad-accent)' } : {}) } }, element('span', { style: { ...styles.advancedSwitchKnob, ...(advanced ? { background: 'var(--ad-selected-text)', transform: 'translateX(12px)' } : {}) } }))),
          hasOverview ? element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', active: mode === '$all', ariaLabel: mode === '$all' ? 'Return to single preview' : 'Show all comparisons', title: mode === '$all' ? 'Single preview' : 'Show all comparisons', onClick: () => toggleMode('$all'), style: styles.comparisonAction }, element(GridAltIcon)) : null,
        ),
      ),
      implementations.length > 1 || visibleGroups.length ? element('span', { style: styles.componentMetaDetails },
        ...(implementations.length > 1 ? [element('span', { key: 'implementations', style: styles.componentMetaGroup },
          element('span', { style: styles.componentMetaGroupHeader }, element('span', { style: styles.componentMetaGroupLabel }, 'Implementations'), element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', active: mode === 'implementations', ariaLabel: mode === 'implementations' ? 'Return to single implementation' : 'Compare all implementations', title: mode === 'implementations' ? 'Single implementation' : 'Compare all implementations', onClick: () => toggleMode('implementations'), style: styles.comparisonAction }, element(SideBySideIcon))),
          element('span', { style: styles.componentMetaValues }, ...metadataChips(implementations.map((item) => item.id), 'implementations', implementation?.id, selectImplementation, () => true, (id) => implementationLabel(implementations.find((item) => item.id === id)!))),
        )] : []),
        ...visibleGroups.map(([label, values]) => {
        const selectableValues = renderable(label, values);
        const navigates = label === 'parts';
        const interactive = navigates || selectableValues.length > 0;
        const selected = interactive ? componentSelections[label] ?? values[0] : undefined;
        const groupStyle = { ...styles.componentMetaGroup, ...(label === 'states' ? { flex: '3 1 360px' } : label === 'variants' ? { flex: '2 1 260px' } : {}) };
        return element('span', { key: label, style: groupStyle },
          element('span', { style: styles.componentMetaGroupHeader }, element('span', { style: styles.componentMetaGroupLabel }, displayName(label)), !navigates && selectableValues.length > 1 ? element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', active: mode === label, ariaLabel: mode === label ? `Return to one ${label}` : `Compare all ${label}`, title: mode === label ? 'Single preview' : `Compare all ${label}`, onClick: () => toggleMode(label), style: styles.comparisonAction }, element(SideBySideIcon)) : null),
          element('span', { style: styles.componentMetaValues }, ...metadataChips(values, label, navigates ? undefined : selected, interactive ? (value) => navigates ? onSelect(value) : choose(label, value) : undefined, navigates ? () => true : (value) => canSelect(controls, label, value))),
        );
      })) : null,
    ),
    element('div', { style: styles.previewFrame },
      comparisonFrames.length
        ? element('div', { className: 'assay-scrollbar', style: styles.previewGallery }, ...comparisonFrames.map((frame) => element('article', { key: frame.key, style: styles.previewCard },
          element('header', { style: styles.previewCardHeader }, element('span', null, frame.label), frame.story ? element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', ariaLabel: 'Open in canvas', asChild: true }, element('a', { href: `?path=/story/${encodeURIComponent(frame.story)}${frame.query ? `&args=${encodeURIComponent(frame.query)}` : ''}${frame.globals ? `&globals=${encodeURIComponent(frame.globals)}` : ''}`, target: '_top', title: 'Open in canvas' }, element(ExpandAltIcon))) : null),
          frame.source ? element('iframe', { title: `${component.name} ${frame.label}`, src: frame.source, loading: 'lazy', scrolling: 'auto', 'data-inspection-key': frame.key, onLoad: (event: React.SyntheticEvent<HTMLIFrameElement>) => syncFrame(event.currentTarget), style: styles.previewCardFrame }) : null,
          advanced ? element(InspectionFacts, { facts: inspections[frame.key], compact: true }) : null,
        )))
        : currentPreview.story
          ? advanced
            ? element('div', { style: styles.advancedPreview },
              element('div', { style: styles.advancedCanvas },
                element('iframe', { title: `${component.name} canonical story`, src: currentPreview.source, scrolling: 'auto', 'data-inspection-key': '$single', onLoad: (event: React.SyntheticEvent<HTMLIFrameElement>) => syncFrame(event.currentTarget), style: styles.preview }),
                element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', ariaLabel: 'Open in canvas', asChild: true, style: styles.previewAction }, element('a', { href: `?path=/story/${encodeURIComponent(currentPreview.story)}${currentPreview.query ? `&args=${encodeURIComponent(currentPreview.query)}` : ''}${currentPreview.globals ? `&globals=${encodeURIComponent(currentPreview.globals)}` : ''}`, target: '_top', title: 'Open in canvas' }, element(ExpandAltIcon))),
              ),
              element(InspectionFacts, { facts: inspections.$single }),
            )
            : element('iframe', { title: `${component.name} canonical story`, src: currentPreview.source, scrolling: 'auto', 'data-inspection-key': '$single', onLoad: (event: React.SyntheticEvent<HTMLIFrameElement>) => syncFrame(event.currentTarget), style: styles.preview })
        : element('div', { style: styles.emptyPreview }, element(EmptyTabContent, { title: 'No canonical story mapped', description: 'Map the component to a Storybook story to inspect its rendered implementation.' })),
      !comparisonFrames.length && currentPreview.story && !advanced ? element(IconButton, { variant: 'ghost', size: 'small', padding: 'small', ariaLabel: 'Open in canvas', asChild: true, style: styles.previewAction }, element('a', { href: `?path=/story/${encodeURIComponent(currentPreview.story)}${currentPreview.query ? `&args=${encodeURIComponent(currentPreview.query)}` : ''}${currentPreview.globals ? `&globals=${encodeURIComponent(currentPreview.globals)}` : ''}`, target: '_top', title: 'Open in canvas' }, element(ExpandAltIcon))) : null,
    ),
  );
}

function Composition({ payload, onSelect }: { payload: DesignPanelPayload; onSelect(name: string): void }) {
  const parents = payload.contract.components.filter((component) => component.parts.length);
  const components = new Map(payload.contract.components.map((component) => [component.name, component]));
  const observed = new Map<string, number>();
  for (const node of payload.evidence.nodes) observed.set(node.component, (observed.get(node.component) ?? 0) + 1);
  const compositionTiers: Tier[] = ['molecule', 'organism', 'template'];
  return element('div', null,
    element('header', { style: styles.compositionHeader }, element('h2', { style: { margin: 0, color: 'var(--ad-text)', fontSize: 16, fontWeight: 700 } }, 'Composition'), element(Badge, { compact: true, status: 'neutral' }, `${parents.reduce((sum, item) => sum + item.parts.length, 0)} direct relationships`)),
    ...(parents.length ? compositionTiers.flatMap((tier) => {
      const members = parents.filter((component) => component.tier === tier);
      if (!members.length) return [];
      const TierIcon = tierIcons[tier];
      return [element('section', { key: tier, style: styles.compositionTier },
        element('div', { style: styles.compositionTierHeader }, element(TierIcon, { style: { ...(tier === 'atom' ? styles.atomIcon : styles.treeIcon), color: tierColors[tier] } }), element('span', null, `${displayName(tier)}s`), element(Badge, { compact: true, status: 'neutral' }, members.length)),
        element('div', { style: styles.compositionGrid }, ...members.map((component) => element('article', { key: component.name, style: styles.compositionCard },
          element(Button, { variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, onClick: () => onSelect(component.name), style: styles.compositionParent },
            element('span', { style: styles.compositionIdentity }, element(TierIcon, { style: { ...styles.treeIcon, color: tierColors[tier] } }), element('span', { style: styles.inventoryName }, displayName(component.name))),
            element('span', { style: { display: 'flex', alignItems: 'center', gap: 5 } }, observed.get(component.name) ? element(Badge, { compact: true, status: 'positive' }, `${observed.get(component.name)} observed`) : null, element(Badge, { compact: true, status: 'neutral' }, `${component.parts.length} parts`)),
          ),
          element('div', { style: styles.compositionParts }, ...component.parts.map((part) => {
            const child = components.get(part);
            const childTier = child?.tier ?? 'atom';
            const ChildIcon = tierIcons[childTier];
            return element(Button, { key: part, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, onClick: () => onSelect(part), title: `Inspect ${displayName(part)}`, style: styles.compositionPart },
              element(ArrowRightIcon, { style: { ...styles.treeIcon, color: 'var(--ad-muted)' } }),
              element(ChildIcon, { style: { ...styles.treeIcon, color: tierColors[childTier] } }),
              element('span', { style: styles.inventoryName }, displayName(part)),
              element('span', { style: { color: 'var(--ad-muted)', fontSize: 9, textTransform: 'capitalize' } }, childTier),
            );
          })),
        ))),
      )];
    }) : [element(EmptyTabContent, { key: 'empty', title: 'No component composition declared' })]),
  );
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
  const mapped = React.useMemo(() => mappedComponentNames(payload), [payload]);
  const inspectable = React.useMemo(() => inspectableComponentNames(payload), [payload]);
  const foundations = React.useMemo(() => foundationGroups(payload.contract), [payload]);
  const pageEntries = React.useMemo(() => mappedPages(payload), [payload]);
  const mappedPageNames = React.useMemo(() => new Set(pageEntries.map((page) => page.name)), [pageEntries]);
  const firstInspectable = payload.contract.components.find((component) => inspectable.has(component.name))?.name ?? (foundations[0] ? foundationSelection(foundations[0].id) : pageEntries[0] ? pageSelection(pageEntries[0].name) : COMPOSITION_VIEW);
  const activeComponent = Object.entries(payload.stories).find(([, story]) => implementationsOf(story).some((implementation) => implementation.id === storyId))?.[0];
  const activePage = Object.entries(payload.pages ?? {}).find(([, story]) => implementationsOf(story).some((implementation) => implementation.id === storyId))?.[0];
  const activeSelection = activeComponent ?? (activePage ? pageSelection(activePage) : undefined);
  const [selected, setSelected] = React.useState(() => activeSelection ?? firstInspectable);
  React.useEffect(() => {
    if (storyId && !activeSelection) api.selectStory(storyId, undefined, { viewMode: 'story' });
  }, [activeSelection, api, storyId]);
  React.useEffect(() => {
    setSelected((current) => {
      const valid = current === COMPOSITION_VIEW || Boolean(selectedFoundation(current)) || inspectable.has(current) || Boolean(selectedPage(current) && mappedPageNames.has(selectedPage(current)!));
      if (activeSelection && !selectionOwnsStory(payload, current, storyId)) return activeSelection;
      return valid ? current : firstInspectable;
    });
  }, [activeSelection, firstInspectable, inspectable, mappedPageNames, payload, storyId]);
  const selectComponent = (name: string) => {
    setSelected(name);
    const story = implementationsForSelection(payload, name)[0]?.id;
    if (story && story !== storyId) api.selectStory(story);
  };
  const passing = payload.outcome === 'pass';
  const findings = findingsOf(payload);
  const missingStories = payload.contract.components.length - mapped.size;
  const tabs: [Tab, string, number][] = [
    ['inventory', 'Atomic View', inspectable.size + foundations.length + pageEntries.length],
    ['coverage', 'Coverage', missingStories],
    ['violations', 'Violations', findings.length],
  ];
  const content = tab === 'inventory'
    ? element('div', { style: styles.workspace }, element('div', { className: 'assay-scrollbar', style: styles.inventory }, element(AtomicNavigation, { payload, selected, onSelect: selectComponent })), element(VisualInspector, { payload, name: selected, storyId, onSelectStory: (id) => api.selectStory(id), onSelect: selectComponent }))
    : element('div', { className: 'assay-scrollbar', style: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } }, tab === 'coverage' ? element(CoverageView, { payload, onSelect: selectComponent }) : element('div', { style: { padding: '14px 0 24px' } }, element(Violations, { payload })));
  return element('div', { style: { ...styles.root, ...themeVariables(theme as StorybookTheme) } },
    element('style', null, scrollbarCss),
    element('header', { style: styles.header },
      element('div', { style: styles.title }, payload.contract.name),
      element(Badge, { status: passing ? 'positive' : 'negative' }, passing ? 'PASS' : 'FAIL'),
    ),
    element('nav', { style: styles.tabs }, ...tabs.map(([id, label, count]) => element(TabButton, { key: id, active: tab === id, onClick: () => setTab(id), style: { gap: 6 }, children: [label, element(Badge, { key: 'count', compact: true, status: (id === 'violations' || id === 'coverage') && count ? 'negative' : 'neutral' }, count)] }))),
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
