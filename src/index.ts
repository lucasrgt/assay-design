import { archetype, AvpFail, criterion, mechanical, runVerification, type Verdict } from 'avp-assay';
import { parse } from 'smol-toml';

type Dict = Record<string, unknown>;
export type Tier = 'atom' | 'molecule' | 'organism' | 'template';
export type FindingCategory = 'components' | 'properties' | 'composition' | 'semantics' | 'coverage';
export interface ComponentContract { name: string; tier: Tier; variants: string[]; states: string[]; roles: string[]; requiredSlots: string[] }
export interface SurfaceContract { name: string; template?: string; requiredComponents: string[]; states: string[]; themes: string[]; viewports: string[]; locales: string[] }
export interface DesignContract {
  schema: 1; name: string; tokenFiles: string[]; components: ComponentContract[]; surfaces: SurfaceContract[];
  icons: Record<string, string[]>; policies: { maxPrimaryActionsPerRegion: number; buttonLabelPattern?: string; maxHeadingJump: number; requireIconIntent: boolean };
  links: Record<string, string[]>; tokenNames?: string[];
}
export interface EvidenceNode {
  component: string; variant?: string; state?: string; role?: string; action?: string; icon?: string; iconIntent?: string;
  text?: string; region?: string; headingLevel?: number; tokens?: string[]; slots?: string[];
}
export interface DesignEvidence {
  surface: string; source?: string; nodes: EvidenceNode[]; tokens?: string[];
  coverage?: { states?: string[]; themes?: string[]; viewports?: string[]; locales?: string[] };
}
export interface Finding { category: FindingCategory; path: string; message: string }

