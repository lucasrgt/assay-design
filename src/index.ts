import { archetype, AvpFail, criterion, mechanical, runVerification, type Verdict } from 'avp-assay';
import { parse } from 'smol-toml';
import { auditPopulation } from './coherence.js';
import { flattenTokenDocuments, type DesignTokenMeta } from './tokens.js';
export type { DesignTokenMeta } from './tokens.js';

type Dict = Record<string, unknown>;
export type Tier = 'atom' | 'molecule' | 'organism' | 'template';
export type DesignGroupRule = { label: string; include: string[] };
export type DesignGroups = { sharedLabel: string; foundations: DesignGroupRule[]; composition: DesignGroupRule[] };
export interface StyleBinding { property: string; tokens: string[]; variant?: string; appearance?: string; state?: string; role?: string; slot?: string }
export type FindingCategory = 'components' | 'properties' | 'composition' | 'semantics' | 'coverage' | 'tokens' | 'scale' | 'coherence';
export interface ComponentContract {
  name: string; tier: Tier; parts: string[]; variants: string[]; appearances: string[]; states: string[]; roles: string[]; requiredSlots: string[]; styleBindings: StyleBinding[];
  inlineSizing?: 'bounded' | 'full'; allowFullWidth: boolean;
}
export interface SurfaceContract { name: string; template?: string; requiredComponents: string[]; states: string[]; themes: string[]; viewports: string[]; locales: string[] }
export interface DesignContract {
  schema: 1; name: string; extends: string[]; tokenFiles: string[]; components: ComponentContract[]; surfaces: SurfaceContract[];
  icons: Record<string, string[]>; policies: { maxPrimaryActionsPerRegion: number; buttonLabelPattern?: string; maxHeadingJump: number; requireIconIntent: boolean };
  links: Record<string, string[]>; scales: Record<string, string[]>; extensionPoints: string[]; groups: DesignGroups; tokens?: Record<string, string>; tokenMeta?: Record<string, DesignTokenMeta>;
}
/** One lossy, ephemeral fact emitted by an adapter for linting. It is not a UI model or codegen input. */
export interface StyleDeclaration {
  origin: string; property: string; value: string; unresolved?: string[];
  subject?: string; context?: string; tokenCandidates?: string[]; literal?: boolean; theme?: string;
  component?: string; variant?: string; appearance?: string; state?: string; role?: string; slot?: string;
}
export interface EvidenceNode {
  component: string; variant?: string; appearance?: string; state?: string; role?: string; action?: string; icon?: string; iconIntent?: string;
  text?: string; region?: string; headingLevel?: number; tokens?: string[]; slots?: string[]; parent?: number;
  widthMode?: 'bounded' | 'full'; widthFlag?: string; inlineSize?: number; containerInlineSize?: number;
}
export interface DesignEvidence {
  surface: string; source?: string; nodes: EvidenceNode[]; tokens?: string[]; styles?: StyleDeclaration[];
  coverage?: { states?: string[]; themes?: string[]; viewports?: string[]; locales?: string[] };
}
export interface Finding { rule: string; category: FindingCategory; path: string; message: string }

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
const tiers: Tier[] = ['atom', 'molecule', 'organism', 'template'];
const defaultScales: Record<string, string[]> = {
  space: ['padding', 'margin', 'gap', 'inset', 'top', 'right', 'bottom', 'left'], radius: ['border-radius'], fontSize: ['font-size'],
  motion: ['transition', 'transition-duration', 'animation-duration'], color: ['color', 'background', 'border', 'outline', 'fill', 'stroke'],
};
const designGroups = (value: unknown): DesignGroups => {
  const groups = value === undefined ? {} : record(value, 'groups');
  const rules = (key: 'foundations' | 'composition'): DesignGroupRule[] => {
    const rows = groups[key] ?? [];
    if (!Array.isArray(rows)) throw new Error(`groups.${key} must be an array of tables`);
    return rows.map((value, index) => { const row = record(value, `groups.${key}[${index}]`); return { label: text(row.label, `groups.${key}[${index}].label`), include: strings(row.include, `groups.${key}[${index}].include`) }; });
  };
  return { sharedLabel: optionalText(groups.shared_label, 'groups.shared_label') ?? 'Shared', foundations: rules('foundations'), composition: rules('composition') };
};
type ContractDeclarations = { policies: string[]; scales: string[]; groups: boolean };
const contractDeclarations = new WeakMap<DesignContract, ContractDeclarations>();
const declarationsOf = (contract: DesignContract): ContractDeclarations => contractDeclarations.get(contract) ?? { policies: Object.keys(contract.policies), scales: Object.keys(contract.scales), groups: true };

