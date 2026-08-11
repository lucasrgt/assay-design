import { describe, expect, it } from 'vitest';
import { displayName, implementationsForSelection, implementationsOf, inspectableComponentNames, mappedComponentNames, mappedPages, navigationMatches, pageBackedImplementations, pageHierarchy, pageSelection, selectedPage, selectionOwnsStory } from '../src/storybook/atomic-navigation-model.js';
import type { DesignPanelPayload } from '../src/storybook/shared.js';
import { contract, evidence } from './fixtures.js';

const payload = (): DesignPanelPayload => ({
  outcome: 'pass',
  results: [],
  contract: { ...contract(), surfaces: [...contract().surfaces, { name: 'settings', template: 'screen', requiredComponents: [], requiredStates: [], requiredThemes: [], requiredViewports: [], requiredLocales: [] }] },
  evidence: evidence(),
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
    expect(pageBackedImplementations(payload(), 'shell')[0]?.id).toBe('pages-dashboard--default');
  });

  it('keeps a page-backed template selected when its page story is also mapped to an atom', () => {
    const shared = payload();
    shared.stories.text = 'pages-dashboard--default';
    expect(implementationsForSelection(shared, 'shell')[0]?.id).toBe('pages-dashboard--default');
    expect(selectionOwnsStory(shared, 'shell', 'pages-dashboard--default')).toBe(true);
    expect(selectionOwnsStory(shared, pageSelection('dashboard'), 'pages-dashboard--default')).toBe(true);
  });

  it('combines canonical and page-backed template implementations without duplicates', () => {
    const shared = payload();
    shared.stories.shell = [
      { id: 'templates-shell--base', label: 'Template base', controls: { states: { default: { disabled: false } } } },
      { id: 'pages-dashboard--default', label: 'Duplicate dashboard', controls: { states: { default: { disabled: true } } } },
    ];
    shared.pages!.dashboard = { id: 'pages-dashboard--default', label: 'React Native Web', platform: 'react-native-web' };

    expect(implementationsForSelection(shared, 'shell')).toEqual([
      { id: 'templates-shell--base', label: 'Template base', controls: { states: { default: { disabled: false } } } },
      { id: 'pages-dashboard--default', label: 'React Native Web', platform: 'react-native-web', controls: { states: { default: { disabled: true } } } },
    ]);
    expect(mappedComponentNames(shared).has('shell')).toBe(true);
  });
});
