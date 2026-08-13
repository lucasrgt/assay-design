import { describe, expect, it } from 'vitest';
import { partImplementationFindings } from '../src/storybook/part-drift.js';
import type { DesignEvidence } from '../src/index.js';

const contract = { components: [
  { name: 'text', parts: [] },
  { name: 'welcome-message', parts: ['text'] },
] } as never;
const evidence = (nodes: DesignEvidence['nodes']): DesignEvidence => ({ surface: 'showroom', nodes });

describe('isolated part drift', () => {
  it('reports a structurally stale isolated story after both stories have evidence', () => {
    const payload = { contract, stories: {
      'welcome-message': [{ id: 'parent--web', platform: 'web' }],
      text: [{ id: 'text--web', platform: 'web' }],
    } } as never;
    const cache = new Map([
      ['parent--web', evidence([{ component: 'welcome-message' }, { component: 'text', parent: 0, role: 'heading' }])],
      ['text--web', evidence([{ component: 'text', role: 'body' }])],
    ]);

    expect(partImplementationFindings(payload, cache)).toEqual([expect.objectContaining({ rule: 'storybook/part-implementation-drift', path: 'stories.text' })]);
    cache.set('text--web', evidence([{ component: 'text', role: 'heading' }]));
    expect(partImplementationFindings(payload, cache)).toEqual([]);
  });

  it('stays silent until both optional evidence sources have been observed', () => {
    const payload = { contract, stories: { 'welcome-message': 'parent--default', text: 'text--default' } } as never;
    expect(partImplementationFindings(payload, new Map([['parent--default', evidence([{ component: 'welcome-message' }])]]))).toEqual([]);
  });

  it('matches nested descendants and ignores unrelated, missing, and structurally aligned stories', () => {
    const payload = { contract: { components: [
      { name: 'atom', parts: [] },
      { name: 'molecule', parts: ['atom'] },
      { name: 'template', parts: ['molecule'] },
      { name: 'empty', parts: ['atom'] },
    ] }, stories: {
      template: [{ id: 'template--dom', platform: 'web' }],
      molecule: [{ id: 'molecule--dom', platform: 'web' }],
      atom: [{ id: 'atom--dom', platform: 'web' }],
      empty: [{ id: 'empty--dom', platform: 'web' }],
    } } as never;
    const cache = new Map([
      ['template--dom', evidence([{ component: 'template' }, { component: 'molecule', parent: 0 }, { component: 'atom', parent: 1, variant: 'primary' }])],
      ['molecule--dom', evidence([{ component: 'molecule' }, { component: 'atom', parent: 0, variant: 'primary' }])],
      ['atom--dom', evidence([{ component: 'wrapper' }, { component: 'atom', parent: 0, variant: 'primary' }])],
      ['empty--dom', evidence([{ component: 'empty' }])],
    ]);
    expect(partImplementationFindings(payload, cache)).toEqual([]);
  });

  it('supports legacy string stories and reports a missing parent part only when comparable roots exist', () => {
    const payload = { contract, stories: { 'welcome-message': 'parent--default', text: 'text--default' } } as never;
    const cache = new Map([
      ['parent--default', evidence([{ component: 'welcome-message' }, { component: 'other', parent: 0 }])],
      ['text--default', evidence([{ component: 'text' }])],
    ]);
    expect(partImplementationFindings(payload, cache)).toEqual([]);
    cache.set('parent--default', evidence([{ component: 'welcome-message' }, { component: 'text', parent: 0, state: 'default' }]));
    expect(partImplementationFindings(payload, cache)[0]?.message).toContain('inside welcome-message');
  });
});