export function parseContract(source: string, tokenDocuments: readonly unknown[] = []): DesignContract {
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
    if (!tiers.includes(tier)) throw new Error(`${name}.tier is not an Atomic Design tier`);
    if (seen.has(name)) throw new Error(`component ${name} is declared twice`);
    seen.add(name);
    const inlineSizing = optionalText(row.inline_sizing, `${name}.inline_sizing`) as ComponentContract['inlineSizing'];
    const bindingRows = row.style_bindings ?? [];
    if (!Array.isArray(bindingRows)) throw new Error(`${name}.style_bindings must be an array of tables`);
    const styleBindings = bindingRows.map((value, bindingIndex): StyleBinding => {
      const binding = record(value, `${name}.style_bindings[${bindingIndex}]`);
      const optional = (key: string) => optionalText(binding[key], `${name}.style_bindings[${bindingIndex}].${key}`);
      return { property: text(binding.property, `${name}.style_bindings[${bindingIndex}].property`), tokens: strings(binding.tokens, `${name}.style_bindings[${bindingIndex}].tokens`), ...Object.fromEntries(['variant', 'appearance', 'state', 'role', 'slot'].flatMap((key) => { const value = optional(key); return value ? [[key, value]] : []; })) } as StyleBinding;
    });
    if (inlineSizing && !['bounded', 'full'].includes(inlineSizing)) throw new Error(`${name}.inline_sizing must be "bounded" or "full"`);
    if (row.allow_full_width !== undefined && typeof row.allow_full_width !== 'boolean') throw new Error(`${name}.allow_full_width must be a boolean`);
    return { name, tier, parts: strings(row.parts, `${name}.parts`), variants: strings(row.variants, `${name}.variants`), appearances: strings(row.appearances, `${name}.appearances`), states: strings(row.states, `${name}.states`), roles: strings(row.roles, `${name}.roles`), requiredSlots: strings(row.required_slots, `${name}.required_slots`), styleBindings, ...(inlineSizing ? { inlineSizing } : {}), allowFullWidth: row.allow_full_width === true };
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
  const scales = raw.scales === undefined ? defaultScales : Object.fromEntries(Object.entries(record(raw.scales, 'scales')).map(([group, value]) => [group, strings(value, `scales.${group}`)]));
  const extendsFrom = raw.extends === undefined ? [] : typeof raw.extends === 'string' ? [text(raw.extends, 'extends')] : strings(raw.extends, 'extends');
  const inheritance = raw.inheritance === undefined ? {} : record(raw.inheritance, 'inheritance');
  const declaredPolicies = [
    ['max_primary_actions_per_region', 'maxPrimaryActionsPerRegion'],
    ['button_label_pattern', 'buttonLabelPattern'],
    ['max_heading_jump', 'maxHeadingJump'],
    ['require_icon_intent', 'requireIconIntent'],
  ].filter(([source]) => source! in policies).map(([, target]) => target!);
  const contract: DesignContract = {
    schema: 1, name: text(raw.name, 'name'), extends: extendsFrom, tokenFiles: strings(raw.token_files, 'token_files'), components, surfaces, icons, links, scales, groups: designGroups(raw.groups), extensionPoints: strings(inheritance.extension_points, 'inheritance.extension_points'),
    policies: { maxPrimaryActionsPerRegion, maxHeadingJump, requireIconIntent: policies.require_icon_intent !== false, ...(buttonLabelPattern ? { buttonLabelPattern } : {}) },
  };
  if (tokenDocuments.length) Object.assign(contract, flattenTokenDocuments(tokenDocuments));
  contractDeclarations.set(contract, { policies: declaredPolicies, scales: raw.scales === undefined ? [] : Object.keys(scales), groups: raw.groups !== undefined });
  if (!extendsFrom.length) assertComposition(contract);
  return contract;
}

