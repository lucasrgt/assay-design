import { describe, expect, it } from 'vitest';
import { canonicalSelection, controlArgs, displayName, implementationMatrixFindings, implementationsForSelection, implementationsOf, inspectableComponentNames, mappedComponentNames, mappedPages, navigationMatches, pageHierarchy, pageSelection, partSelection, selectedPage, selectedPart, selectionOwnsStory } from '../src/storybook/atomic-navigation-model.js';
import type { DesignPanelPayload } from '../src/storybook/shared.js';
import { contract, evidence } from './fixtures.js';

const payload = (): DesignPanelPayload => ({
  outcome: 'pass',
  results: [],
  contract: { ...contract(), surfaces: [...contract().surfaces, { name: 'settings', template: 'screen', requiredComponents: [], requiredStates: [], requiredThemes: [], requiredViewports: [], requiredLocales: [] }] },
  evidence: evidence(),
  implementationPlatforms: [{ id: 'web', label: 'DOM' }, { id: 'react-native-web', label: 'React Native Web' }],
  stories: {},
  pages: {
    dashboard: { id: 'pages-dashboard--default', label: 'Overview', path: 'Traveler/Home' },
    settings: { id: 'pages-settings--default', path: ['Account', 'Preferences'] },
  },
} as unknown as DesignPanelPayload);

describe('Atomic View navigation', () => {
  it('normalizes page labels and nested folder paths without breaking string mappings', () => {
    const pages = mappedPages(payload());
    expect(pages).toContainEqual({ name: 'dashboard', label: 'Overview', path: ['Traveler', 'Home'] });
    expect(pages).toContainEqual({ name: 'settings', label: 'Settings', path: ['Account', 'Preferences'] });
    expect(pageHierarchy(payload())?.folders.map((folder) => folder.name)).toEqual(['Traveler', 'Account']);
  });

  it('keeps folder ancestry when search matches a nested page', () => {
    const tree = pageHierarchy(payload(), 'overview');
    expect(tree?.folders[0]?.name).toBe('Traveler');
    expect(tree?.folders[0]?.folders[0]?.pages[0]?.label).toBe('Overview');
    expect(tree?.folders.some((folder) => folder.name === 'Account')).toBe(false);
  });

  it('supports legacy references, selections, labels, and folder-name searches', () => {
    expect(implementationsOf()).toEqual([]);
    expect(implementationsOf('story--default')).toEqual([{ id: 'story--default', label: 'Canonical' }]);
    expect(implementationsOf([{ id: 'one' }, { id: 'two' }])).toHaveLength(2);
    expect(implementationsOf({ id: 'one' })).toEqual([{ id: 'one' }]);
    expect(selectedPage(pageSelection('dashboard'))).toBe('dashboard');
    expect(selectedPage('button')).toBeUndefined();
    expect(displayName('welcome-message')).toBe('Welcome Message');
    expect(navigationMatches('TRAVEL', 'Traveler')).toBe(true);
    expect(pageHierarchy(payload(), 'traveler')?.folders[0]?.folders[0]?.pages[0]?.label).toBe('Overview');
    expect(pageHierarchy(payload(), 'missing')).toBeUndefined();
    expect(inspectableComponentNames(payload()).has('shell')).toBe(true);
    expect(mappedComponentNames(payload()).has('shell')).toBe(false);
  });

  it('keeps every contract component inspectable while implementations are missing or stale', () => {
    const stale = payload();
    stale.implementationPlatforms = [];

    expect([...inspectableComponentNames(stale)]).toEqual(stale.contract.components.map((component) => component.name));
    expect(mappedComponentNames(stale).size).toBe(0);
  });

  it('keeps pages separate from component implementations', () => {
    const shared = payload();
    shared.stories.text = 'pages-dashboard--default';
    expect(implementationsForSelection(shared, 'shell')).toEqual([]);
    expect(selectionOwnsStory(shared, 'shell', 'pages-dashboard--default')).toBe(false);
    expect(selectionOwnsStory(shared, pageSelection('dashboard'), 'pages-dashboard--default')).toBe(true);
  });

  it('orders and labels every component from the shared platform matrix', () => {
    const shared = payload();
    shared.stories.shell = [
      { id: 'templates-shell--native', label: 'Custom native label', platform: 'react-native-web' },
      { id: 'templates-shell--dom', label: 'Custom DOM label', platform: 'web' },
    ];

    expect(implementationsForSelection(shared, 'shell')).toEqual([
      { id: 'templates-shell--dom', label: 'DOM', platform: 'web' },
      { id: 'templates-shell--native', label: 'React Native Web', platform: 'react-native-web' },
    ]);
    expect(mappedComponentNames(shared).has('shell')).toBe(true);
    expect(implementationMatrixFindings(shared)).toEqual([]);
    expect(mappedComponentNames(shared).has('button')).toBe(true);
  });

  it('inherits a part preview and platform coverage from its canonical parent', () => {
    const shared = payload();
    shared.stories.shell = [
      { id: 'templates-shell--dom', platform: 'web' },
      { id: 'templates-shell--native', platform: 'react-native-web' },
    ];

    const selection = canonicalSelection(shared, 'button');
    expect(selectedPart(selection)).toEqual({ owner: 'shell', path: ['card', 'button'], component: 'button' });
    expect(implementationsForSelection(shared, selection).map((item) => item.id)).toEqual(['templates-shell--dom', 'templates-shell--native']);
    expect(selectionOwnsStory(shared, selection, 'templates-shell--dom')).toBe(true);
    expect(partSelection(selection, 'label')).toContain('$part:shell:card/button/label');
  });

  it('merges viewport controls with component selections deterministically', () => {
    expect(controlArgs({ viewports: { desktop: { layout: 'desktop' } }, variants: { primary: { kind: 'primary' } } }, { viewports: 'desktop', variants: 'primary' })).toEqual({ layout: 'desktop', kind: 'primary' });
  });

  it('keeps a mapped root as its own canonical selection', () => {
    const shared = payload();
    shared.stories.shell = [{ id: 'shell--dom', platform: 'web' }, { id: 'shell--native', platform: 'react-native-web' }];
    expect(canonicalSelection(shared, 'shell')).toBe('shell');
  });

  it('keeps an unmapped orphan selectable when no canonical ancestor exists', () => {
    expect(canonicalSelection(payload(), 'shell')).toBe('shell');
  });

  it('reports duplicate and undeclared platform mappings separately', () => {
    const shared = payload();
    shared.implementationPlatforms = [{ id: 'web', label: 'DOM' }, { id: 'web', label: 'DOM duplicate' }];
    shared.stories.shell = [{ id: 'one', platform: 'web' }, { id: 'two', platform: 'web' }, { id: 'legacy' }, { id: 'ios', platform: 'ios' }];
    const findings = implementationMatrixFindings(shared);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'storybook/implementation-platforms', message: 'Platform "web" is declared more than once' }),
      expect.objectContaining({ path: 'stories.shell', message: 'DOM is mapped 2 times' }),
      expect.objectContaining({ path: 'stories.shell', message: 'Implementation "legacy" has no platform' }),
      expect.objectContaining({ path: 'stories.shell', message: 'Implementation "ios" uses undeclared platform "ios"' }),
    ]));
  });
});
