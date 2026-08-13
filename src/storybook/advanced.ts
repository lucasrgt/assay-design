export type InspectionPalette = { accent: string; agentic: string; positive: string; warning: string; panel: string; text: string; muted: string };
export type AdvancedColor = { value: string; token?: string };
export type AdvancedInspection = {
  component: string; size: [number, number]; padding: string[]; content: [number, number]; text?: { value: string; width: number; height: number };
  font: [string, string, string, string, string]; radius: string; slots: (string | undefined)[];
  colors: { foreground: AdvancedColor; background: AdvancedColor; border?: AdvancedColor };
  tokenMatches: { padding: (string | undefined)[]; font?: string; radius?: string }; raw: string[]; grid: number; layer: 'root' | 'part'; color: string;
};

const cleanups = new WeakMap<HTMLIFrameElement, () => void>();
const number = (value: string) => Number.parseFloat(value) || 0;
const round = (value: number) => Math.round(value * 10) / 10;
const paint = <T extends HTMLElement>(node: T, styles: Partial<CSSStyleDeclaration>) => { Object.assign(node.style, styles); return node; };
const layer = (document: Document, root: HTMLElement, styles: Partial<CSSStyleDeclaration>, text?: string) => {
  const node = paint(document.createElement('div'), styles);
  if (text) node.textContent = text;
  root.append(node);
  return node;
};

type InspectionFocus = { owner: string; path: readonly string[] };
const directChildren = (owner: HTMLElement, name: string) => [...owner.querySelectorAll<HTMLElement>('[data-ds],[data-ui]')]
  .filter((node) => (node.dataset.ds ?? node.dataset.ui) === name && node.parentElement?.closest('[data-ds],[data-ui]') === owner);

