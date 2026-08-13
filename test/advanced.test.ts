import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectAdvancedInspection, type InspectionPalette } from '../src/storybook/advanced.js';

const palette: InspectionPalette = { accent: '#1ea7fd', agentic: '#a855f7', positive: '#66bf3c', warning: '#ffb000', panel: '#202223', text: '#f6f9fc', muted: '#9aa4b2' };
const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const tokens = { 'space.sm': '8px', 'space.md': '12px', 'fontSize.callout': '15px', 'fontSize.body': '16px', 'radius.sm': '4px', 'radius.md': '8px' };

function preview(markup: string) {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const view = frame.contentWindow!;
  const doc = frame.contentDocument!;
  doc.body.innerHTML = markup;
  class Observer { observe = vi.fn(); disconnect = vi.fn(); constructor(public callback: () => void) {} }
  Object.defineProperty(view, 'ResizeObserver', { configurable: true, value: Observer });
  Object.defineProperty((view as any).Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => box(40, 53, 64, 20) });
  return { frame, view, document: doc };
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('advanced Storybook inspection', () => {
  it('waits for an asynchronously rendered Storybook subject', async () => {
    const subject = preview('<div id="root"></div>');
    const inspect = vi.fn();
    projectAdvancedInspection(subject.frame, 'button', true, tokens, palette, inspect);
    expect(inspect).toHaveBeenLastCalledWith([]);
    const button = subject.document.createElement('button');
    button.dataset.ui = 'button';
    button.style.cssText = 'padding:8px;font-size:16px;line-height:20px;border-radius:4px';
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(box(16, 40, 96, 40));
    subject.document.querySelector('#root')!.append(button);
    await vi.waitFor(() => expect(inspect.mock.lastCall![0][0]).toMatchObject({ component: 'button', size: [96, 40] }));
    expect(subject.document.querySelector('[data-assay-advanced="button"]')).not.toBeNull();
  });

  it('projects box, padding, content, slot, text, tokens, and cleanup', () => {
    const subject = preview('<button data-ui="button" style="padding:12px 20px;font-size:15px;line-height:20px;font-weight:700;color:#fff;background-color:#00f;border:1px solid #000;border-radius:8px"><span data-ui-slot="label">Continue</span></button>');
    const button = subject.document.querySelector<HTMLElement>('button')!;
    const slot = subject.document.querySelector<HTMLElement>('span')!;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(box(16, 40, 104, 46));
    vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue(box(36, 53, 64, 20));
    const inspect = vi.fn();
    const coloredTokens = { ...tokens, 'color.action.primary': '#0000ff', 'color.content.onAction': '#ffffff', 'color.border.default': '#000000' };
    const colorMeta = Object.fromEntries(Object.keys(coloredTokens).filter((name) => name.startsWith('color.')).map((name) => [name, { type: 'color' }]));
    projectAdvancedInspection(subject.frame, 'button', true, coloredTokens, palette, inspect, colorMeta);
    const overlay = subject.document.querySelector<HTMLElement>('[data-assay-advanced="button"]')!;
    const evidence = inspect.mock.lastCall![0][0];
    expect(JSON.parse(overlay.dataset.assayInspection!)).toHaveLength(1);
    expect(evidence).toMatchObject({ component: 'button', size: [104, 46], content: [62, 20], text: { value: 'Continue', width: 64, height: 20 }, colors: { foreground: { token: 'color.content.onAction' }, background: { token: 'color.action.primary' }, border: { token: 'color.border.default' } }, raw: ['20px'], grid: 8, tokenMatches: { font: 'fontSize.callout', radius: 'radius.md' } });
    projectAdvancedInspection(subject.frame, 'button', false, tokens, palette);
    expect(subject.document.querySelector('[data-assay-advanced]')).toBeNull();
  });

  it('projects declared direct parts as stable colored inspection layers', () => {
    const subject = preview('<section data-ui="welcome-message"><div data-ui="brand-logo"></div><div><span data-ui="text">Welcome</span></div><span data-ui="icon"></span></section>');
    const message = subject.document.querySelector<HTMLElement>('section')!;
    const logo = subject.document.querySelector<HTMLElement>('[data-ui="brand-logo"]')!;
    const text = subject.document.querySelector<HTMLElement>('[data-ui="text"]')!;
    vi.spyOn(message, 'getBoundingClientRect').mockReturnValue(box(10, 20, 300, 160));
    vi.spyOn(logo, 'getBoundingClientRect').mockReturnValue(box(30, 40, 120, 48));
    vi.spyOn(text, 'getBoundingClientRect').mockReturnValue(box(30, 100, 200, 28));
    const inspect = vi.fn();
    projectAdvancedInspection(subject.frame, 'welcome-message', true, tokens, palette, inspect, {}, ['brand-logo', 'text']);
    expect(inspect.mock.lastCall![0].map((fact: { component: string; layer: string; color: string }) => [fact.component, fact.layer, fact.color])).toEqual([
      ['welcome-message', 'root', palette.accent],
      ['brand-logo', 'part', palette.agentic],
      ['text', 'part', palette.positive],
    ]);
    expect(subject.document.querySelector('[data-assay-advanced]')?.textContent).toContain('part · brand-logo');
    expect(subject.document.querySelector('[data-assay-advanced]')?.textContent).not.toContain('part · icon');
  });

  it('focuses a nested part inside the canonical parent without opening an isolated story', () => {
    const subject = preview('<main data-ui="screen"><section data-ui="welcome-content"><div data-ui="welcome-message">Welcome</div></section></main><section data-ui="welcome-content">Unrelated</section>');
    const content = subject.document.querySelector<HTMLElement>('main [data-ui="welcome-content"]')!;
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(box(32, 48, 280, 140));
    Object.defineProperty(content, 'scrollIntoView', { configurable: true, value: vi.fn() });
    const inspect = vi.fn();

    projectAdvancedInspection(subject.frame, 'welcome-content', false, tokens, palette, inspect, {}, [], { owner: 'screen', path: ['welcome-content'] });

    const overlay = subject.document.querySelector<HTMLElement>('[data-assay-advanced="welcome-content"]')!;
    expect(overlay.textContent).toContain('part · welcome-content');
    expect(overlay.querySelectorAll('div')).toHaveLength(2);
    expect(inspect).toHaveBeenCalledWith([]);
  });

  it('reports token-aligned values when space is constrained', () => {
    const subject = preview('<button data-ds="button" style="padding:8px;font-size:16px;line-height:20px;font-weight:400;border-radius:4px"></button>');
    const button = subject.document.querySelector<HTMLElement>('button')!;
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(box(920, 620, 96, 40));
    const inspect = vi.fn();
    projectAdvancedInspection(subject.frame, 'button', true, tokens, palette, inspect);
    expect(inspect.mock.lastCall![0][0].raw).toEqual([]);
  });

  it('adds inline labels only when a component has room for them', () => {
    const subject = preview('<section data-ui="card" style="padding:12px;font-size:16px;line-height:20px;border-radius:8px"><span data-ui-slot="content">Large content</span></section>');
    const card = subject.document.querySelector<HTMLElement>('section')!;
    const slot = subject.document.querySelector<HTMLElement>('span')!;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(20, 80, 240, 120));
    vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue(box(32, 92, 216, 96));
    projectAdvancedInspection(subject.frame, 'card', true, tokens, palette);
    const overlay = subject.document.querySelector<HTMLElement>('[data-assay-advanced="card"]')!;
    expect(overlay.textContent).toContain('content box');
    expect(overlay.textContent).toContain('content slot');
  });

  it('is inert without a visible matching subject', () => {
    const empty = preview('<div data-ui="card"></div>');
    projectAdvancedInspection(empty.frame, 'button', false, {}, palette);
    projectAdvancedInspection(empty.frame, 'button', true, {}, palette);
    expect(empty.document.querySelector('[data-assay-advanced]')).toBeNull();
    const hidden = empty.document.querySelector<HTMLElement>('div')!;
    projectAdvancedInspection(empty.frame, 'card', true, {}, palette);
    expect(JSON.parse(empty.document.querySelector<HTMLElement>('[data-assay-advanced]')!.dataset.assayInspection!)).toEqual([]);
    vi.spyOn(hidden, 'getBoundingClientRect').mockReturnValue(box(10, 10, 10, 10));
  });
});
