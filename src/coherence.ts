import type { DesignContract, Finding, StyleDeclaration } from './index.js';

export type EscapeKind = 'systematic' | 'oneOff';
export interface CensusEntry {
  group: string;
  value: string;
  count: number;
  kind: EscapeKind;
  origins: string[];
}
export interface PopulationReport {
  census: CensusEntry[];
  findings: Finding[];
  systematicThreshold: number;
  coverage: AuditCoverage;
}

export interface AuditCoverage {
  sources: string[];
  observedSources: string[];
  unobservedSources: string[];
  observations: number;
  comparableSubjects: string[];
  status: 'complete' | 'partial' | 'empty';
}

export interface AuditOptions {
  systematicThreshold?: number;
  sources?: readonly string[];
  requireSubjects?: boolean;
}

const governs = (properties: readonly string[], property: string) => properties.some((entry) => property === entry || property.startsWith(`${entry}-`));
const literalsOf = (group: string, value: string) => [...value.matchAll(group === 'color' ? /#[0-9a-f]{3,8}\b|\brgba?\([^()]*\)/gi : /-?\d*\.?\d+(?:px|rem|em|ms|s)\b/g)].map(([literal]) => literal.toLowerCase());
const zero = /^-?0(px|rem|em|ms|s)?$/;
const utilityProperty: Record<string, string> = {
  p: 'padding', px: 'padding-inline', py: 'padding-block', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
  m: 'margin', mx: 'margin-inline', my: 'margin-block', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
  gap: 'gap', 'gap-x': 'column-gap', 'gap-y': 'row-gap', inset: 'inset', top: 'top', right: 'right', bottom: 'bottom', left: 'left',
  text: 'font-size', leading: 'line-height', tracking: 'letter-spacing', rounded: 'border-radius',
  w: 'width', h: 'height', 'min-w': 'min-width', 'min-h': 'min-height', 'max-w': 'max-width', 'max-h': 'max-height',
  bg: 'background-color', fill: 'fill', stroke: 'stroke', duration: 'transition-duration',
};

const utilityPattern = /(?:^|[\s"'`:])((?:(?:[a-z][\w-]*):)*!?-?(?:min-w|min-h|max-w|max-h|gap-x|gap-y|px|py|pt|pr|pb|pl|p|mx|my|mt|mr|mb|ml|m|gap|inset|top|right|bottom|left|text|leading|tracking|rounded|w|h|bg|fill|stroke|duration)-(?:\[[^\]\s]+\]|[a-z0-9][\w./-]*))/gi;
const utilityParts = /^!?(-?)(min-w|min-h|max-w|max-h|gap-x|gap-y|px|py|pt|pr|pb|pl|p|mx|my|mt|mr|mb|ml|m|gap|inset|top|right|bottom|left|text|leading|tracking|rounded|w|h|bg|fill|stroke|duration)-(.+)$/i;
const spaceUtilities = new Set(['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'gap', 'gap-x', 'gap-y', 'inset', 'top', 'right', 'bottom', 'left']);
const structuralValues = new Set(['auto', 'current', 'inherit', 'none', 'transparent']);
const paths = (group: string, value: string) => {
  const parts = value.split('-');
  const names = [
    value,
    parts.join('.'),
    ...parts.slice(1).flatMap((_, index) => [
      `${parts.slice(0, index + 1).join('.')}-${parts.slice(index + 1).join('-')}`,
      `${parts.slice(0, index + 1).join('-')}.${parts.slice(index + 1).join('-')}`,
    ]),
  ];
  return [...new Set(names.flatMap((name) => group === 'color' ? [`${group}.${name}`, `${group}.${name}.DEFAULT`] : [`${group}.${name}`]))];
};
const tokenCandidates = (utility: string, value: string) => {
  const base = value.split('/')[0]!;
  if (structuralValues.has(base) || (utility === 'bg' && base.startsWith('gradient-'))) return [];
  if (spaceUtilities.has(utility)) return paths('space', base);
  if (utility === 'rounded') return paths('radius', base);
  if (utility === 'text') return [...paths('fontSize', base), ...paths('color', base)];
  if (['bg', 'fill', 'stroke'].includes(utility)) return paths('color', base);
  if (utility === 'duration') return paths('motion', base);
  return [];
};
const classStrings = (source: string) => [...source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].flatMap((match) => {
  const value = match[2] ?? '';
  const lead = source.slice(Math.max(0, (match.index ?? 0) - 100), match.index ?? 0);
  const utilities = [...value.matchAll(utilityPattern)];
  return utilities.length > 1 || /(?:class(?:Name)?|cva|cx|cn|twMerge|variants?)\W[\s\S]*$/i.test(lead) ? [value] : [];
});

/** Extract StyleDeclarations from Tailwind/NativeWind class strings and RN style literals. */
export function collectUtilities(source: string, origin = 'utilities'): StyleDeclaration[] {
  const declarations: StyleDeclaration[] = [];
  for (const classSource of classStrings(source)) for (const [, raw = ''] of classSource.matchAll(utilityPattern)) {
    const bare = raw.split(':').at(-1)!;
    const match = bare.match(utilityParts);
    if (!match) continue;
    const [, negative = '', utility = '', encoded = ''] = match;
    const arbitrary = encoded.startsWith('[') && encoded.endsWith(']');
    const decoded = arbitrary ? encoded.slice(1, -1) : encoded;
    if (decoded.includes('var(') || decoded.includes(':') || /[A-Z]{2,}/.test(decoded)) continue;
    const textAlign = utility === 'text' && ['left', 'center', 'right', 'justify', 'start', 'end'].includes(decoded);
    const strokeWidth = utility === 'stroke' && /^\d/.test(decoded);
    const property = textAlign ? 'text-align' : strokeWidth ? 'stroke-width' : utilityProperty[utility];
    if (!property) continue;
    const value = `${negative}${decoded}`;
    const candidates = arbitrary || textAlign || strokeWidth ? [] : tokenCandidates(utility, decoded);
    declarations.push({ origin: `${origin} ${raw}`, property, value: arbitrary ? value : bare, ...(candidates.length ? { tokenCandidates: candidates } : {}) });
  }
  for (const [, property = '', number = ''] of source.matchAll(/\b(padding|paddingTop|paddingBottom|paddingHorizontal|paddingVertical|margin|marginTop|marginBottom|gap|borderRadius|fontSize)\s*:\s*(\d+)\b/g)) {
    const css = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace('padding-horizontal', 'padding-inline').replace('padding-vertical', 'padding-block');
    declarations.push({ origin: `${origin} style`, property: css, value: `${number}px` });
  }
  return declarations;
}

function scaleIndex(contract: DesignContract) {
  const entries = Object.entries(contract.tokens ?? {});
  return Object.entries(contract.scales).map(([group, properties]) => ({
    group,
    properties,
    values: new Set(entries.filter(([name]) => name.startsWith(`${group}.`)).map(([, value]) => value.toLowerCase())),
  }));
}

function escapeKey(group: string, value: string) {
  return `${group}\0${value}`;
}

/** Census off-scale values and report one-offs + equivalence-class divergence. */
export function auditPopulation(contract: DesignContract, declarations: readonly StyleDeclaration[], options: number | AuditOptions = 8): PopulationReport {
  const settings = typeof options === 'number' ? { systematicThreshold: options } : options;
  const systematicThreshold = settings.systematicThreshold ?? 8;
  const inferredSources = [...new Set(declarations.map((item) => item.origin.split(/\s+/)[0]!).filter(Boolean))];
  const sources = [...new Set(settings.sources?.length ? settings.sources : inferredSources)];
  const observedSources = sources.filter((source) => declarations.some((item) => item.origin === source || item.origin.startsWith(`${source} `)));
  const unobservedSources = sources.filter((source) => !observedSources.includes(source));
  const comparableSubjects = [...new Set(declarations.flatMap((item) => item.subject ? [`${item.subject}${item.context ? `@${item.context}` : ''}`] : []))];
  const status = declarations.length === 0 ? 'empty' : unobservedSources.length || (settings.requireSubjects && !comparableSubjects.length) ? 'partial' : 'complete';
  const coverage: AuditCoverage = { sources, observedSources, unobservedSources, observations: declarations.length, comparableSubjects, status };
  const coverageFindings: Finding[] = [];
  if (!declarations.length) coverageFindings.push({ rule: 'coverage/no-style-observations', category: 'coverage', path: 'audit.observations', message: 'No style observations were collected; absence of evidence is not conformance' });
  if (unobservedSources.length) coverageFindings.push({ rule: 'coverage/unobserved-source', category: 'coverage', path: 'audit.sources', message: `No observations were collected from: ${unobservedSources.join(', ')}` });
  if (settings.requireSubjects && !comparableSubjects.length) coverageFindings.push({ rule: 'coverage/no-comparable-subjects', category: 'coverage', path: 'audit.subjects', message: 'No comparable component subjects were identified; coherence cannot be decided' });
  const tokenFindings: Finding[] = [];
  const tokens = contract.tokens;
  for (const declaration of declarations) {
    const path = `${declaration.origin} { ${declaration.property} }`;
    for (const name of declaration.unresolved ?? []) tokenFindings.push({ rule: 'tokens/unresolved-reference', category: 'tokens', path, message: `Reference "${name}" resolves to no value in the design language` });
    if (declaration.tokenCandidates?.length && tokens && !declaration.tokenCandidates.some((name) => name in tokens)) {
      tokenFindings.push({ rule: 'tokens/unknown-utility-token', category: 'tokens', path, message: `Utility "${declaration.value}" maps to no declared token (${declaration.tokenCandidates.join(' or ')})` });
    }
  }
  if (!declarations.length || !tokens) return { census: [], findings: [...coverageFindings, ...tokenFindings], systematicThreshold, coverage };
  const scales = scaleIndex(contract);
  const counts = new Map<string, { group: string; value: string; count: number; origins: string[] }>();
  const byFamily = new Map<string, Map<string, Set<string>>>();

  for (const declaration of declarations) {
    const family = declaration.subject ? `${declaration.subject}${declaration.context ? `@${declaration.context}` : ''}` : undefined;
    if (family) {
      const values = byFamily.get(family) ?? new Map<string, Set<string>>();
      byFamily.set(family, values);
      const set = values.get(declaration.property) ?? new Set<string>();
      set.add(declaration.value.toLowerCase());
      values.set(declaration.property, set);
    }

    for (const { group, properties, values: scale } of scales) {
      if (!scale.size || !governs(properties, declaration.property)) continue;
      for (const literal of literalsOf(group, declaration.value)) {
        if (scale.has(literal) || zero.test(literal)) continue;
        const key = escapeKey(group, literal);
        const row = counts.get(key) ?? { group, value: literal, count: 0, origins: [] };
        row.count += 1;
        if (row.origins.length < 8) row.origins.push(`${declaration.origin} { ${declaration.property} }`);
        counts.set(key, row);
      }
    }
  }

  const census = [...counts.values()]
    .map((row): CensusEntry => ({ ...row, kind: row.count >= systematicThreshold ? 'systematic' : 'oneOff' }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

  const findings: Finding[] = [...coverageFindings, ...tokenFindings];
  for (const entry of census) if (entry.kind === 'oneOff') {
    findings.push({ rule: 'tokens/off-scale-one-off', category: 'scale', path: entry.origins[0] ?? entry.value, message: `"${entry.value}" is an off-scale ${entry.group} one-off (${entry.count} use${entry.count === 1 ? '' : 's'})` });
  }

  for (const [family, properties] of byFamily) for (const [property, values] of properties) {
    if (values.size < 2) continue;
    const list = [...values].sort();
    findings.push({ rule: 'coherence/property-drift', category: 'coherence', path: `${family}.{${property}}`, message: `${family} uses ${list.length} different ${property} values: ${list.join(', ')}` });
  }

  return { census, findings, systematicThreshold, coverage };
}

export interface RecallBrief {
  contract: string;
  task?: string;
  paths: string[];
  scales: Record<string, { properties: string[]; values: string[] }>;
  components: DesignContract['components'];
  surfaces: DesignContract['surfaces'];
  policies: DesignContract['policies'];
  promote: CensusEntry[];
  rules: string[];
}

/** Deterministic pre-edit brief: the language constraints an agent must obey before writing UI. */
export function recallDesign(contract: DesignContract, options: { task?: string; paths?: string[]; census?: CensusEntry[] } = {}): RecallBrief {
  const haystack = `${options.task ?? ''} ${(options.paths ?? []).join(' ')}`.toLowerCase();
  const match = (value: string) => !haystack.trim() || haystack.includes(value.toLowerCase()) || value.toLowerCase().split(/[-_/]/).some((part) => part.length > 2 && haystack.includes(part));
  const components = contract.components.filter((item) => match(item.name) || item.parts.some(match));
  const surfaces = contract.surfaces.filter((item) => match(item.name) || item.requiredComponents.some(match) || (item.template ? match(item.template) : false));
  const selected = components.length ? components : contract.components;
  const selectedSurfaces = surfaces.length ? surfaces : contract.surfaces;
  const scales = Object.fromEntries(scaleIndex(contract).map(({ group, properties, values }) => [group, { properties: [...properties], values: [...values].sort() }]));
  const promote = (options.census ?? []).filter((entry) => entry.kind === 'systematic');
  const rules = [
    'Use only declared components, variants, states, roles, and slots.',
    'Every effective style value must resolve to a token in the design language.',
    'Do not invent off-scale spacing, radius, type, motion, or color literals.',
    'Keep equivalent component families on one value per property across screens.',
    ...(promote.length ? [`Promote these systematic escapes into the language instead of repeating them: ${promote.map((entry) => `${entry.group}:${entry.value}`).join(', ')}.`] : []),
    ...(selectedSurfaces[0] ? [`Cover surface "${selectedSurfaces[0].name}" states/themes/viewports/locales as declared.`] : []),
  ];
  return {
    contract: contract.name,
    ...(options.task ? { task: options.task } : {}),
    paths: options.paths ?? [],
    scales,
    components: selected,
    surfaces: selectedSurfaces,
    policies: contract.policies,
    promote,
    rules,
  };
}

export interface FleetMember { name: string; declarations: StyleDeclaration[]; sources?: string[] }
export interface FleetMemberReport {
  name: string;
  declarations: number;
  census: CensusEntry[];
  findings: Finding[];
  density: number;
  coverage: AuditCoverage;
}
export interface FleetReport {
  contract: string;
  members: FleetMemberReport[];
  sharedSystematic: CensusEntry[];
  ranking: { name: string; density: number; coverage: AuditCoverage['status'] }[];
}

/** Cross-app population audit against one shared language. */
export function auditFleet(contract: DesignContract, members: readonly FleetMember[], systematicThreshold = 8): FleetReport {
  const reports = members.map((member): FleetMemberReport => {
    const report = auditPopulation(contract, member.declarations, { systematicThreshold, ...(member.sources ? { sources: member.sources } : {}), requireSubjects: true });
    const density = report.findings.length / Math.max(member.declarations.length, 1);
    return { name: member.name, declarations: member.declarations.length, census: report.census, findings: report.findings, density, coverage: report.coverage };
  });
  const counts = new Map<string, CensusEntry & { apps: Set<string> }>();
  for (const report of reports) for (const entry of report.census) if (entry.kind === 'systematic') {
    const key = `${entry.group}\0${entry.value}`;
    const row = counts.get(key) ?? { ...entry, count: 0, origins: [], apps: new Set<string>() };
    row.count += entry.count;
    row.apps.add(report.name);
    if (row.origins.length < 8) row.origins.push(...entry.origins.slice(0, 8 - row.origins.length));
    counts.set(key, row);
  }
  const sharedSystematic = [...counts.values()]
    .filter((entry) => entry.apps.size > 1)
    .map((entry) => ({ group: entry.group, value: entry.value, count: entry.count, kind: entry.kind, origins: entry.origins }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
  const ranking = [...reports]
    .sort((left, right) => Number(left.coverage.status !== 'complete') - Number(right.coverage.status !== 'complete') || left.density - right.density)
    .map(({ name, density, coverage }) => ({ name, density, coverage: coverage.status }));
  return { contract: contract.name, members: reports, sharedSystematic, ranking };
}

export interface PromoteEntry { group: string; value: string; path: string; count: number }
export interface PromotePlan { entries: PromoteEntry[]; skipped: CensusEntry[] }

const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'value';

/** Build a deterministic promotion plan from systematic census escapes. */
export function planPromotions(census: readonly CensusEntry[]): PromotePlan {
  const entries = census.filter((entry) => entry.kind === 'systematic').map((entry): PromoteEntry => ({
    group: entry.group,
    value: entry.value,
    path: `${entry.group}.promoted.${slug(entry.value)}`,
    count: entry.count,
  }));
  return { entries, skipped: census.filter((entry) => entry.kind !== 'systematic') };
}

function setPath(tree: Record<string, unknown>, path: string, node: Record<string, unknown>) {
  const parts = path.split('.');
  let cursor = tree;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!next || typeof next !== 'object' || Array.isArray(next) || '$value' in (next as object)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = node;
}

function dtcgNode(group: string, value: string): Record<string, unknown> {
  if (group === 'color') return { $type: 'color', $value: value };
  const match = value.match(/^(-?\d*\.?\d+)(px|rem|em|ms|s)$/i);
  if (match) return { $type: 'dimension', $value: { value: Number(match[1]), unit: match[2]!.toLowerCase() } };
  return { $type: 'string', $value: value };
}

/** Apply promotion plan into a DTCG token tree. Existing paths are left untouched. */
export function applyPromotions(tree: Record<string, unknown>, plan: PromotePlan): { tree: Record<string, unknown>; written: PromoteEntry[]; existed: PromoteEntry[] } {
  const next = structuredClone(tree);
  const written: PromoteEntry[] = [];
  const existed: PromoteEntry[] = [];
  for (const entry of plan.entries) {
    const parts = entry.path.split('.');
    let cursor: unknown = next;
    let present = true;
    for (const part of parts) {
      if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) || !(part in (cursor as object))) { present = false; break; }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    if (present && cursor && typeof cursor === 'object' && '$value' in (cursor as object)) { existed.push(entry); continue; }
    setPath(next, entry.path, dtcgNode(entry.group, entry.value));
    written.push(entry);
  }
  return { tree: next, written, existed };
}