export function projectAdvancedInspection(frame: HTMLIFrameElement, component: string, enabled: boolean, tokens: Record<string, string> = {}, palette: InspectionPalette, onInspect?: (facts: AdvancedInspection[]) => void, tokenMeta: Record<string, { type?: string }> = {}, parts: readonly string[] = [], focus?: InspectionFocus) {
  cleanups.get(frame)?.();
  cleanups.delete(frame);
  if (!enabled && !focus) { onInspect?.([]); return; }
  try {
    const view = frame.contentWindow;
    const document = frame.contentDocument;
    if (!view || !document?.body) return;
    const selector = '[data-ds],[data-ui]';
    const ownerRoots = focus ? [...document.querySelectorAll<HTMLElement>(selector)].filter((node) => (node.dataset.ds ?? node.dataset.ui) === focus.owner) : [];
    const roots = focus ? focus.path.reduce<HTMLElement[]>((owners, name) => owners.flatMap((owner) => directChildren(owner, name)), ownerRoots) : [...document.querySelectorAll<HTMLElement>(selector)].filter((node) => (node.dataset.ds ?? node.dataset.ui) === component);
    if (!roots.length) {
      onInspect?.([]);
      const Observer = (view as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver ?? MutationObserver;
      const observer = new Observer(() => {
        const mounted = focus
          ? focus.path.reduce<HTMLElement[]>((owners, name) => owners.flatMap((owner) => directChildren(owner, name)), [...document.querySelectorAll<HTMLElement>(selector)].filter((node) => (node.dataset.ds ?? node.dataset.ui) === focus.owner)).length > 0
          : [...document.querySelectorAll<HTMLElement>(selector)].some((node) => (node.dataset.ds ?? node.dataset.ui) === component);
        if (!mounted) return;
        observer.disconnect();
        if (cleanups.get(frame) === cleanup) projectAdvancedInspection(frame, component, enabled, tokens, palette, onInspect, tokenMeta, parts, focus);
      });
      const cleanup = () => observer.disconnect();
      cleanups.set(frame, cleanup);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ds', 'data-ui'] });
      return;
    }
    const root = paint(document.createElement('div'), { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none', font: '10px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace' });
    root.dataset.assayAdvanced = component;
    document.body.append(root);
    const entries = Object.entries(tokens);
    const partColors = [palette.agentic, palette.positive, palette.warning, palette.muted];
    const targets = roots.flatMap((owner) => [{ node: owner, name: component, color: palette.accent, layer: 'root' as const }, ...[...owner.querySelectorAll<HTMLElement>(selector)]
      .filter((node) => node.parentElement?.closest(selector) === owner && parts.includes(node.dataset.ds ?? node.dataset.ui ?? ''))
      .map((node) => { const name = node.dataset.ds ?? node.dataset.ui ?? ''; return { node, name, color: partColors[Math.max(0, parts.indexOf(name)) % partColors.length]!, layer: 'part' as const }; })]);
    const tokenFor = (value: string, hints: string[]) => entries.find(([name, token]) => token.trim() === value.trim() && hints.some((hint) => name.toLowerCase().includes(hint)))?.[0];
    const normalizeColor = (value: string) => {
      if (!value) return '';
      const probe = document.createElement('span');
      probe.style.color = value;
      document.body.append(probe);
      const normalized = view.getComputedStyle(probe).color;
      probe.remove();
      return normalized;
    };
    const colorEntries = entries.filter(([name]) => tokenMeta[name]?.type === 'color' || (!Object.keys(tokenMeta).length && name.toLowerCase().includes('color')))
      .map(([name, value]) => [name, normalizeColor(value)] as const);
    const colorFact = (value: string, hints: string[]): AdvancedColor => {
      const normalized = normalizeColor(value);
      const matches = colorEntries.filter(([, token]) => token === normalized);
      const token = matches.find(([name]) => hints.some((hint) => name.toLowerCase().includes(hint)))?.[0] ?? matches[0]?.[0];
      return { value: normalized || value, ...(token ? { token } : {}) };
    };
    const spacing = entries.filter(([name]) => /space|spacing/.test(name.toLowerCase())).map(([, value]) => number(value)).filter((value) => value >= 2).sort((a, b) => a - b)[0] ?? 4;
    const tag = (text: string, left: number, top: number, color: string) => layer(document, root, { position: 'fixed', left: `${left}px`, top: `${top}px`, padding: '1px 4px', borderRadius: '3px', color: palette.panel, background: color, fontWeight: '700', whiteSpace: 'nowrap' }, text);
    if (!enabled) {
      const drawFocus = () => {
        root.replaceChildren();
        for (const target of roots) {
          const rect = target.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          layer(document, root, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, boxSizing: 'border-box', outline: `2px solid ${palette.accent}`, background: `color-mix(in srgb, ${palette.accent} 7%, transparent)` });
          tag(`part · ${component}`, rect.left, Math.max(2, rect.top - 16), palette.accent);
        }
        onInspect?.([]);
      };
      roots[0]?.scrollIntoView({ block: 'center', inline: 'center' });
      drawFocus();
      const Observer = (view as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ?? ResizeObserver;
      const observer = new Observer(drawFocus);
      roots.forEach((target) => observer.observe(target));
      view.addEventListener('resize', drawFocus);
      view.addEventListener('scroll', drawFocus, true);
      cleanups.set(frame, () => { observer.disconnect(); view.removeEventListener('resize', drawFocus); view.removeEventListener('scroll', drawFocus, true); root.remove(); });
      return;
    }
    const band = (left: number, top: number, width: number, height: number, value: number, showLabel: boolean) => {
      if (width <= 0 || height <= 0) return;
      layer(document, root, { position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, boxSizing: 'border-box', background: `color-mix(in srgb, ${palette.warning} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${palette.warning} 38%, transparent)` });
      if (showLabel && Math.min(width, height) >= 10) tag(String(round(value)), left + Math.max(1, width / 2 - 7), top + Math.max(0, height / 2 - 6), palette.warning);
    };
    const draw = () => {
      root.replaceChildren();
      const inspections: AdvancedInspection[] = [];
      for (const { node: target, name, color, layer: inspectionLayer } of targets) {
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const style = view.getComputedStyle(target);
        const padding = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
        const p = padding.map(number);
        const b = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(number);
        const inner = { left: rect.left + b[3]!, top: rect.top + b[0]!, width: rect.width - b[1]! - b[3]!, height: rect.height - b[0]! - b[2]! };
        const content = { left: inner.left + p[3]!, top: inner.top + p[0]!, width: Math.max(0, inner.width - p[1]! - p[3]!), height: Math.max(0, inner.height - p[0]! - p[2]!) };
        const paddingTokens = padding.map((value) => tokenFor(value, ['space', 'spacing']));
        const fontToken = tokenFor(style.fontSize, ['font', 'type']);
        const radiusToken = tokenFor(style.borderRadius, ['radius', 'radii']);
        const foreground = colorFact(style.color, ['content', 'text', 'on']);
        const background = colorFact(style.backgroundColor, ['action', 'surface', 'background', 'bg']);
        const border = b.some((width) => width > 0) ? colorFact(style.borderTopColor, ['border', 'action']) : undefined;
        const rawValues = new Set(padding.filter((value, index) => p[index]! > 0 && !paddingTokens[index]));
        if (!fontToken) rawValues.add(style.fontSize);
        if (number(style.borderRadius) && !radiusToken) rawValues.add(style.borderRadius);
        if (colorEntries.length && !foreground.token) rawValues.add(foreground.value);
        if (colorEntries.length && background.value !== 'rgba(0, 0, 0, 0)' && !background.token) rawValues.add(background.value);
        if (colorEntries.length && border && !border.token) rawValues.add(border.value);
        layer(document, root, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, boxSizing: 'border-box', outline: `1px solid ${color}`, backgroundImage: `linear-gradient(${color}30 1px, transparent 1px), linear-gradient(90deg, ${color}30 1px, transparent 1px)`, backgroundSize: `${spacing}px ${spacing}px` });
        const spacious = rect.width >= 180 && rect.height >= 64;
        band(inner.left, inner.top, inner.width, p[0]!, p[0]!, spacious);
        band(inner.left, inner.top + inner.height - p[2]!, inner.width, p[2]!, p[2]!, spacious);
        band(inner.left, inner.top + p[0]!, p[3]!, content.height, p[3]!, spacious);
        band(inner.left + inner.width - p[1]!, inner.top + p[0]!, p[1]!, content.height, p[1]!, spacious);
        layer(document, root, { position: 'fixed', left: `${content.left}px`, top: `${content.top}px`, width: `${content.width}px`, height: `${content.height}px`, boxSizing: 'border-box', border: `1px dashed ${palette.positive}` });
        if (content.width >= 120 && content.height >= 32) tag('content box', content.left, Math.max(2, content.top - 14), palette.positive);
        layer(document, root, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, backgroundImage: `linear-gradient(90deg, transparent calc(50% - .5px), ${color}88 calc(50% - .5px), ${color}88 calc(50% + .5px), transparent calc(50% + .5px)), linear-gradient(transparent calc(50% - .5px), ${color}88 calc(50% - .5px), ${color}88 calc(50% + .5px), transparent calc(50% + .5px))` });
        tag(inspectionLayer === 'part' ? `part · ${name}` : name, rect.left, Math.max(2, rect.top - 14), color);
        const slots = [...target.querySelectorAll<HTMLElement>('[data-ds-slot],[data-ui-slot]')];
        for (const slot of slots) {
          const slotRect = slot.getBoundingClientRect();
          const name = slot.dataset.dsSlot ?? slot.dataset.uiSlot ?? 'slot';
          layer(document, root, { position: 'fixed', left: `${slotRect.left}px`, top: `${slotRect.top}px`, width: `${slotRect.width}px`, height: `${slotRect.height}px`, boxSizing: 'border-box', outline: `1px solid ${palette.agentic}` });
          if (slotRect.width >= 100 && slotRect.height >= 28) tag(`${name} slot`, slotRect.left, slotRect.bottom + 2, palette.agentic);
        }
        const walker = document.createTreeWalker(target, 4);
        let textNode = walker.nextNode();
        while (textNode && !textNode.textContent?.trim()) textNode = walker.nextNode();
        let textMeasure: { value: string; width: number; height: number } | undefined;
        if (textNode) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const textRect = range.getBoundingClientRect();
          textMeasure = { value: textNode.textContent!.trim(), width: textRect.width, height: textRect.height };
          layer(document, root, { position: 'fixed', left: `${textRect.left}px`, top: `${textRect.top}px`, width: `${textRect.width}px`, height: `${textRect.height}px`, boxSizing: 'border-box', borderBottom: `1px solid ${palette.agentic}` });
        }
        inspections.push({ component: name, size: [rect.width, rect.height], padding, content: [content.width, content.height], ...(textMeasure ? { text: textMeasure } : {}), font: [style.fontFamily, style.fontSize, style.lineHeight, style.fontWeight, style.letterSpacing], radius: style.borderRadius, slots: slots.map((slot) => slot.dataset.dsSlot ?? slot.dataset.uiSlot), colors: { foreground, background, ...(border ? { border } : {}) }, tokenMatches: { padding: paddingTokens, ...(fontToken ? { font: fontToken } : {}), ...(radiusToken ? { radius: radiusToken } : {}) }, raw: [...rawValues], grid: spacing, layer: inspectionLayer, color });
      }
      root.dataset.assayInspection = JSON.stringify(inspections);
      onInspect?.(inspections);
    };
    draw();
    const Observer = (view as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ?? ResizeObserver;
    const observer = new Observer(draw);
    targets.forEach(({ node }) => observer.observe(node));
    view.addEventListener('resize', draw);
    view.addEventListener('scroll', draw, true);
    cleanups.set(frame, () => { observer.disconnect(); view.removeEventListener('resize', draw); view.removeEventListener('scroll', draw, true); root.remove(); });
  } catch { /* The preview may navigate while the manager synchronizes it. */ }
}