const record = (value: unknown, label: string): Dict => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a table`);
  return value as Dict;
};
const strings = (value: unknown, label: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`${label} must be an array of strings`);
  return value as string[];
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
};
const optionalText = (value: unknown, label: string): string | undefined => value === undefined ? undefined : text(value, label);

export function parseContract(source: string): DesignContract {
  const raw = record(parse(source), 'contract');
  if (raw.schema !== 1) throw new Error('schema must be 1');
  const componentRows = raw.components ?? [];
  const surfaceRows = raw.surfaces ?? [];
  if (!Array.isArray(componentRows) || !Array.isArray(surfaceRows)) throw new Error('components and surfaces must be arrays of tables');
  const seen = new Set<string>();
  const components = componentRows.map((value, index): ComponentContract => {
    const row = record(value, `components[${index}]`);
    const name = text(row.name, `components[${index}].name`);
    const tier = text(row.tier, `components[${index}].tier`) as Tier;
    if (!['atom', 'molecule', 'organism', 'template'].includes(tier)) throw new Error(`${name}.tier is not an Atomic Design tier`);
    if (seen.has(name)) throw new Error(`component ${name} is declared twice`);
    seen.add(name);
    return { name, tier, variants: strings(row.variants, `${name}.variants`), states: strings(row.states, `${name}.states`), roles: strings(row.roles, `${name}.roles`), requiredSlots: strings(row.required_slots, `${name}.required_slots`) };
  });
  const surfaces = surfaceRows.map((value, index): SurfaceContract => {
    const row = record(value, `surfaces[${index}]`);
    const name = text(row.name, `surfaces[${index}].name`);
    const template = optionalText(row.template, `${name}.template`);
    return { name, ...(template ? { template } : {}), requiredComponents: strings(row.required_components, `${name}.required_components`), states: strings(row.states, `${name}.states`), themes: strings(row.themes, `${name}.themes`), viewports: strings(row.viewports, `${name}.viewports`), locales: strings(row.locales, `${name}.locales`) };
  });
  const policies = raw.policies === undefined ? {} : record(raw.policies, 'policies');
  const icons = Object.fromEntries(Object.entries(raw.icons === undefined ? {} : record(raw.icons, 'icons')).map(([intent, value]) => [intent, strings(record(value, `icons.${intent}`).allowed, `icons.${intent}.allowed`)]));
  const links = Object.fromEntries(Object.entries(raw.links === undefined ? {} : record(raw.links, 'links')).map(([relation, value]) => [relation, strings(value, `links.${relation}`)]));
  const maxPrimaryActionsPerRegion = Number(policies.max_primary_actions_per_region ?? 1);
  const maxHeadingJump = Number(policies.max_heading_jump ?? 1);
  if (!Number.isInteger(maxPrimaryActionsPerRegion) || maxPrimaryActionsPerRegion < 0) throw new Error('max_primary_actions_per_region must be a non-negative integer');
  if (!Number.isInteger(maxHeadingJump) || maxHeadingJump < 0) throw new Error('max_heading_jump must be a non-negative integer');
  const buttonLabelPattern = optionalText(policies.button_label_pattern, 'policies.button_label_pattern');
  return {
    schema: 1, name: text(raw.name, 'name'), tokenFiles: strings(raw.token_files, 'token_files'), components, surfaces, icons, links,
    policies: { maxPrimaryActionsPerRegion, maxHeadingJump, requireIconIntent: policies.require_icon_intent !== false, ...(buttonLabelPattern ? { buttonLabelPattern } : {}) },
  };
}

const missing = (actual: readonly string[] | undefined, required: readonly string[]) => required.filter((item) => !actual?.includes(item));
export function inspectEvidence(contract: DesignContract, evidence: DesignEvidence): Finding[] {
  const findings: Finding[] = [];
  const components = new Map(contract.components.map((component) => [component.name, component]));
  const add = (category: FindingCategory, path: string, message: string) => findings.push({ category, path, message });
  evidence.nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    const spec = components.get(node.component);
    if (!spec) return add('components', path, `Use a declared component instead of "${node.component}"`);
    for (const [property, value, allowed] of [['variant', node.variant, spec.variants], ['state', node.state, spec.states], ['role', node.role, spec.roles]] as const) {
      if (value && !allowed.includes(value)) add('properties', `${path}.${property}`, `"${value}" is outside ${node.component}.${property}s`);
    }
    for (const slot of missing(node.slots, spec.requiredSlots)) add('composition', path, `${node.component} requires slot "${slot}"`);
    if (node.icon) {
      if (contract.policies.requireIconIntent && !node.iconIntent) add('semantics', path, `Icon "${node.icon}" needs an intent`);
      else if (node.iconIntent && !contract.icons[node.iconIntent]?.includes(node.icon)) add('semantics', path, `Icon "${node.icon}" does not express intent "${node.iconIntent}"`);
    }
    if (contract.policies.buttonLabelPattern && node.component === 'button' && node.text && !new RegExp(contract.policies.buttonLabelPattern, 'u').test(node.text)) add('semantics', `${path}.text`, `Button label "${node.text}" violates the content pattern`);
    for (const token of node.tokens ?? []) if (contract.tokenNames && !contract.tokenNames.includes(token)) add('coverage', `${path}.tokens`, `Token "${token}" is not in the DTCG sources`);
  });
  const regions = Map.groupBy(evidence.nodes.filter((node) => node.action === 'primary'), (node) => node.region ?? 'page');
  for (const [region, actions] of regions) if (actions.length > contract.policies.maxPrimaryActionsPerRegion) add('semantics', `region.${region}`, `${actions.length} primary actions exceed the limit of ${contract.policies.maxPrimaryActionsPerRegion}`);
  let heading = 0;
  for (const [index, node] of evidence.nodes.entries()) if (node.headingLevel) {
    if (heading && node.headingLevel - heading > contract.policies.maxHeadingJump) add('semantics', `nodes[${index}].headingLevel`, `Heading jumps from h${heading} to h${node.headingLevel}`);
    heading = node.headingLevel;
  }
  const surface = contract.surfaces.find((item) => item.name === evidence.surface);
  for (const token of evidence.tokens ?? []) if (contract.tokenNames && !contract.tokenNames.includes(token)) add('coverage', 'tokens', `Token "${token}" is not in the DTCG sources`);
  if (!surface) add('coverage', 'surface', `Surface "${evidence.surface}" is not declared`);
  else {
    for (const component of missing(evidence.nodes.map((node) => node.component), surface.requiredComponents)) add('coverage', 'surface', `Surface requires component "${component}"`);
    for (const axis of ['states', 'themes', 'viewports', 'locales'] as const) for (const value of missing(evidence.coverage?.[axis], surface[axis])) add('coverage', `coverage.${axis}`, `Missing ${axis.slice(0, -1)} "${value}"`);
  }
  return findings;
}

type DesignExpect = { clear(category: FindingCategory): void };
const designArchetype = archetype('design-system-conformance', '0.1.0', () => {
  const check = (id: FindingCategory, statement: string) => criterion(`design.${id}`, statement, { substrate: 'static' }, mechanical<DesignExpect>(({ expect }) => expect.clear(id)));
  check('components', 'Every rendered component belongs to the design-system vocabulary');
  check('properties', 'Component variants, states, and roles are declared');
  check('composition', 'Required component slots are present');
  check('semantics', 'Content, action hierarchy, headings, and icons follow policy');
  check('coverage', 'Surfaces and tokens satisfy their declared coverage');
});

export function verifyEvidence(contract: DesignContract, evidence: DesignEvidence): Promise<Verdict> {
  const findings = inspectEvidence(contract, evidence);
  return runVerification(evidence.surface, designArchetype, {
    probe: () => ({ act: async () => undefined, expect: { clear(category) { const failures = findings.filter((item) => item.category === category); if (failures.length) throw new AvpFail(failures.map((item) => `${item.path}: ${item.message}`).join('; '), failures); } } satisfies DesignExpect }),
  });
}

export function collectDocument(root: ParentNode, surface: string, coverage?: DesignEvidence['coverage']): DesignEvidence {
  const selector = '[data-ds],[data-ui]';
  const elements = [...(root instanceof Element && root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  const nodes = elements.map((element): EvidenceNode => {
    const value = (name: string) => element.getAttribute(`data-ds-${name}`) ?? element.getAttribute(`data-ui-${name}`) ?? element.getAttribute(`data-${name}`) ?? undefined;
    const component = element.getAttribute('data-ds') ?? element.getAttribute('data-ui') ?? '';
    const region = element.closest('[data-ds-region],[data-ui-region]');
    const [variant, state, role, action, icon, iconIntent] = ['variant', 'state', 'role', 'action', 'icon', 'icon-intent'].map(value);
    const regionName = region?.getAttribute('data-ds-region') ?? region?.getAttribute('data-ui-region') ?? undefined;
    const slots = [...element.querySelectorAll('[data-ds-slot],[data-ui-slot]')].map((slot) => slot.getAttribute('data-ds-slot') ?? slot.getAttribute('data-ui-slot') ?? '').filter(Boolean);
    const headingLevel = /^H[1-6]$/.test(element.tagName) ? Number(element.tagName[1]) : undefined;
    const tokens = value('token')?.split(/\s+/).filter(Boolean);
    return { component, ...(variant ? { variant } : {}), ...(state ? { state } : {}), ...(role ? { role } : {}), ...(action ? { action } : {}), ...(icon ? { icon } : {}), ...(iconIntent ? { iconIntent } : {}), ...(element.textContent?.trim() ? { text: element.textContent.trim() } : {}), ...(regionName ? { region: regionName } : {}), ...(headingLevel ? { headingLevel } : {}), ...(tokens?.length ? { tokens } : {}), ...(slots.length ? { slots } : {}) };
  });
  return { surface, nodes, ...(coverage ? { coverage } : {}) };
}

export function designContext(contract: DesignContract) {
  const root = `design://contract/${encodeURIComponent(contract.name)}`;
  return {
    schema: 1,
    contract: { name: contract.name, components: contract.components, surfaces: contract.surfaces, policies: contract.policies, tokens: contract.tokenNames ?? contract.tokenFiles },
    graph: {
      nodes: [{ uri: root, kind: 'design-contract' }, ...contract.components.map((item) => ({ uri: `design://component/${encodeURIComponent(item.name)}`, kind: item.tier }))],
      edges: [...contract.components.map((item) => ({ from: root, relation: 'contains', to: `design://component/${encodeURIComponent(item.name)}` })), ...Object.entries(contract.links).flatMap(([relation, targets]) => targets.map((to) => ({ from: root, relation, to })))],
    },
  };
}