/** Validate Atomic composition after the full language (including extends) is assembled. */
export function assertComposition(contract: DesignContract): void {
  const componentByName = new Map(contract.components.map((component) => [component.name, component]));
  for (const component of contract.components) for (const part of component.parts) {
    const child = componentByName.get(part);
    if (!child) throw new Error(`${component.name}.parts references undeclared component "${part}"`);
    if (component.tier === 'atom' || tiers.indexOf(child.tier) > tiers.indexOf(component.tier)) throw new Error(`${component.name} cannot compose ${child.tier} "${part}"`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visiting.has(name)) throw new Error(`Atomic Design composition cycle includes "${name}"`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const part of componentByName.get(name)?.parts ?? []) visit(part);
    visiting.delete(name); visited.add(name);
  };
  for (const component of contract.components) visit(component.name);
  const surfaceNames = new Set<string>();
  for (const surface of contract.surfaces) {
    if (surfaceNames.has(surface.name)) throw new Error(`surface ${surface.name} is declared twice`);
    surfaceNames.add(surface.name);
    if (surface.template && componentByName.get(surface.template)?.tier !== 'template') throw new Error(`${surface.name}.template must reference a declared template`);
    for (const required of surface.requiredComponents) if (!componentByName.has(required)) throw new Error(`${surface.name}.required_components references undeclared component "${required}"`);
  }
}

const byName = <T extends { name: string }>(base: readonly T[], overlay: readonly T[]) => {
  const map = new Map(base.map((item) => [item.name, item]));
  for (const item of overlay) map.set(item.name, item);
  return [...map.values()];
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const pick = <T extends Record<string, unknown>>(source: T, keys: readonly string[]) => Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
const guardOverrides = (base: DesignContract, overlay: DesignContract, explicitOnly: boolean) => {
  const allowed = new Set(base.extensionPoints);
  const reject = (key: string) => { if (!allowed.has(key)) throw new Error(`local contract cannot override sealed ${key}; declare it in the base inheritance.extension_points`); };
  const compareNamed = <T extends { name: string }>(kind: string, inherited: readonly T[], local: readonly T[]) => {
    const localByName = new Map(local.map((item) => [item.name, item]));
    for (const item of inherited) { const candidate = localByName.get(item.name); if (candidate && !same(item, candidate)) reject(`${kind}:${item.name}`); }
  };
  compareNamed('component', base.components, overlay.components);
  compareNamed('surface', base.surfaces, overlay.surfaces);
  for (const [name, value] of Object.entries(overlay.icons)) if (name in base.icons && !same(base.icons[name], value)) reject(`icon:${name}`);
  const declarations = declarationsOf(overlay);
  const policies = explicitOnly ? pick(overlay.policies, declarations.policies) : overlay.policies;
  const scales = explicitOnly ? pick(overlay.scales, declarations.scales) : overlay.scales;
  for (const [name, value] of Object.entries(policies)) if (name in base.policies && !same(base.policies[name as keyof DesignContract['policies']], value)) reject(`policy:${name}`);
  for (const [name, value] of Object.entries(scales)) if (name in base.scales && !same(base.scales[name], value)) reject(`scale:${name}`);
  for (const [name, value] of Object.entries(overlay.tokens ?? {})) if (base.tokens && name in base.tokens && base.tokens[name] !== value) reject(`token:${name}`);
};

/** Merge an app into its org language. Inherited definitions stay sealed unless explicitly extensible. */
export function mergeContracts(base: DesignContract, overlay: DesignContract, explicitOnly = false): DesignContract {
  guardOverrides(base, overlay, explicitOnly);
  const baseDeclarations = declarationsOf(base);
  const overlayDeclarations = declarationsOf(overlay);
  const policies = explicitOnly ? pick(overlay.policies, overlayDeclarations.policies) : overlay.policies;
  const scales = explicitOnly ? pick(overlay.scales, overlayDeclarations.scales) : overlay.scales;
  const baseGroups = base.groups ?? { sharedLabel: 'Shared', foundations: [], composition: [] };
  const overlayGroups = overlay.groups ?? { sharedLabel: 'Shared', foundations: [], composition: [] };
  const merged: DesignContract = {
    schema: 1,
    name: overlay.name,
    extends: overlay.extends,
    tokenFiles: [...new Set([...base.tokenFiles, ...overlay.tokenFiles])],
    components: byName(base.components, overlay.components),
    surfaces: byName(base.surfaces, overlay.surfaces),
    icons: { ...base.icons, ...overlay.icons },
    policies: { ...base.policies, ...policies } as DesignContract['policies'],
    links: Object.fromEntries([...new Set([...Object.keys(base.links), ...Object.keys(overlay.links)])].map((key) => [key, [...new Set([...(base.links[key] ?? []), ...(overlay.links[key] ?? [])])]])),
    scales: { ...base.scales, ...scales } as Record<string, string[]>,
    groups: {
      sharedLabel: overlayDeclarations.groups ? overlayGroups.sharedLabel : baseGroups.sharedLabel,
      foundations: [...baseGroups.foundations, ...overlayGroups.foundations],
      composition: [...baseGroups.composition, ...overlayGroups.composition],
    },
    extensionPoints: [...new Set([...base.extensionPoints, ...overlay.extensionPoints])],
    tokens: { ...base.tokens, ...overlay.tokens },
    tokenMeta: { ...base.tokenMeta, ...overlay.tokenMeta },
  };
  contractDeclarations.set(merged, {
    policies: [...new Set([...baseDeclarations.policies, ...overlayDeclarations.policies])],
    scales: [...new Set([...baseDeclarations.scales, ...overlayDeclarations.scales])],
    groups: baseDeclarations.groups || overlayDeclarations.groups,
  });
  return merged;
}

export function inspectStyles(contract: DesignContract, declarations: readonly StyleDeclaration[]): Finding[] {
  if (!declarations.length) return [];
  return auditPopulation(contract, declarations).findings;
}

export function collectStylesheet(sheets: string | Record<string, string>): StyleDeclaration[] {
  const entries = typeof sheets === 'string' ? [['stylesheet', sheets] as const] : Object.entries(sheets);
  const bindings = new Map(entries.flatMap(([, css]) => [...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map(([, name = '', value = '']) => [name, value.trim()] as const)));
  const declarations: StyleDeclaration[] = [];
  for (const [source, css] of entries) for (const [, selector = '', body = ''] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const [, property = '', raw = ''] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      if (property.startsWith('--')) continue;
      const unresolved: string[] = [];
      let value = raw.trim();
      for (let depth = 0; depth < 8 && value.includes('var('); depth += 1) value = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name: string, fallback: string | undefined) => bindings.get(name) ?? (fallback?.trim() || (unresolved.push(name), 'unresolved')));
      const subject = selector.trim().replace(/\s+/g, ' ');
      const literal = /^(?:#|rgba?\(|hsla?\(|oklch\(|lab\(|lch\(|color\()/i.test(raw.trim());
      declarations.push({ origin: `${source} ${subject}`, subject, property, value, ...(unresolved.length ? { unresolved } : {}), ...(literal ? { literal: true } : {}) });
    }
  }
  return declarations;
}

