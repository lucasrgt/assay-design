import React from 'react';
import { BookmarkHollowIcon, BrowserIcon, ChevronSmallDownIcon, ChevronSmallRightIcon, ComponentIcon, DocumentIcon, FolderIcon, GridIcon, MergeIcon, PaintBrushIcon, SearchIcon } from '@storybook/icons';
import { Button, EmptyTabContent } from 'storybook/internal/components';
import { foundationGroups, foundationSelection } from './foundations.js';
import { compositionFolders, effectiveGroups, groupedFoundations } from './grouping.js';
import { COMPOSITION_VIEW, displayName, inspectableComponentNames, pageHierarchy, pageSelection, type DesignPageFolder, navigationMatches } from './atomic-navigation-model.js';
import type { DesignPanelPayload } from './shared.js';

const element = React.createElement;
const tiers = ['atom', 'molecule', 'organism', 'template'] as const;
export const AtomIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => element('svg', {
  ...props, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
},
  element('circle', { cx: 12, cy: 12, r: 1.35, fill: 'currentColor', stroke: 'none' }),
  element('path', { d: 'M20.2 20.2c2.04-2.03.02-7.32-4.5-11.8C11.2 3.9 5.91 1.88 3.88 3.9c-2.03 2.04-.02 7.33 4.5 11.85 4.5 4.5 9.8 6.52 11.82 4.45Z' }),
  element('path', { d: 'M15.7 15.7c4.52-4.51 6.54-9.8 4.5-11.8-2.03-2.04-7.32-.02-11.8 4.5C3.9 12.9 1.88 18.19 3.9 20.22c2.04 2.03 7.33.01 11.8-4.52Z' }),
);
const tierIcons = { atom: AtomIcon, molecule: ComponentIcon, organism: GridIcon, template: DocumentIcon };
const tierColors = { atom: 'var(--ad-agentic)', molecule: 'var(--ad-accent)', organism: 'var(--ad-positive)', template: 'var(--ad-warning)' };
const css = {
  search: { display: 'flex', alignItems: 'center', gap: 7, height: 32, margin: '0 6px 10px', padding: '0 9px', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-canvas)' },
  searchInput: { flex: 1, minWidth: 0, padding: 0, border: 0, outline: 0, color: 'var(--ad-text)', background: 'transparent', font: 'var(--ad-tree-weight) var(--ad-tree-size) var(--ad-font)' },
  section: { marginBottom: 6 }, group: { display: 'grid', gridTemplateColumns: '14px 17px minmax(0, 1fr)', gap: 7, width: '100%', padding: '0 6px', color: 'var(--ad-text)', textAlign: 'left' as const },
  groupLabel: { overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--ad-tree-size)', fontWeight: 'var(--ad-tree-weight)' },
  children: { marginLeft: 39 }, folderChildren: { marginLeft: 20 }, icon: { width: 14, height: 14, flexShrink: 0 }, atomIcon: { width: 17, height: 17, flexShrink: 0 },
  row: { display: 'grid', gridTemplateColumns: '17px minmax(0, 1fr)', gap: 8, alignItems: 'center', width: '100%', minHeight: 34, padding: '5px 7px', borderRadius: 'var(--ad-radius)', color: 'var(--ad-text)', fontWeight: 'var(--ad-tree-weight)', textAlign: 'left' as const },
  selected: { background: 'var(--ad-selected)', color: 'var(--ad-selected-text)', fontWeight: 'var(--ad-tree-selected-weight)' },
  name: { color: 'inherit', fontFamily: 'var(--ad-font)', fontSize: 'var(--ad-tree-size)', fontWeight: 'inherit', lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis' },
};

export function AtomicNavigation({ payload, selected, onSelect }: { payload: DesignPanelPayload; selected: string; onSelect(name: string): void }) {
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const normalized = query.trim().toLocaleLowerCase();
  const groups = effectiveGroups(payload);
  const foundationFolders = groupedFoundations(payload.contract, groups).map((folder) => ({ ...folder, foundations: folder.foundations.filter((foundation) => navigationMatches(normalized, folder.label, foundation.label, foundation.id, ...foundation.tokens.map((token) => token.name))) })).filter((folder) => folder.foundations.length);
  const foundations = foundationFolders.length ? [] : foundationGroups(payload.contract).filter((foundation) => navigationMatches(normalized, foundation.label, foundation.id));
  const mapped = inspectableComponentNames(payload);
  const pages = pageHierarchy(payload, normalized);
  const toggle = (key: string) => setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  const isCollapsed = (key: string) => !normalized && Boolean(collapsed[key]);
  const group = (key: string, label: string, Icon: React.ComponentType<any>, color: string, children: React.ReactNode, depth = 0) => element('section', { key, style: css.section },
    element(Button, { variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, 'aria-expanded': !isCollapsed(key), onClick: () => toggle(key), style: { ...css.group, ...(depth ? { paddingLeft: 6 + depth * 7 } : {}) }, children: [
      element(isCollapsed(key) ? ChevronSmallRightIcon : ChevronSmallDownIcon, { key: 'chevron', style: { ...css.icon, color: 'var(--ad-muted)' } }),
      element(Icon, { key: 'icon', style: { ...(key === 'atom' ? css.atomIcon : css.icon), color } }),
      element('span', { key: 'label', style: css.groupLabel }, label),
    ] }), isCollapsed(key) ? null : children);
  const row = (key: string, label: string, selection: string, depth = 0, ItemIcon: React.ComponentType<any> = BookmarkHollowIcon, iconColor = 'var(--ad-story)') => element(Button, { key, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, active: selected === selection, onClick: () => onSelect(selection), style: { ...css.row, ...(depth ? { paddingLeft: 7 + depth * 9 } : {}), ...(selected === selection ? css.selected : {}) } },
    element(ItemIcon, { style: { ...css.icon, ...(selected === selection ? {} : { color: iconColor }) } }), element('span', { style: css.name, title: label }, label));
  const renderFolder = (folder: DesignPageFolder, depth = 0): React.ReactNode => element(React.Fragment, { key: folder.key || '$pages' },
    ...folder.folders.map((child) => group(`folder:${child.key}`, child.name, FolderIcon, 'var(--ad-muted)', element('div', { style: css.folderChildren }, renderFolder(child, depth + 1)), depth)),
    ...folder.pages.map((page) => row(page.name, page.label, pageSelection(page.name), depth)));
  const renderTierGroups = (members = payload.contract.components) => tiers.flatMap((tier) => {
    const components = members.filter((component) => component.tier === tier && mapped.has(component.name) && navigationMatches(normalized, displayName(component.name), component.name));
    return components.length ? [group(tier, `${tier[0]!.toUpperCase()}${tier.slice(1)}s`, tierIcons[tier], tierColors[tier], element('div', { style: css.children }, ...components.map((component) => row(component.name, displayName(component.name), component.name))))] : [];
  });
  const folders = compositionFolders(payload.contract.components, groups).map((folder) => ({ ...folder, components: folder.components.filter((component) => mapped.has(component.name) && navigationMatches(normalized, folder.label, displayName(component.name), component.name)) })).filter((folder) => folder.components.length);
  const componentGroups = folders.length ? [] : renderTierGroups();
  const composition = folders.length
    ? group('$composition', 'Composition', MergeIcon, 'var(--ad-muted)', element('div', { style: css.folderChildren },
      navigationMatches(normalized, 'composition overview') ? row('$composition-overview', 'Overview', COMPOSITION_VIEW, 0, MergeIcon, 'var(--ad-muted)') : null,
      ...folders.map((folder) => group(`composition:${folder.label}`, folder.label, FolderIcon, 'var(--ad-muted)', element('div', { style: css.folderChildren }, ...renderTierGroups(folder.components)))),
    ))
    : navigationMatches(normalized, 'composition') ? row('$composition', 'Composition', COMPOSITION_VIEW, 0, MergeIcon, 'var(--ad-muted)') : null;
  const foundationNavigation = foundationFolders.length
    ? group('$foundations', 'Foundations', PaintBrushIcon, 'var(--ad-foundation)',
      element('div', { style: css.folderChildren }, ...foundationFolders.map((folder) =>
        group(`foundation:${folder.label}`, folder.label, FolderIcon, 'var(--ad-muted)',
          element('div', { style: css.folderChildren }, ...folder.foundations.map((foundation) =>
            row(foundation.selectionKey, foundation.label, foundationSelection(foundation.selectionKey), 0, BookmarkHollowIcon, 'var(--ad-foundation)')))))))
    : foundations.length ? group('$foundations', 'Foundations', PaintBrushIcon, 'var(--ad-foundation)', element('div', { style: css.children }, ...foundations.map((foundation) => row(foundation.id, foundation.label, foundationSelection(foundation.id), 0, BookmarkHollowIcon, 'var(--ad-foundation)')))) : null;
  const hasResults = foundationFolders.length || foundations.length || componentGroups.length || folders.length || Boolean(pages?.folders.length || pages?.pages.length) || navigationMatches(normalized, 'composition');
  return element(React.Fragment, null,
    element('label', { style: css.search }, element(SearchIcon, { style: { ...css.icon, color: 'var(--ad-muted)' } }), element('input', { value: query, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value), placeholder: 'Find design items', 'aria-label': 'Find design items', style: css.searchInput })),
    composition,
    foundationNavigation,
    ...componentGroups,
    pages && (pages.folders.length || pages.pages.length) ? group('$pages', 'Pages', BrowserIcon, 'var(--ad-story)', element('div', { style: css.children }, renderFolder(pages))) : null,
    !hasResults ? element(EmptyTabContent, { title: 'No design items found', description: `No Atomic View items match “${query.trim()}”.` }) : null,
  );
}
