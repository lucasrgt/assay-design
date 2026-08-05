import type { ComponentContract, DesignContract, DesignGroups, DesignGroupRule } from '../index.js';
import { foundationGroups, type FoundationGroup } from './foundations.js';
import type { DesignPanelPayload } from './shared.js';

export const COMPOSITION_GROUP_PREFIX = '$composition-group:';

const escaped = (value: string) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
const pattern = (value: string) => new RegExp(`^${escaped(value).replaceAll('*', '.*')}$`, 'i');
const matches = (value: string, candidate: string) => pattern(candidate).test(value) || (!candidate.includes('*') && value.startsWith(`${candidate}.`));
const ruleFor = (values: readonly string[], rules: readonly DesignGroupRule[]) => rules.find((rule) => rule.include.some((candidate) => values.some((value) => matches(value, candidate))));
const orderedLabels = (used: Set<string>, groups?: Partial<DesignGroups>, rules: readonly DesignGroupRule[] = []) => [groups?.sharedLabel ?? 'Shared', ...rules.map((rule) => rule.label)].filter((label, index, all) => used.has(label) && all.indexOf(label) === index);

export type GroupedFoundation = FoundationGroup & { folder: string; selectionKey: string };
export type FoundationFolder = { label: string; foundations: GroupedFoundation[] };
export type CompositionFolder = { label: string; components: ComponentContract[]; selection: string };

export const effectiveGroups = (payload: Pick<DesignPanelPayload, 'contract' | 'groups'>): DesignGroups => ({
  ...payload.contract.groups,
  ...payload.groups,
  foundations: payload.groups?.foundations ?? payload.contract.groups.foundations,
  composition: payload.groups?.composition ?? payload.contract.groups.composition,
});

export function groupedFoundations(contract: Pick<DesignContract, 'tokens' | 'tokenMeta'>, groups?: Partial<DesignGroups>): FoundationFolder[] {
  const rules = groups?.foundations ?? [];
  if (!rules.length) return [];
  const shared = groups?.sharedLabel ?? 'Shared';
  const folders = new Map<string, Map<string, GroupedFoundation>>();
  for (const foundation of foundationGroups(contract)) for (const token of foundation.tokens) {
    const folder = ruleFor([token.name, foundation.id], rules)?.label ?? shared;
    const byFoundation = folders.get(folder) ?? new Map<string, GroupedFoundation>();
    const selectionKey = `${encodeURIComponent(folder)}|${foundation.id}`;
    const slice = byFoundation.get(foundation.id) ?? { ...foundation, folder, selectionKey, tokens: [] };
    slice.tokens.push(token);
    byFoundation.set(foundation.id, slice);
    folders.set(folder, byFoundation);
  }
  const labels = orderedLabels(new Set(folders.keys()), groups, rules);
  return labels.map((label) => ({ label, foundations: [...folders.get(label)!.values()] }));
}

export function compositionFolders(components: readonly ComponentContract[], groups?: Partial<DesignGroups>): CompositionFolder[] {
  const rules = groups?.composition ?? [];
  if (!rules.length) return [];
  const shared = groups?.sharedLabel ?? 'Shared';
  const folders = new Map<string, ComponentContract[]>();
  for (const component of components) {
    const folder = ruleFor([component.name], rules)?.label ?? shared;
    folders.set(folder, [...(folders.get(folder) ?? []), component]);
  }
  const labels = orderedLabels(new Set(folders.keys()), groups, rules);
  return labels.map((label) => ({ label, components: folders.get(label)!, selection: compositionGroupSelection(label) }));
}

export const compositionGroupSelection = (label: string) => `${COMPOSITION_GROUP_PREFIX}${encodeURIComponent(label)}`;
export const selectedCompositionGroup = (selection: string) => selection.startsWith(COMPOSITION_GROUP_PREFIX) ? decodeURIComponent(selection.slice(COMPOSITION_GROUP_PREFIX.length)) : undefined;