const missing = (actual: readonly string[] | undefined, required: readonly string[]) => required.filter((item) => !actual?.includes(item));
export function inspectEvidence(contract: DesignContract, evidence: DesignEvidence): Finding[] {
  const findings: Finding[] = [];
  const components = new Map(contract.components.map((component) => [component.name, component]));
  const add = (rule: string, category: FindingCategory, path: string, message: string) => findings.push({ rule, category, path, message });
  if (!evidence.nodes.length) add('coverage/no-component-observations', 'coverage', 'nodes', 'No component observations were supplied for this surface');
  evidence.nodes.forEach((node, index) => {
    const path = `nodes[${index}]`;
    const spec = components.get(node.component);
    if (!spec) return add('atomic/unknown-component', 'components', path, `Use a declared component instead of "${node.component}"`);
    if (node.parent !== undefined) {
      if (!Number.isInteger(node.parent) || node.parent < 0 || node.parent >= evidence.nodes.length || node.parent === index) add('atomic/invalid-parent', 'composition', `${path}.parent`, `Parent index "${node.parent}" is invalid`);
      else {
        const parent = components.get(evidence.nodes[node.parent]!.component);
        if (parent && (parent.tier === 'atom' || tiers.indexOf(spec.tier) > tiers.indexOf(parent.tier))) add('atomic/illegal-tier-nesting', 'composition', `${path}.parent`, `${parent.tier} "${parent.name}" cannot contain ${spec.tier} "${spec.name}"`);
        else if (parent?.parts.length && !parent.parts.includes(spec.name)) add('atomic/undeclared-part', 'composition', `${path}.parent`, `${parent.name} does not declare "${spec.name}" as a part`);
      }
    }
    for (const [property, value, allowed] of [['variant', node.variant, spec.variants], ['appearance', node.appearance, spec.appearances], ['state', node.state, spec.states], ['role', node.role, spec.roles]] as const) {
      if (value && !allowed.includes(value)) add(`component/undeclared-${property}`, 'properties', `${path}.${property}`, `"${value}" is outside ${node.component}.${property}s`);
    }
    if (node.widthFlag && node.widthFlag !== 'full') add('component/undeclared-width-mode', 'properties', `${path}.widthFlag`, `"${node.widthFlag}" is not a supported width flag`);
    if (node.widthFlag === 'full' && !spec.allowFullWidth) add('component/full-width-not-allowed', 'properties', `${path}.widthFlag`, `${node.component} does not allow the full-width exception`);
    if (spec.inlineSizing && node.widthMode) {
      const expected = node.widthFlag === 'full' && spec.allowFullWidth ? 'full' : spec.inlineSizing;
      if (node.widthMode !== expected) add('coherence/inline-sizing', 'coherence', `${path}.widthMode`, `${node.component} renders ${node.widthMode} but its contract expects ${expected}${node.widthMode === 'full' && !node.widthFlag ? '; declare data-ds-width="full" only for a sanctioned full-width instance' : ''}`);
    }
    for (const slot of missing(node.slots, spec.requiredSlots)) add('atomic/missing-slot', 'composition', path, `${node.component} requires slot "${slot}"`);
    if (node.icon) {
      if (contract.policies.requireIconIntent && !node.iconIntent) add('semantics/missing-icon-intent', 'semantics', path, `Icon "${node.icon}" needs an intent`);
      else if (node.iconIntent && !contract.icons[node.iconIntent]?.includes(node.icon)) add('semantics/icon-intent-mismatch', 'semantics', path, `Icon "${node.icon}" does not express intent "${node.iconIntent}"`);
    }
    if (contract.policies.buttonLabelPattern && node.component === 'button' && node.text && !new RegExp(contract.policies.buttonLabelPattern, 'u').test(node.text)) add('content/button-label', 'semantics', `${path}.text`, `Button label "${node.text}" violates the content pattern`);
    for (const token of node.tokens ?? []) if (contract.tokens && !(token in contract.tokens)) add('tokens/unknown-token', 'tokens', `${path}.tokens`, `Token "${token}" is not in the DTCG sources`);
  });
  const regions = Map.groupBy(evidence.nodes.filter((node) => node.action === 'primary'), (node) => node.region ?? 'page');
  for (const [region, actions] of regions) if (actions.length > contract.policies.maxPrimaryActionsPerRegion) add('hierarchy/primary-action-limit', 'semantics', `region.${region}`, `${actions.length} primary actions exceed the limit of ${contract.policies.maxPrimaryActionsPerRegion}`);
  let heading = 0;
  for (const [index, node] of evidence.nodes.entries()) if (node.headingLevel) {
    if (heading && node.headingLevel - heading > contract.policies.maxHeadingJump) add('hierarchy/heading-jump', 'semantics', `nodes[${index}].headingLevel`, `Heading jumps from h${heading} to h${node.headingLevel}`);
    heading = node.headingLevel;
  }
  const surface = contract.surfaces.find((item) => item.name === evidence.surface);
  for (const token of evidence.tokens ?? []) if (contract.tokens && !(token in contract.tokens)) add('tokens/unknown-token', 'tokens', 'tokens', `Token "${token}" is not in the DTCG sources`);
  if (!surface) add('coverage/unknown-surface', 'coverage', 'surface', `Surface "${evidence.surface}" is not declared`);
  else {
    for (const component of missing(evidence.nodes.map((node) => node.component), [...new Set([...surface.requiredComponents, ...(surface.template ? [surface.template] : [])])])) add('coverage/missing-component', 'coverage', 'surface', `Surface requires component "${component}"`);
    for (const axis of ['states', 'themes', 'viewports', 'locales'] as const) for (const value of missing(evidence.coverage?.[axis], surface[axis])) add('coverage/missing-axis', 'coverage', `coverage.${axis}`, `Missing ${axis.slice(0, -1)} "${value}"`);
  }
  findings.push(...inspectStyles(contract, evidence.styles ?? []));
  return findings;
}

