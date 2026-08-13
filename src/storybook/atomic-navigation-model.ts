import type { DesignImplementationPlatform, DesignPanelPayload, DesignStoryControls, DesignStoryImplementation, DesignStoryReference, StoryArgs } from './shared.js';

export const COMPOSITION_VIEW = '$composition';
const PAGE_PREFIX = '$page:';
const PART_PREFIX = '$part:';
export const pageSelection = (name: string) => `${PAGE_PREFIX}${name}`;
export const selectedPage = (selection: string) => selection.startsWith(PAGE_PREFIX) ? selection.slice(PAGE_PREFIX.length) : undefined;
export type PartSelection = { owner: string; path: string[]; component: string };
export const partSelection = (selection: string, part: string) => {
  const current = selectedPart(selection);
  return `${PART_PREFIX}${encodeURIComponent(current?.owner ?? selection)}:${[...(current?.path ?? []), part].map(encodeURIComponent).join('/')}`;
};
export const selectedPart = (selection: string): PartSelection | undefined => {
  if (!selection.startsWith(PART_PREFIX)) return undefined;
  const [owner, encodedPath = ''] = selection.slice(PART_PREFIX.length).split(':', 2);
  const path = encodedPath.split('/').filter(Boolean).map(decodeURIComponent);
  return owner && path.length ? { owner: decodeURIComponent(owner), path, component: path.at(-1)! } : undefined;
};
export const selectedComponent = (selection: string) => selectedPart(selection)?.component ?? selection;
export const controlArgs = (controls: DesignStoryControls = {}, selections: Record<string, string> = {}, defaults: Record<string, readonly string[]> = {}): StoryArgs => Object.assign({}, ...Object.entries(controls).map(([group, values]) => values?.[selections[group] ?? defaults[group]?.[0] ?? ''] ?? {}));
export const displayName = (name: string) => name.split('-').map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(' ');
export const implementationsOf = (reference?: DesignStoryReference): DesignStoryImplementation[] => !reference ? [] : typeof reference === 'string' ? [{ id: reference, label: 'Canonical' }] : Array.isArray(reference) ? [...reference] : [reference as DesignStoryImplementation];
const platformOrder = (platforms: readonly DesignImplementationPlatform[], platform?: string) => {
  const index = platforms.findIndex((item) => item.id === platform);
  return index < 0 ? platforms.length : index;
};
const normalizedImplementations = (reference: DesignStoryReference | undefined, platforms: readonly DesignImplementationPlatform[]) => implementationsOf(reference)
  .map((implementation) => {
    const platform = platforms.find((item) => item.id === implementation.platform);
    return platform ? { ...implementation, label: platform.label } : implementation;
  })
  .sort((left, right) => platformOrder(platforms, left.platform) - platformOrder(platforms, right.platform));
