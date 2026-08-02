import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractStory, showcaseContract } from '../demo/DesignHarness.stories.js';
import { evaluateStoryPanel } from '../src/storybook/preview.js';

const coverage = { states: ['default'], themes: ['dark'], viewports: ['desktop'], locales: ['en'] };

describe('Storybook workbench showcase', () => {
  it('derives a green inventory from the conformant rendered story', async () => {
    document.body.innerHTML = renderToStaticMarkup(React.createElement(ContractStory));
    const payload = await evaluateStoryPanel(showcaseContract, 'design-overview', coverage);
    expect(payload.outcome).toBe('pass');
    expect(payload.contract.components).toHaveLength(9);
    expect(new Set(payload.evidence.nodes.map((node) => node.component))).toEqual(new Set(payload.contract.components.map((component) => component.name)));
  });

  it('exposes independent structural, policy, token, and coverage violations', async () => {
    document.body.innerHTML = renderToStaticMarkup(React.createElement(ContractStory, { inconsistent: true }));
    const payload = await evaluateStoryPanel(showcaseContract, 'design-overview', { ...coverage, themes: [], viewports: [] });
    const rules = (payload.results as unknown as readonly { evidence?: { rule: string }[] }[]).flatMap((result) => result.evidence?.map((finding) => finding.rule) ?? []);
    expect(payload.outcome).toBe('fail');
    expect(rules).toEqual(expect.arrayContaining([
      'atomic/unknown-component',
      'atomic/missing-slot',
      'atomic/illegal-tier-nesting',
      'component/undeclared-variant',
      'content/button-label',
      'hierarchy/primary-action-limit',
      'hierarchy/heading-jump',
      'coverage/missing-axis',
      'tokens/unknown-token',
    ]));
  });
});
