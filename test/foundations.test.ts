import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseContract } from '../src/index.js';
import { FoundationPreview, foundationGroups, foundationSelection, selectedFoundation } from '../src/storybook/foundations.js';

describe('Storybook foundations', () => {
  it('groups hydrated DTCG tokens by their declared type owner', () => {
    const contract = parseContract('schema=1\nname="system"', [{
      color: { $type: 'color', action: { primary: { $value: '#00f' }, danger: { $value: '#f00' } }, dark: { action: { primary: { $value: '#0ff' } } } },
      space: { $type: 'dimension', sm: { $value: { value: 8, unit: 'px' } } },
      fontSize: { $type: 'dimension', body: { $value: { value: 16, unit: 'px' } } },
      shadow: { $type: 'shadow', raised: { $value: [{ color: '#0003', offsetX: '0px', offsetY: '2px', blur: '4px' }] } },
    }]);
    const groups = foundationGroups(contract);
    expect(groups.map((group) => [group.id, group.type, group.tokens.length])).toEqual([
      ['color', 'color', 3], ['space', 'dimension', 1], ['fontSize', 'dimension', 1], ['shadow', 'shadow', 1],
    ]);
    expect(groups[0]?.tokens[0]).toMatchObject({ name: 'color.action.primary', label: 'Primary', value: '#00f', section: 'action', theme: 'light' });
    expect(groups[0]?.tokens[2]).toMatchObject({ name: 'color.dark.action.primary', label: 'Primary', value: '#0ff', section: 'action', theme: 'dark' });
    expect(groups.at(-1)?.tokens[0]?.value).toContain('offsetY');
    expect(selectedFoundation(foundationSelection('fontSize'))).toBe('fontSize');
    expect(selectedFoundation('button')).toBeUndefined();
  });

  it('renders visual samples for each supported foundation type', () => {
    const groups = foundationGroups({
      tokens: {
        'color.primary': '#00f', 'shadow.sm': '0 2px 4px #0003', 'motion.fast': '120ms', 'fontSize.body': '16px',
        'fontFamily.body': 'Inter', 'fontWeight.strong': '700', 'radius.md': '8px', 'space.md': '12px', 'other.raw': 'value', 'legacy-token': 'plain',
      },
      tokenMeta: {
        'color.primary': { type: 'color', group: 'color' }, 'shadow.sm': { type: 'shadow', group: 'shadow' }, 'motion.fast': { type: 'duration', group: 'motion' },
        'fontSize.body': { type: 'dimension', group: 'fontSize' }, 'fontFamily.body': { type: 'fontFamily', group: 'fontFamily' },
        'fontWeight.strong': { type: 'fontWeight', group: 'fontWeight' }, 'radius.md': { type: 'dimension', group: 'radius' },
        'space.md': { type: 'dimension', group: 'space' }, 'other.raw': { group: 'other' },
      },
    });
    const html = groups.map((group) => renderToStaticMarkup(FoundationPreview({ group }))).join('');
    expect(html).toContain('Design system');
    expect(html).toContain('0 2px 4px #0003');
    expect(html).toContain('Legacy Token');
    expect(html).toContain('token · 1');
  });

  it('labels themed color tokens with their theme and semantic category', () => {
    const [color] = foundationGroups({
      tokens: { 'color.content.primary': '#111', 'color.dark.content.primary': '#eee' },
      tokenMeta: {
        'color.content.primary': { type: 'color', group: 'color', section: 'content' },
        'color.dark.content.primary': { type: 'color', group: 'color', section: 'dark.content' },
      },
    });
    const html = renderToStaticMarkup(FoundationPreview({ group: color! }));
    expect(html).toContain('Light · Content');
    expect(html).toContain('Dark · Content');
  });
});
