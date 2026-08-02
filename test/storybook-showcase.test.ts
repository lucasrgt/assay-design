import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import showcaseMeta, { ContractStory, showcaseContract } from '../demo/DesignHarness.stories.js';
import { evaluateStoryPanel, publishStoryPanel, REQUEST_EVENT, VERDICT_EVENT } from '../src/storybook/preview.js';

const coverage = { states: ['default'], themes: ['dark'], viewports: ['desktop'], locales: ['en'] };

describe('Storybook workbench showcase', () => {
  afterEach(() => vi.useRealTimers());

  it('derives a green inventory from the conformant rendered story', async () => {
    document.body.innerHTML = renderToStaticMarkup(React.createElement(ContractStory));
    const payload = await evaluateStoryPanel(showcaseContract, 'design-overview', coverage, showcaseMeta.parameters.designHarness.stories, showcaseMeta.parameters.designHarness.controls);
    expect(payload.outcome).toBe('pass');
    expect(payload.contract.components).toHaveLength(9);
    expect(Object.keys(payload.stories)).toHaveLength(9);
    expect(payload.controls).toMatchObject({ button: { states: { disabled: { state: 'disabled' } } } });
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

  it('replays the current payload when the panel opens after the initial emission', async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, Set<() => void>>();
    const verdicts: unknown[] = [];
    const channel = {
      on: (event: string, listener: () => void) => listeners.set(event, new Set([...(listeners.get(event) ?? []), listener])),
      off: (event: string, listener: () => void) => listeners.get(event)?.delete(listener),
      emit: (event: string, payload?: unknown) => {
        if (event === VERDICT_EVENT) verdicts.push(payload);
        for (const listener of listeners.get(event) ?? []) listener();
      },
    };
    const payload = { outcome: 'pass' } as never;
    publishStoryPanel(channel, async () => payload);
    await vi.runAllTimersAsync();
    verdicts.length = 0;
    channel.emit(REQUEST_EVENT);
    await Promise.resolve();
    expect(verdicts).toEqual([payload]);
  });
});