export const implementationsForSelection = (payload: DesignPanelPayload, selection: string) => {
  const page = selectedPage(selection);
  if (page) return implementationsOf(payload.pages?.[page]);
  return normalizedImplementations(payload.stories[selectedPart(selection)?.owner ?? selection], payload.implementationPlatforms);
};
export const selectionOwnsStory = (payload: DesignPanelPayload, selection: string, storyId?: string) => Boolean(storyId && implementationsForSelection(payload, selection).some((implementation) => implementation.id === storyId));
type ImplementationPayload = Pick<DesignPanelPayload, 'contract' | 'stories' | 'implementationPlatforms'>;
const parentsOf = (payload: Pick<DesignPanelPayload, 'contract'>, component: string) => payload.contract.components.filter((item) => item.parts.includes(component));
const inheritedPlatform = (payload: ImplementationPayload, component: string, platform: string, seen = new Set<string>()): boolean => {
  if (seen.has(component)) return false;
  seen.add(component);
  return parentsOf(payload, component).some((parent) => implementationsOf(payload.stories[parent.name]).some((item) => item.platform === platform)
    || inheritedPlatform(payload, parent.name, platform, new Set(seen)));
};
export const implementationStatus = (payload: DesignPanelPayload, component: string) => {
  const implementations = implementationsOf(payload.stories[component]);
  const required = payload.implementationPlatforms;
  const missing = required.filter((platform) => {
    const direct = implementations.filter((item) => item.platform === platform.id).length;
    return direct > 1 || direct === 0 && !inheritedPlatform(payload, component, platform.id);
  });
  const unexpected = implementations.filter((item) => !item.platform || !required.some((platform) => platform.id === item.platform));
  const inherited = required.filter((platform) => !implementations.some((item) => item.platform === platform.id) && inheritedPlatform(payload, component, platform.id));
  return { implementations, required, missing, unexpected, inherited, complete: required.length > 0 && missing.length === 0 && unexpected.length === 0 };
};
export const implementationMatrixFindings = (payload: Pick<DesignPanelPayload, 'contract' | 'stories' | 'implementationPlatforms'>) => {
  const findings: { rule: string; category: 'coverage'; path: string; message: string }[] = [];
  const platformIds = payload.implementationPlatforms.map((platform) => platform.id);
  const duplicatePlatforms = [...new Set(platformIds.filter((platform, index) => platformIds.indexOf(platform) !== index))];
  if (!payload.implementationPlatforms.length) findings.push({ rule: 'storybook/implementation-platforms', category: 'coverage', path: 'implementationPlatforms', message: 'Declare the implementation platform matrix once for the harness' });
  for (const platform of duplicatePlatforms) findings.push({ rule: 'storybook/implementation-platforms', category: 'coverage', path: 'implementationPlatforms', message: `Platform "${platform}" is declared more than once` });
  for (const component of payload.contract.components) {
    const implementations = implementationsOf(payload.stories[component.name]);
    for (const platform of payload.implementationPlatforms) {
      const count = implementations.filter((implementation) => implementation.platform === platform.id).length;
      if (count > 1 || count === 0 && !inheritedPlatform(payload, component.name, platform.id)) findings.push({ rule: 'storybook/implementation-platform', category: 'coverage', path: `stories.${component.name}`, message: count === 0 ? `Missing ${platform.label} implementation or inherited parent instance` : `${platform.label} is mapped ${count} times` });
    }
    for (const implementation of implementations.filter((item) => !item.platform || !platformIds.includes(item.platform))) findings.push({ rule: 'storybook/implementation-platform', category: 'coverage', path: `stories.${component.name}`, message: implementation.platform ? `Implementation "${implementation.id}" uses undeclared platform "${implementation.platform}"` : `Implementation "${implementation.id}" has no platform` });
  }
  return findings;
};
export const mappedComponentNames = (payload: DesignPanelPayload) => new Set(payload.contract.components.filter((component) => implementationStatus(payload, component.name).complete).map((component) => component.name));
export const inspectableComponentNames = (payload: Pick<DesignPanelPayload, 'contract'>) => new Set(payload.contract.components.map((component) => component.name));
const directComplete = (payload: DesignPanelPayload, name: string) => payload.implementationPlatforms.length > 0 && payload.implementationPlatforms.every((platform) => implementationsOf(payload.stories[name]).filter((item) => item.platform === platform.id).length === 1);
export const canonicalSelection = (payload: DesignPanelPayload, component: string) => {
  if (directComplete(payload, component)) return component;
  const queue = parentsOf(payload, component).map((parent) => ({ owner: parent.name, path: [component] }));
  const seen = new Set<string>([component]);
  while (queue.length) {
    const current = queue.shift()!;
    if (directComplete(payload, current.owner)) return `${PART_PREFIX}${encodeURIComponent(current.owner)}:${current.path.map(encodeURIComponent).join('/')}`;
    if (seen.has(current.owner)) continue;
    seen.add(current.owner);
    for (const parent of parentsOf(payload, current.owner)) queue.push({ owner: parent.name, path: [current.owner, ...current.path] });
  }
  return component;
};
export type DesignPage = { name: string; label: string; path: string[] };
export type DesignPageFolder = { name: string; key: string; folders: DesignPageFolder[]; pages: DesignPage[] };
const pagePath = (value?: string | readonly string[]) => (Array.isArray(value) ? [...value] : typeof value === 'string' ? value.split('/') : []).map((part) => part.trim()).filter(Boolean);
export const mappedPages = (payload: DesignPanelPayload): DesignPage[] => payload.contract.surfaces.flatMap((surface) => {
  const implementation = implementationsOf(payload.pages?.[surface.name])[0];
  return implementation ? [{ name: surface.name, label: implementation.label ?? displayName(surface.name), path: pagePath(implementation.path) }] : [];
});
const pageTree = (pages: DesignPage[]): DesignPageFolder => {
  const root: DesignPageFolder = { name: 'Pages', key: '', folders: [], pages: [] };
  for (const page of pages) {
    let current = root;
    for (const name of page.path) {
      const key = current.key ? `${current.key}/${name}` : name;
      let folder = current.folders.find((item) => item.name === name);
      if (!folder) { folder = { name, key, folders: [], pages: [] }; current.folders.push(folder); }
      current = folder;
    }
    current.pages.push(page);
  }
  return root;
};
const matches = (query: string, ...values: string[]) => !query || values.some((value) => value.toLocaleLowerCase().includes(query));
const filterFolder = (folder: DesignPageFolder, query: string): DesignPageFolder | undefined => {
  if (query && matches(query, folder.name)) return folder;
  const folders = folder.folders.flatMap((child) => { const match = filterFolder(child, query); return match ? [match] : []; });
  const pages = folder.pages.filter((page) => matches(query, page.label, page.name, ...page.path));
  return !query || folders.length || pages.length ? { ...folder, folders, pages } : undefined;
};
export const pageHierarchy = (payload: DesignPanelPayload, query = '') => filterFolder(pageTree(mappedPages(payload)), query.trim().toLocaleLowerCase());
export const navigationMatches = (query: string, ...values: string[]) => matches(query.trim().toLocaleLowerCase(), ...values);
