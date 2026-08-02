import React from 'react';
import { AddonPanel } from 'storybook/internal/components';
import { addons, types } from 'storybook/manager-api';
import { ADDON_ID, VERDICT_EVENT } from './preview.js';

const PANEL_ID = `${ADDON_ID}/panel`;
type Result = { criterionId?: string; status?: string; reason?: string };
type Verdict = { outcome?: string; subject?: string; passed?: number; applicable?: number; acceptanceScore?: number; results?: Result[] };
const element = React.createElement;

const styles = {
  root: { minHeight: '100%', padding: 20, color: '#dfeae5', background: '#0b1411', fontFamily: 'Inter, ui-sans-serif, system-ui' },
  empty: { padding: 28, color: '#82978e', fontSize: 13 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 18 },
  eyebrow: { color: '#799087', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' as const },
  title: { margin: '6px 0 3px', color: '#eff7f3', fontSize: 19, fontWeight: 700 },
  subject: { color: '#799087', fontFamily: 'ui-monospace, monospace', fontSize: 11 },
  badge: { padding: '7px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '.08em' },
  score: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 },
  metric: { padding: '11px 12px', border: '1px solid #20342c', borderRadius: 8, background: '#101d18' },
  metricValue: { color: '#eff7f3', fontSize: 18, fontWeight: 750 },
  metricLabel: { marginTop: 2, color: '#6f857c', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' as const },
  list: { display: 'grid', gap: 6 },
  row: { display: 'grid', gridTemplateColumns: '18px minmax(150px, .55fr) 1fr', gap: 9, alignItems: 'start', padding: '9px 11px', border: '1px solid #1c2e27', borderRadius: 7, background: '#0e1915' },
  criterion: { color: '#cddbd5', fontFamily: 'ui-monospace, monospace', fontSize: 11 },
  reason: { color: '#80958c', fontSize: 11, lineHeight: 1.4 },
};

function Metric({ value, label }: { value: string | number; label: string }) {
  return element('div', { style: styles.metric }, element('div', { style: styles.metricValue }, value), element('div', { style: styles.metricLabel }, label));
}

function VerdictView({ verdict }: { verdict: Verdict }) {
  const passing = verdict.outcome === 'pass';
  const results = verdict.results ?? [];
  const score = Math.round((verdict.acceptanceScore ?? 0) * 100);
  return element('div', { style: styles.root },
    element('div', { style: styles.header },
      element('div', null,
        element('div', { style: styles.eyebrow }, 'Design contract'),
        element('div', { style: styles.title }, passing ? 'Implementation conforms' : 'Contract violations found'),
        element('div', { style: styles.subject }, verdict.subject ?? 'rendered story'),
      ),
      element('span', { style: { ...styles.badge, color: passing ? '#142409' : '#2a0c12', background: passing ? '#b8f34a' : '#fb7185' } }, passing ? 'PASS' : 'FAIL'),
    ),
    element('div', { style: styles.score },
      element(Metric, { value: `${score}%`, label: 'acceptance' }),
      element(Metric, { value: verdict.passed ?? 0, label: 'passed' }),
      element(Metric, { value: verdict.applicable ?? results.length, label: 'criteria' }),
    ),
    element('div', { style: styles.list }, ...results.map((result) => {
      const pass = result.status === 'pass';
      return element('div', { key: result.criterionId, style: styles.row },
        element('span', { style: { color: pass ? '#b8f34a' : '#fb7185', fontWeight: 900 } }, pass ? '✓' : '×'),
        element('span', { style: styles.criterion }, result.criterionId?.replace('design.', '') ?? 'criterion'),
        element('span', { style: styles.reason }, result.reason ?? result.status),
      );
    })),
  );
}

function Panel({ active }: { active: boolean }) {
  const [verdict, setVerdict] = React.useState<Verdict>();
  React.useEffect(() => { const channel = addons.getChannel(); channel.on(VERDICT_EVENT, setVerdict); return () => channel.off(VERDICT_EVENT, setVerdict); }, []);
  return element(AddonPanel, { active, children: verdict ? element(VerdictView, { verdict }) : element('div', { style: styles.empty }, 'Render a story with parameters.designHarness to evaluate its contract.') });
}

addons.register(ADDON_ID, () => addons.add(PANEL_ID, { type: types.PANEL, title: 'Design Contract', match: ({ viewMode }) => viewMode === 'story', render: ({ active }) => element(Panel, { active: Boolean(active) }) }));
