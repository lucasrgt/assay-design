import React, { type CSSProperties } from 'react';
import type { DesignContract } from '../index.js';

const element = React.createElement;
export const FOUNDATION_PREFIX = '$foundation:';
export type FoundationToken = { name: string; label: string; value: string; type?: string; section?: string; theme?: string };
export type FoundationGroup = { id: string; label: string; type?: string; tokens: FoundationToken[] };

const displayName = (name: string) => name.split('.').flatMap((part) => part.split(/[-_]/)).map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(' ');

export function foundationGroups(contract: Pick<DesignContract, 'tokens' | 'tokenMeta'>): FoundationGroup[] {
  const groups = new Map<string, FoundationGroup>();
  const hasDarkColors = Object.keys(contract.tokens ?? {}).some((name) => name.startsWith('color.dark.'));
  for (const [name, value] of Object.entries(contract.tokens ?? {})) {
    const meta = contract.tokenMeta?.[name];
    const id = meta?.group ?? name.split('.')[0]!;
    const group = groups.get(id) ?? { id, label: displayName(id), ...(meta?.type ? { type: meta.type } : {}), tokens: [] };
    const relative = name.startsWith(`${id}.`) ? name.slice(id.length + 1) : name;
    const label = meta?.section && relative.startsWith(`${meta.section}.`) ? relative.slice(meta.section.length + 1) : relative;
    const sectionParts = meta?.section?.split('.') ?? [];
    const explicitTheme = ['light', 'dark'].includes(sectionParts[0] ?? '') ? sectionParts.shift() : undefined;
    const theme = meta?.type === 'color' ? explicitTheme ?? (hasDarkColors ? 'light' : undefined) : undefined;
    const section = sectionParts.join('.') || undefined;
    group.tokens.push({ name, label: displayName(label), value, ...(meta?.type ? { type: meta.type } : {}), ...(section ? { section } : {}), ...(theme ? { theme } : {}) });
    groups.set(id, group);
  }
  return [...groups.values()];
}

export const foundationSelection = (group: string) => `${FOUNDATION_PREFIX}${group}`;
export const selectedFoundation = (selection: string) => selection.startsWith(FOUNDATION_PREFIX) ? selection.slice(FOUNDATION_PREFIX.length) : undefined;

const styles: Record<string, CSSProperties> = {
  root: { height: '100%', minHeight: 0, overflowY: 'auto', padding: 16, boxSizing: 'border-box', color: 'var(--ad-text)', background: 'var(--ad-canvas)', fontFamily: 'var(--ad-font)' },
  heading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '-16px -16px 14px', padding: '14px 16px 12px', borderBottom: '1px solid var(--ad-line)' },
  title: { margin: 0, fontSize: 16, fontWeight: 700 },
  type: { padding: '3px 7px', border: '1px solid var(--ad-line)', borderRadius: 999, color: 'var(--ad-muted)', fontSize: 10, fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 },
  section: { marginBottom: 18 },
  sectionTitle: { margin: '0 0 8px', color: 'var(--ad-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' },
  card: { display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, padding: 11, border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  name: { overflow: 'hidden', fontSize: 11, fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tokenContext: { color: 'var(--ad-muted)', fontSize: 9, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' },
  value: { overflow: 'hidden', color: 'var(--ad-muted)', fontFamily: 'var(--ad-mono)', fontSize: 10, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sample: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72, overflow: 'hidden', border: '1px solid var(--ad-line)', borderRadius: 'calc(var(--ad-radius) - 2px)', background: 'var(--ad-canvas)' },
};

function TokenSample({ token, group }: { token: FoundationToken; group: FoundationGroup }) {
  const type = token.type ?? group.type ?? '';
  const groupId = group.id.toLowerCase();
  if (type === 'color') return element('div', { style: { ...styles.sample, minHeight: 92, background: token.value } });
  if (type === 'shadow') return element('div', { style: styles.sample }, element('div', { style: { width: 72, height: 36, borderRadius: 6, background: 'var(--ad-panel)', boxShadow: token.value } }));
  if (type === 'duration') return element('div', { style: styles.sample }, element('div', { style: { width: `clamp(18px, calc(${token.value} / 2), 150px)`, height: 6, borderRadius: 999, background: 'var(--ad-accent)' } }));
  if (/font|type/.test(groupId) || ['typography', 'fontFamily', 'fontWeight'].includes(type)) return element('div', { style: { ...styles.sample, justifyContent: 'flex-start', padding: '0 12px', fontSize: type === 'dimension' ? token.value : 22, fontFamily: type === 'fontFamily' ? token.value : 'inherit', fontWeight: type === 'fontWeight' ? token.value : 600 } }, 'Design system');
  if (/radius|radii/.test(groupId)) return element('div', { style: styles.sample }, element('div', { style: { width: 72, height: 44, border: '2px solid var(--ad-accent)', borderRadius: token.value } }));
  if (type === 'dimension') return element('div', { style: { ...styles.sample, justifyContent: 'flex-start', padding: '0 12px' } }, element('div', { style: { width: `min(${token.value}, 100%)`, minWidth: 2, height: 12, background: 'var(--ad-accent)' } }));
  return element('div', { style: styles.sample }, element('span', { style: styles.value }, token.value));
}

export function FoundationPreview({ group }: { group: FoundationGroup }) {
  const sections = new Map<string, FoundationToken[]>();
  for (const token of group.tokens) {
    const section = [token.theme, token.section].filter(Boolean).join(' · ') || 'base';
    sections.set(section, [...(sections.get(section) ?? []), token]);
  }
  const showSectionTitles = sections.size > 1 || !sections.has('base');
  return element('div', { className: 'assay-scrollbar', style: styles.root },
    element('header', { style: styles.heading }, element('h2', { style: styles.title }, group.label), element('span', { style: styles.type }, `${group.type ?? 'token'} · ${group.tokens.length}`)),
    ...[...sections].map(([section, tokens]) => element('section', { key: section, style: styles.section },
      showSectionTitles ? element('h3', { style: styles.sectionTitle }, displayName(section)) : null,
      element('div', { style: styles.grid }, ...tokens.map((token) => element('article', { key: token.name, style: styles.card, title: token.name },
        element(TokenSample, { token, group }),
        token.theme || token.section ? element('span', { style: styles.tokenContext }, [token.theme, token.section].filter((value): value is string => Boolean(value)).map(displayName).join(' · ')) : null,
        element('span', { style: styles.name }, token.label), element('span', { style: styles.value }, token.value),
      ))),
    )),
  );
}
