/* global structuredClone */
export const DOMAINS = [
  ['analytics', 'metric-value', 'filter-bar', 'metrics-grid', 'analytics-shell', 'Create report'],
  ['commerce', 'price', 'cart-line', 'order-summary', 'checkout-shell', 'Place order'],
  ['healthcare', 'status-label', 'appointment-row', 'care-plan', 'patient-shell', 'Book visit'],
  ['fintech', 'money-value', 'order-field', 'order-ticket', 'trading-shell', 'Submit order'],
  ['government', 'helper-text', 'address-field', 'application-form', 'service-shell', 'Submit application'],
  ['media', 'timecode', 'tool-group', 'editing-canvas', 'editor-shell', 'Publish video'],
  ['education', 'progress-label', 'lesson-row', 'course-outline', 'learning-shell', 'Start lesson'],
  ['travel', 'fare-label', 'traveler-field', 'booking-summary', 'booking-shell', 'Reserve trip'],
].map(([id, atom, molecule, organism, template, actionLabel]) => ({ id, atom, molecule, organism, template, actionLabel }));

export function contractSource(domain) {
  return `schema = 1
name = "${domain.id}"
[policies]
max_primary_actions_per_region = 1
max_heading_jump = 1
button_label_pattern = "^[A-Z][^.!?]*$"
require_icon_intent = true
[[components]]
name = "button"
tier = "atom"
variants = ["primary", "secondary"]
states = ["default", "disabled"]
roles = ["button"]
required_slots = ["label"]
[[components]]
name = "${domain.atom}"
tier = "atom"
roles = ["content"]
[[components]]
name = "${domain.molecule}"
tier = "molecule"
parts = ["${domain.atom}"]
[[components]]
name = "${domain.organism}"
tier = "organism"
parts = ["${domain.molecule}", "button"]
[[components]]
name = "${domain.template}"
tier = "template"
parts = ["${domain.organism}"]
[[surfaces]]
name = "${domain.id}-primary"
template = "${domain.template}"
required_components = ["${domain.template}", "${domain.organism}", "${domain.molecule}", "${domain.atom}", "button"]
states = ["default", "empty", "error"]
themes = ["light", "dark"]
viewports = ["mobile", "desktop"]
locales = ["en", "pt-BR"]
`;
}

export function correctedEvidence(domain) {
  return {
    surface: `${domain.id}-primary`,
    source: `benchmark://${domain.id}/corrected`,
    nodes: [
      { component: domain.template },
      { component: domain.organism, parent: 0 },
      { component: domain.molecule, parent: 1 },
      { component: domain.atom, parent: 2, role: 'content', headingLevel: 1 },
      { component: 'button', parent: 1, variant: 'primary', state: 'default', role: 'button', action: 'primary', region: 'main', text: domain.actionLabel, slots: ['label'] },
    ],
    coverage: { states: ['default', 'empty', 'error'], themes: ['light', 'dark'], viewports: ['mobile', 'desktop'], locales: ['en', 'pt-BR'] },
  };
}

export function vulnerableEvidence(domain, category) {
  const evidence = structuredClone(correctedEvidence(domain));
  evidence.source = `benchmark://${domain.id}/vulnerable/${category}`;
  if (category === 'components') evidence.nodes.push({ component: 'legacy-widget' });
  if (category === 'properties') evidence.nodes[4].variant = 'loud';
  if (category === 'composition') evidence.nodes[3].parent = 0;
  if (category === 'semantics') evidence.nodes.push({ ...evidence.nodes[4], parent: 1 });
  if (category === 'coverage') evidence.coverage.locales = ['en'];
  return evidence;
}

export const CATEGORIES = ['components', 'properties', 'composition', 'semantics', 'coverage'];
