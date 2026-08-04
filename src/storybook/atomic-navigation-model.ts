import type { DesignPanelPayload, DesignStoryImplementation, DesignStoryReference } from './shared.js';

export const COMPOSITION_VIEW = '$composition';
const PAGE_PREFIX = '$page:';
export const pageSelection = (name: string) => `${PAGE_PREFIX}${name}`;
export const selectedPage = (selection: string) => selection.startsWith(PAGE_PREFIX) ? selection.slice(PAGE_PREFIX.length) : undefined;
export const displayName = (name: string) => name.split('-').map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(' ');
export const implementationsOf = (reference?: DesignStoryReference): DesignStoryImplementation[] => !reference ? [] : typeof reference === 'string' ? [{ id: reference, label: 'Canonical' }] : Array.isArray(reference) ? [...reference] : [reference as DesignStoryImplementation];
export const mappedComponentNames = (payload: DesignPanelPayload) => new Set(Object.entries(payload.stories).flatMap(([name, reference]) => implementationsOf(reference).length ? [name] : []));
export const pageBackedImplementations = (payload: DesignPanelPayload, component: string) => payload.contract.surfaces
  .filter((surface) => surface.template === component)
  .flatMap((surface) => implementationsOf(payload.pages?.[surface.name]));
export const implementationsForSelection = (payload: DesignPanelPayload, selection: string) => {
  const page = selectedPage(selection);
  if (page) return implementationsOf(payload.pages?.[page]);
  const canonical = implementationsOf(payload.stories[selection]);
  return canonical.length ? canonical : pageBackedImplementations(payload, selection);
};
export const selectionOwnsStory = (payload: DesignPanelPayload, selection: string, storyId?: string) => Boolean(storyId && implementationsForSelection(payload, selection).some((implementation) => implementation.id === storyId));
export const inspectableComponentNames = (payload: DesignPanelPayload) => {
  const names = mappedComponentNames(payload);
  for (const component of payload.contract.components) if (component.tier === 'template' && pageBackedImplementations(payload, component.name).length) names.add(component.name);
  return names;
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
