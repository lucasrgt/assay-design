import { describe, expect, it } from 'vitest';
import { mergeContracts, parseContract } from '../src/index.js';
import { compositionGroupSelection, compositionFolders, effectiveGroups, groupedFoundations, selectedCompositionGroup } from '../src/storybook/grouping.js';

const configured = parseContract(`schema = 1
name = "suite"
[groups]
shared_label = "Shared"
[[groups.foundations]]
label = "Storefront"
include = ["color.product.storefront.*"]
[[groups.composition]]
label = "Storefront"
include = ["storefront-*"]
[[components]]
name = "text"
tier = "atom"
[[components]]
name = "storefront-card"
tier = "molecule"
parts = ["text"]
`, [{
  color: { $type: 'color', content: { $value: '#111111' }, product: { storefront: { accent: { $value: '#2266ee' } } } },
  space: { $type: 'dimension', md: { $value: { value: 12, unit: 'px' } } },
}]);

describe('design ownership groups', () => {
  it('parses groups as part of the canonical contract', () => {
    expect(configured.groups).toEqual({
      sharedLabel: 'Shared',
      foundations: [{ label: 'Storefront', include: ['color.product.storefront.*'] }],
      composition: [{ label: 'Storefront', include: ['storefront-*'] }],
    });
    expect(parseContract('schema=1\nname="plain"').groups).toEqual({ sharedLabel: 'Shared', foundations: [], composition: [] });
    expect(() => parseContract('schema=1\nname="bad"\n[groups]\nfoundations="no"')).toThrow(/groups.foundations must be an array/);
    expect(() => parseContract('schema=1\nname="bad"\n[groups]\n[[groups.composition]]\nlabel="Product"\ninclude="no"')).toThrow(/include must be an array/);
  });

  it('inherits organization groups and appends app ownership rules', () => {
    const app = parseContract(`schema=1
name="app"
[groups]
shared_label="Common"
[[groups.composition]]
label="Account"
include=["account-*"]`);
    const merged = mergeContracts(configured, app, true);
    expect(merged.groups.sharedLabel).toBe('Common');
    expect(merged.groups.composition.map((rule) => rule.label)).toEqual(['Storefront', 'Account']);
    expect(mergeContracts(configured, parseContract('schema=1\nname="plain"'), true).groups.sharedLabel).toBe('Shared');
  });

  it('slices foundation categories between shared and product folders', () => {
    const folders = groupedFoundations(configured, configured.groups);
    expect(folders.map((folder) => folder.label)).toEqual(['Shared', 'Storefront']);
    expect(folders[0]?.foundations.map((foundation) => [foundation.id, foundation.tokens.map((token) => token.name)])).toEqual([
      ['color', ['color.content']], ['space', ['space.md']],
    ]);
    expect(folders[1]?.foundations[0]).toMatchObject({ id: 'color', selectionKey: 'Storefront|color', tokens: [{ name: 'color.product.storefront.accent' }] });
    expect(groupedFoundations(configured)).toEqual([]);
  });

  it('groups component composition with unmatched items kept shared', () => {
    const folders = compositionFolders(configured.components, configured.groups);
    expect(folders.map((folder) => [folder.label, folder.components.map((component) => component.name)])).toEqual([
      ['Shared', ['text']], ['Storefront', ['storefront-card']],
    ]);
    expect(selectedCompositionGroup(folders[1]!.selection)).toBe('Storefront');
    expect(selectedCompositionGroup('text')).toBeUndefined();
    expect(compositionGroupSelection('Field tools')).toBe('$composition-group:Field%20tools');
    expect(compositionFolders(configured.components)).toEqual([]);
  });

  it('allows a projection to override only one grouping axis', () => {
    const payload = { contract: configured, groups: { sharedLabel: 'Common', composition: [{ label: 'Core', include: ['text'] }] } };
    expect(effectiveGroups(payload)).toEqual({ sharedLabel: 'Common', foundations: configured.groups.foundations, composition: [{ label: 'Core', include: ['text'] }] });
  });
});
