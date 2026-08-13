import { describe, expect, it } from 'vitest';
import { coverageSnapshot } from '../src/storybook/coverage-model.js';
import type { DesignPanelPayload } from '../src/storybook/shared.js';
import { contract, evidence } from './fixtures.js';

describe('Storybook coverage projection', () => {
  it('separates canonical mappings, page mappings, rendered requirements, and axes', () => {
    const payload = {
      outcome: 'pass', results: [], contract: contract(),
      evidence: { ...evidence(), coverage: { states: ['default'], themes: ['dark'], viewports: [], locales: [] } },
      implementationPlatforms: [{ id: 'web', label: 'DOM' }, { id: 'react-native-web', label: 'React Native Web' }],
      stories: { card: [{ id: 'components-card--dom', platform: 'web' }, { id: 'components-card--native', platform: 'react-native-web' }] },
      pages: { dashboard: { id: 'pages-dashboard--default', path: 'Product/Home' } },
    } as unknown as DesignPanelPayload;
    const snapshot = coverageSnapshot(payload);
    expect(snapshot.mappedComponents.has('card')).toBe(true);
    expect(snapshot.mappedComponents.has('shell')).toBe(false);
    expect(snapshot.mappedPageNames.has('dashboard')).toBe(true);
    expect(snapshot.current?.name).toBe('dashboard');
    expect(snapshot.current?.required.some((item) => item.name === 'shell')).toBe(true);
    expect(snapshot.current?.axes.states.observed).toEqual(['default']);
    expect(snapshot.missingComponents.map((item) => item.name)).toEqual(['shell']);
  });

  it('keeps declared surfaces distinct when no rendered surface is active', () => {
    const payload = {
      outcome: 'pass', results: [], contract: contract(),
      evidence: { ...evidence(), surface: 'other', nodes: [], coverage: undefined },
      implementationPlatforms: [{ id: 'web', label: 'DOM' }],
      stories: {}, pages: {},
    } as unknown as DesignPanelPayload;
    const snapshot = coverageSnapshot(payload);
    expect(snapshot.current).toBeUndefined();
    expect(snapshot.surfaces[0]?.covered).toBe(0);
    expect(snapshot.surfaces[0]?.mapped).toBe(false);
    expect(snapshot.observed.size).toBe(0);
  });
});
