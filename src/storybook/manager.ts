import React from 'react';
import { AddonPanel } from 'storybook/internal/components';
import { addons, types } from 'storybook/manager-api';
import { ADDON_ID, VERDICT_EVENT } from './preview.js';

const PANEL_ID = `${ADDON_ID}/panel`;
function Panel({ active }: { active: boolean }) {
  const [verdict, setVerdict] = React.useState<Record<string, unknown>>();
  React.useEffect(() => { const channel = addons.getChannel(); channel.on(VERDICT_EVENT, setVerdict); return () => channel.off(VERDICT_EVENT, setVerdict); }, []);
  const color = verdict?.outcome === 'pass' ? '#15803d' : verdict ? '#b91c1c' : 'inherit';
  return React.createElement(AddonPanel, { active, children: React.createElement('pre', { style: { color, margin: 16, whiteSpace: 'pre-wrap' } }, verdict ? JSON.stringify(verdict, null, 2) : 'Render a story with parameters.designHarness to verify it.') });
}
addons.register(ADDON_ID, () => addons.add(PANEL_ID, { type: types.PANEL, title: 'Design', match: ({ viewMode }) => viewMode === 'story', render: ({ active }) => React.createElement(Panel, { active: Boolean(active) }) }));
