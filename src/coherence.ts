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
}

const governs = (properties: readonly string[], property: string) => properties.some((entry) => property === entry || property.startsWith(`${entry}-`));
const literalsOf = (group: string, value: string) => [...value.matchAll(group === 'color' ? /#[0-9a-f]{3,8}\b|\brgba?\([^()]*\)/gi : /-?\d*\.?\d+(?:px|rem|em|ms|s)\b/g)].map(([literal]) => literal.toLowerCase());
const zero = /^-?0(px|rem|em|ms|s)?$/;
const familyOf = (origin: string) => {
  const classes = [...origin.matchAll(/(?:^|[\s/>])\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]!);
  if (classes.length) return classes.at(-1)!.replace(/--.+$/, '');
  const leaf = origin.split(/[\\/]/).at(-1)?.split(/\s+/)[0] ?? origin;
  return leaf.replace(/\.(tsx?|jsx?|astro|css|vue|svelte)$/i, '') || leaf;
};

const utilityProperty: Record<string, string> = {
  p: 'padding', px: 'padding-inline', py: 'padding-block', pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
  m: 'margin', mx: 'margin-inline', my: 'margin-block', mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
  gap: 'gap', inset: 'inset', top: 'top', right: 'right', bottom: 'bottom', left: 'left',
  text: 'font-size', leading: 'line-height', tracking: 'letter-spacing', rounded: 'border-radius',
  w: 'width', h: 'height', 'min-w': 'min-width', 'min-h': 'min-height', 'max-w': 'max-width', 'max-h': 'max-height',
};

/** Extract StyleDeclarations from Tailwind/NativeWind class strings and RN style literals. */
export function collectUtilities(source: string, origin = 'utilities'): StyleDeclaration[] {
  const declarations: StyleDeclaration[] = [];
  for (const [, utility = '', value = ''] of source.matchAll(/(?:^|[\s"'`:])(-?[a-z][\w-]*)-\[([^\]\s]+)\]/g)) {
    if (utility.startsWith('data-') || utility.startsWith('aria-') || value.includes('var(') || value.includes(':')) continue;
    const property = utilityProperty[utility] ?? utilityProperty[utility.split('-').slice(0, 2).join('-')!] ?? utilityProperty[utility.split('-')[0]!];
    if (!property) continue;
    declarations.push({ origin: `${origin} ${utility}`, property, value });
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
export function auditPopulation(contract: DesignContract, declarations: readonly StyleDeclaration[], systematicThreshold = 8): PopulationReport {
  if (!declarations.length || !contract.tokens) return { census: [], findings: [], systematicThreshold };
  const scales = scaleIndex(contract);
  const counts = new Map<string, { group: string; value: string; count: number; origins: string[] }>();
  const byFamily = new Map<string, Map<string, Set<string>>>();

  for (const declaration of declarations) {
    const family = familyOf(declaration.origin);
    const values = byFamily.get(family) ?? new Map<string, Set<string>>();
    byFamily.set(family, values);
    const set = values.get(declaration.property) ?? new Set<string>();
    set.add(declaration.value.toLowerCase());
    values.set(declaration.property, set);

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

  const findings: Finding[] = [];
  for (const entry of census) if (entry.kind === 'oneOff') {
    findings.push({ category: 'scale', path: entry.origins[0] ?? entry.value, message: `"${entry.value}" is an off-scale ${entry.group} one-off (${entry.count} use${entry.count === 1 ? '' : 's'})` });
  }

  for (const [family, properties] of byFamily) for (const [property, values] of properties) {
    if (values.size < 2) continue;
    const list = [...values].sort();
    findings.push({ category: 'coherence', path: `${family}.{${property}}`, message: `${family} uses ${list.length} different ${property} values: ${list.join(', ')}` });
  }

  return { census, findings, systematicThreshold };
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

export interface FleetMember { name: string; declarations: StyleDeclaration[] }
export interface FleetMemberReport {
  name: string;
  declarations: number;
  census: CensusEntry[];
  findings: Finding[];
  density: number;
}
export interface FleetReport {
  contract: string;
  members: FleetMemberReport[];
  sharedSystematic: CensusEntry[];
  ranking: { name: string; density: number }[];
}

/** Cross-app population audit against one shared language. */
export function auditFleet(contract: DesignContract, members: readonly FleetMember[], systematicThreshold = 8): FleetReport {
  const reports = members.map((member): FleetMemberReport => {
    const report = auditPopulation(contract, member.declarations, systematicThreshold);
    const density = member.declarations.length ? report.findings.length / Math.max(member.declarations.length, 1) : 0;
    return { name: member.name, declarations: member.declarations.length, census: report.census, findings: report.findings, density };
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
  const ranking = [...reports].sort((left, right) => left.density - right.density).map(({ name, density }) => ({ name, density }));
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