type DesignExpect = { clear(category: FindingCategory): void };
const designArchetype = archetype('design-system-conformance', '0.2.0', () => {
  const check = (id: FindingCategory, statement: string) => criterion(`design.${id}`, statement, { substrate: 'static' }, mechanical<DesignExpect>(({ expect }) => expect.clear(id)));
  check('components', 'Every rendered component belongs to the design-system vocabulary');
  check('properties', 'Component variants, states, and roles are declared');
  check('composition', 'Atomic hierarchy, declared parts, and required slots are respected');
  check('semantics', 'Content, action hierarchy, headings, and icons follow policy');
  check('coverage', 'Surfaces and observation axes satisfy their declared coverage');
  check('tokens', 'Every styled value resolves to a token in the design language');
  check('scale', 'Effective values lie on the declared scale or are promoted into it');
  check('coherence', 'Equivalent components reuse the same values for the same properties');
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
  const indices = new Map(elements.map((element, index) => [element, index]));
  const nodes = elements.map((element): EvidenceNode => {
    const value = (name: string) => element.getAttribute(`data-ds-${name}`) ?? element.getAttribute(`data-ui-${name}`) ?? element.getAttribute(`data-${name}`) ?? undefined;
    const component = element.getAttribute('data-ds') ?? element.getAttribute('data-ui') ?? '';
    const region = element.closest('[data-ds-region],[data-ui-region]');
    const [variant, appearance, state, role, action, icon, iconIntent, widthFlag] = ['variant', 'appearance', 'state', 'role', 'action', 'icon', 'icon-intent', 'width'].map(value);
    const regionName = region?.getAttribute('data-ds-region') ?? region?.getAttribute('data-ui-region') ?? undefined;
    const slots = [...element.querySelectorAll('[data-ds-slot],[data-ui-slot]')].filter((slot) => slot.parentElement?.closest(selector) === element).map((slot) => slot.getAttribute('data-ds-slot') ?? slot.getAttribute('data-ui-slot') ?? '').filter(Boolean);
    const headingLevel = /^H[1-6]$/.test(element.tagName) ? Number(element.tagName[1]) : undefined;
    const tokens = value('token')?.split(/\s+/).filter(Boolean);
    const parent = element.parentElement?.closest(selector);
    const parentIndex = parent ? indices.get(parent) : undefined;
    const view = element.ownerDocument.defaultView;
    const box = element.getBoundingClientRect();
    const container = element.parentElement?.getBoundingClientRect();
    const style = view?.getComputedStyle(element);
    const parentStyle = element.parentElement && view?.getComputedStyle(element.parentElement);
    const pixels = (raw?: string) => Number.parseFloat(raw || '0') || 0;
    const parentPadding = pixels(parentStyle?.paddingLeft) + pixels(parentStyle?.paddingRight);
    const containerInlineSize = container?.width ? Math.max(0, container.width - parentPadding) : 0;
    const cssFull = style?.width === '100%' || Boolean(element.getAttribute('style')?.match(/(?:^|;)\s*width\s*:\s*100%\s*(?:;|$)/i));
    const widthMode = box.width > 0 && containerInlineSize > 0 ? (Math.abs(box.width - containerInlineSize) <= 1 ? 'full' : 'bounded') : cssFull ? 'full' : undefined;
    return { component, ...(variant ? { variant } : {}), ...(appearance ? { appearance } : {}), ...(state ? { state } : {}), ...(role ? { role } : {}), ...(action ? { action } : {}), ...(icon ? { icon } : {}), ...(iconIntent ? { iconIntent } : {}), ...(element.textContent?.trim() ? { text: element.textContent.trim() } : {}), ...(regionName ? { region: regionName } : {}), ...(headingLevel ? { headingLevel } : {}), ...(tokens?.length ? { tokens } : {}), ...(slots.length ? { slots } : {}), ...(parentIndex !== undefined ? { parent: parentIndex } : {}), ...(widthFlag ? { widthFlag } : {}), ...(widthMode ? { widthMode } : {}), ...(box.width > 0 ? { inlineSize: box.width } : {}), ...(containerInlineSize > 0 ? { containerInlineSize } : {}) };
  });
  const styles = elements.flatMap((element, index): StyleDeclaration[] => {
    const component = nodes[index]?.component ?? '';
    const node = nodes[index]!;
    const context = [node.variant, node.appearance, node.state, node.role, node.headingLevel ? `h${node.headingLevel}` : undefined].filter(Boolean).join(':') || undefined;
    const targets = [element, ...element.querySelectorAll('[data-ds-slot],[data-ui-slot]')].filter((target) => target === element || target.parentElement?.closest(selector) === element);
    const theme = element.ownerDocument.documentElement.dataset.theme ?? (element.ownerDocument.documentElement.classList.contains('dark') ? 'dark' : 'light');
    return targets.flatMap((target): StyleDeclaration[] => {
      const view = target.ownerDocument.defaultView;
      const computed = view?.getComputedStyle(target);
      if (!computed) return [];
      const slot = target.getAttribute('data-ds-slot') ?? target.getAttribute('data-ui-slot');
      const subject = `${component}${slot ? `.slot.${slot}` : ''}`;
      const origin = `dom:${surface} ${subject}`;
      const directText = [...target.childNodes].some((child) => child.nodeType === 3 && child.textContent?.trim());
      const rows: [string, string][] = [];
      if (directText || slot || component === 'text' || component === 'icon') rows.push(['color', computed.color]);
      if (computed.backgroundColor && !['transparent', 'rgba(0, 0, 0, 0)'].includes(computed.backgroundColor)) rows.push(['background-color', computed.backgroundColor]);
      const borderColors = [...new Set((['top', 'right', 'bottom', 'left'] as const).flatMap((edge) => {
        const style = computed.getPropertyValue(`border-${edge}-style`);
        return !['', 'none', 'hidden'].includes(style) && Number.parseFloat(computed.getPropertyValue(`border-${edge}-width`)) > 0
          ? [computed.getPropertyValue(`border-${edge}-color`)]
          : [];
      }).filter((color) => color && !['transparent', 'rgba(0, 0, 0, 0)'].includes(color)))];
      if (borderColors.length === 1) rows.push(['border-color', borderColors[0]!]);
      else borderColors.forEach((color, edge) => rows.push([`border-${edge}-color`, color]));
      for (const property of ['min-height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'] as const) rows.push([property, computed.getPropertyValue(property)]);
      const radii = (['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const).map((corner) => computed.getPropertyValue(`border-${corner}-radius`));
      if (computed.borderRadius) rows.push(['border-radius', computed.borderRadius]);
      else if (radii.every((radius) => radius === radii[0])) rows.push(['border-radius', radii[0]!]);
      else radii.forEach((radius, corner) => rows.push([`border-${(['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const)[corner]}-radius`, radius]));
      if (computed.boxShadow && computed.boxShadow !== 'none') rows.push(['box-shadow', computed.boxShadow]);
      if (directText || slot || component === 'text') for (const property of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'] as const) rows.push([property, computed.getPropertyValue(property)]);
      return rows.filter(([, value]) => value).map(([property, value]) => ({ origin, subject, ...(context ? { context } : {}), property, value, theme, component, ...(node.variant ? { variant: node.variant } : {}), ...(node.appearance ? { appearance: node.appearance } : {}), ...(node.state ? { state: node.state } : {}), ...(node.role ? { role: node.role } : {}), ...(slot ? { slot } : {}) }));
    });
  });
  return { surface, nodes, ...(styles.length ? { styles } : {}), ...(coverage ? { coverage } : {}) };
}

export function designContext(contract: DesignContract) {
  const root = `design://contract/${encodeURIComponent(contract.name)}`;
  return {
    schema: 1,
    contract: { name: contract.name, components: contract.components, surfaces: contract.surfaces, policies: contract.policies, scales: contract.scales, groups: contract.groups, tokens: contract.tokens ?? contract.tokenFiles },
    graph: {
      nodes: [{ uri: root, kind: 'design-contract' }, ...contract.components.map((item) => ({ uri: `design://component/${encodeURIComponent(item.name)}`, kind: item.tier }))],
      edges: [...contract.components.map((item) => ({ from: root, relation: 'contains', to: `design://component/${encodeURIComponent(item.name)}` })), ...contract.components.flatMap((item) => item.parts.map((part) => ({ from: `design://component/${encodeURIComponent(item.name)}`, relation: 'composes', to: `design://component/${encodeURIComponent(part)}` }))), ...Object.entries(contract.links).flatMap(([relation, targets]) => targets.map((to) => ({ from: root, relation, to })))],
    },
  };
}
