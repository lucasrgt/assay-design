import { parseContract, type DesignContract, type DesignEvidence } from '../src/index.js';

export const source = `schema = 1
name = "aurora"
token_files = ["tokens.json"]
[policies]
max_primary_actions_per_region = 1
max_heading_jump = 1
button_label_pattern = "^[A-Z][^.!?]*$"
require_icon_intent = true
[icons.add]
allowed = ["plus"]
[links]
exemplifies = ["rtw://design/button"]
establishes = ["wtw://design/decision"]
[[components]]
name = "button"
tier = "atom"
variants = ["primary", "secondary"]
states = ["default", "disabled"]
roles = ["button"]
required_slots = ["label"]
[[components]]
name = "card"
tier = "molecule"
required_slots = ["content"]
[[components]]
name = "text"
tier = "atom"
roles = ["heading", "body"]
[[surfaces]]
name = "dashboard"
template = "shell"
required_components = ["button", "card", "text"]
states = ["default", "empty"]
themes = ["light", "dark"]
viewports = ["mobile", "desktop"]
locales = ["en", "pt-BR"]
`;

export const contract = (): DesignContract => ({ ...parseContract(source), tokenNames: ['color.action.primary'] });
export const evidence = (): DesignEvidence => ({
  surface: 'dashboard',
  nodes: [
    { component: 'text', role: 'heading', headingLevel: 1, text: 'Dashboard' },
    { component: 'card', slots: ['content'] },
    { component: 'button', variant: 'primary', state: 'default', role: 'button', action: 'primary', region: 'toolbar', text: 'Create project', slots: ['label'], tokens: ['color.action.primary'] },
  ],
  coverage: { states: ['default', 'empty'], themes: ['light', 'dark'], viewports: ['mobile', 'desktop'], locales: ['en', 'pt-BR'] },
});
