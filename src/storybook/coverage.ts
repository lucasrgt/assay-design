import React from 'react';
import { BrowserIcon, ComponentIcon, DocumentIcon, GridIcon, StatusFailIcon, StatusPassIcon } from '@storybook/icons';
import { Badge, Button, EmptyTabContent } from 'storybook/internal/components';
import { AtomIcon } from './atomic-navigation.js';
import { displayName, pageSelection } from './atomic-navigation-model.js';
import { coverageAxes, coverageSnapshot } from './coverage-model.js';
import type { DesignPanelPayload } from './shared.js';

const element = React.createElement;
type Tier = 'atom' | 'molecule' | 'organism' | 'template';
const tiers: Tier[] = ['atom', 'molecule', 'organism', 'template'];
const tierColors = { atom: 'var(--ad-agentic)', molecule: 'var(--ad-accent)', organism: 'var(--ad-positive)', template: 'var(--ad-warning)' };
const tierIcon = (tier: Tier) => tier === 'atom'
  ? element(AtomIcon, { style: { width: 15, height: 15, color: tierColors.atom } })
  : element(tier === 'molecule' ? ComponentIcon : tier === 'organism' ? GridIcon : DocumentIcon, { style: { width: 13, height: 13, color: tierColors[tier] } });

const styles = {
  root: { minHeight: '100%', color: 'var(--ad-text)' },
  heading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px 12px', borderBottom: '1px solid var(--ad-line)' },
  title: { margin: 0, color: 'var(--ad-text)', fontSize: 16, fontWeight: 700 },
  badges: { display: 'flex', alignItems: 'center', gap: 6 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(270px, 340px)', alignItems: 'stretch', minHeight: 'calc(100vh - 133px)' },
  primary: { minWidth: 0, padding: '16px 16px 28px' },
  evidence: { minWidth: 0, padding: 16, borderLeft: '1px solid var(--ad-line)' },
  section: { minWidth: 0, marginBottom: 22 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  sectionIdentity: { display: 'flex', alignItems: 'center', gap: 7 },
  sectionTitle: { margin: 0, color: 'var(--ad-text)', fontSize: 13, fontWeight: 700 },
  tierGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 },
  tierCard: { minWidth: 0, overflow: 'hidden', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  tierHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 38, padding: '6px 9px', borderBottom: '1px solid var(--ad-line)' },
  tierName: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700 },
  componentList: { display: 'flex', flexDirection: 'column' as const, gap: 2, padding: 5 },
  componentRow: { display: 'grid', gridTemplateColumns: '15px minmax(0, 1fr) auto', alignItems: 'center', gap: 7, width: '100%', minHeight: 31, padding: '4px 6px', color: 'var(--ad-text)', textAlign: 'left' as const },
  name: { minWidth: 0, overflow: 'hidden', fontSize: 11, fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  detail: { color: 'var(--ad-muted)', fontSize: 10, lineHeight: 1.4 },
  currentPanel: { padding: 10, border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', background: 'var(--ad-panel)' },
  currentHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  currentName: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, fontSize: 12, fontWeight: 700 },
  subheading: { margin: '12px 0 6px', color: 'var(--ad-muted)', fontSize: 9, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' as const },
  required: { display: 'flex', flexWrap: 'wrap' as const, gap: 5 },
  requiredItem: { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 25, padding: '3px 6px', border: '1px solid var(--ad-line)', borderRadius: 999, color: 'var(--ad-text)', fontSize: 10 },
  axisList: { display: 'flex', flexDirection: 'column' as const, gap: 7 },
  axis: { display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', alignItems: 'start', gap: 7 },
  axisLabel: { paddingTop: 3, color: 'var(--ad-muted)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const },
  axisValues: { display: 'flex', flexWrap: 'wrap' as const, gap: 4 },
  surfaces: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))', gap: 8 },
  surfaceCard: { display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch', gap: 8, width: '100%', minHeight: 76, padding: '9px 10px', border: '1px solid var(--ad-line)', borderRadius: 'var(--ad-radius)', color: 'var(--ad-text)', background: 'var(--ad-panel)', textAlign: 'left' as const },
  surfaceTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  identity: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 },
};
const statusIcon = (pass: boolean) => element(pass ? StatusPassIcon : StatusFailIcon, { style: { width: 13, height: 13, color: pass ? 'var(--ad-positive)' : 'var(--ad-negative)' } });

export function CoverageView({ payload, onSelect }: { payload: DesignPanelPayload; onSelect(name: string): void }) {
  const snapshot = coverageSnapshot(payload);
  const current = snapshot.current;
  const componentGroups = tiers.map((tier) => ({ tier, items: payload.contract.components.filter((component) => component.tier === tier) })).filter((group) => group.items.length);
  const declaredAxes = current ? coverageAxes.filter((axis) => current.axes[axis].declared.length) : [];
  return element('div', { style: styles.root },
    element('header', { style: styles.heading }, element('h2', { style: styles.title }, 'Coverage'), element('span', { style: styles.badges },
      element(Badge, { compact: true, status: snapshot.missingComponents.length ? 'negative' : 'positive' }, `${snapshot.mappedComponents.size}/${payload.contract.components.length} stories`),
      element(Badge, { compact: true, status: snapshot.mappedPageNames.size < payload.contract.surfaces.length ? 'negative' : 'positive' }, `${snapshot.mappedPageNames.size}/${payload.contract.surfaces.length} pages`),
    )),
    element('div', { style: styles.layout },
      element('main', { style: styles.primary },
        element('section', { style: styles.section },
          element('div', { style: styles.sectionHeader }, element('span', { style: styles.sectionIdentity }, element(ComponentIcon, { style: { width: 13, height: 13, color: 'var(--ad-accent)' } }), element('h3', { style: styles.sectionTitle }, 'Canonical stories')), element('span', { style: styles.detail }, 'Select a component to inspect it')),
          element('div', { style: styles.tierGrid }, ...componentGroups.map(({ tier, items }) => {
            const mapped = items.filter((component) => snapshot.mappedComponents.has(component.name)).length;
            return element('article', { key: tier, style: styles.tierCard },
              element('header', { style: styles.tierHeader }, element('span', { style: styles.tierName }, tierIcon(tier), `${displayName(tier)}s`), element(Badge, { compact: true, status: mapped === items.length ? 'positive' : 'neutral' }, `${mapped}/${items.length}`)),
              element('div', { style: styles.componentList }, ...items.map((component) => {
                const mappedStory = snapshot.mappedComponents.has(component.name);
                return element(Button, { key: component.name, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, onClick: () => onSelect(component.name), style: styles.componentRow }, statusIcon(mappedStory), element('span', { style: styles.name }, displayName(component.name)), element(Badge, { compact: true, status: mappedStory ? 'positive' : 'negative' }, mappedStory ? 'Story mapped' : 'No canonical story'));
              })),
            );
          })),
        ),
        element('section', { style: styles.section },
          element('div', { style: styles.sectionHeader }, element('span', { style: styles.sectionIdentity }, element(BrowserIcon, { style: { width: 13, height: 13, color: 'var(--ad-story)' } }), element('h3', { style: styles.sectionTitle }, 'Product surfaces')), element(Badge, { compact: true, status: 'neutral' }, payload.contract.surfaces.length)),
          element('div', { style: styles.surfaces }, ...snapshot.surfaces.map((surface) => element(Button, { key: surface.name, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, disabled: !surface.mapped, onClick: () => surface.mapped && onSelect(pageSelection(surface.name)), style: { ...styles.surfaceCard, ...(surface.current ? { borderColor: 'var(--ad-accent)', boxShadow: 'inset 3px 0 0 var(--ad-accent)' } : {}) } },
            element('span', { style: styles.surfaceTop }, element('span', { style: styles.identity }, statusIcon(surface.mapped), element('span', { style: styles.name }, displayName(surface.name))), element(Badge, { compact: true, status: surface.mapped ? 'positive' : 'negative' }, surface.mapped ? 'Page mapped' : 'No page story')),
            element('span', { style: styles.detail }, surface.current ? `${surface.covered}/${surface.required.length} required components rendered` : surface.mapped ? 'Open the canonical page' : 'Add a canonical page story'),
          ))),
        ),
      ),
      element('aside', { style: styles.evidence },
        element('div', { style: styles.sectionHeader }, element('span', { style: styles.sectionIdentity }, element(BrowserIcon, { style: { width: 13, height: 13, color: 'var(--ad-story)' } }), element('h3', { style: styles.sectionTitle }, 'Current evidence'))),
        current ? element('article', { style: { ...styles.currentPanel, borderColor: 'var(--ad-accent)' } },
          element('div', { style: styles.currentHeader }, element('span', { style: styles.currentName }, element(BrowserIcon, { style: { width: 14, height: 14, color: 'var(--ad-story)' } }), displayName(current.name)), element(Badge, { compact: true, status: current.mapped ? 'positive' : 'negative' }, current.mapped ? 'page mapped' : 'page unmapped')),
          element('div', { style: styles.subheading }, 'Required components'),
          current.required.length ? element('div', { style: styles.required }, ...current.required.map((component) => element(Button, { key: component.name, variant: 'ghost', size: 'small', padding: 'none', ariaLabel: false, onClick: () => onSelect(component.name), style: styles.requiredItem }, statusIcon(component.observed), displayName(component.name), component.uses ? element('span', { style: styles.detail }, `×${component.uses}`) : null))) : element('div', { style: styles.detail }, 'No required components declared.'),
          element('div', { style: styles.subheading }, 'Verification matrix'),
          declaredAxes.length ? element('div', { style: styles.axisList }, ...declaredAxes.map((axis) => {
            const values = current.axes[axis];
            return element('div', { key: axis, style: styles.axis }, element('span', { style: styles.axisLabel }, displayName(axis)), element('span', { style: styles.axisValues }, ...values.declared.map((value) => element(Badge, { key: value, compact: true, status: values.observed.includes(value) ? 'positive' : 'negative' }, value))));
          })) : element('div', { style: styles.detail }, 'No verification dimensions declared for this surface.'),
        ) : element(EmptyTabContent, { title: 'No rendered surface is active', description: 'Open a mapped page to inspect its requirements and verification matrix.' }),
      ),
    ),
  );
}
