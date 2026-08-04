import { mappedComponentNames, mappedPages } from './atomic-navigation-model.js';
import type { DesignPanelPayload } from './shared.js';

export const coverageAxes = ['states', 'themes', 'viewports', 'locales'] as const;
export type CoverageAxis = (typeof coverageAxes)[number];

export function coverageSnapshot(payload: DesignPanelPayload) {
  const mappedComponents = mappedComponentNames(payload);
  const mappedPageNames = new Set(mappedPages(payload).map((page) => page.name));
  const observed = new Map<string, number>();
  for (const node of payload.evidence.nodes) observed.set(node.component, (observed.get(node.component) ?? 0) + 1);
  const surfaces = payload.contract.surfaces.map((surface) => {
    const current = surface.name === payload.evidence.surface;
    const required = [...new Set([...surface.requiredComponents, ...(surface.template ? [surface.template] : [])])];
    const components = required.map((name) => ({ name, observed: current && observed.has(name), uses: current ? observed.get(name) ?? 0 : 0 }));
    const axes = Object.fromEntries(coverageAxes.map((axis) => {
      const declared = surface[axis];
      const actual = current ? payload.evidence.coverage?.[axis] ?? [] : [];
      return [axis, { declared, observed: actual, covered: declared.filter((value) => actual.includes(value)).length }];
    })) as Record<CoverageAxis, { declared: string[]; observed: string[]; covered: number }>;
    return { name: surface.name, current, mapped: mappedPageNames.has(surface.name), required: components, covered: components.filter((item) => item.observed).length, axes };
  });
  return {
    mappedComponents,
    mappedPageNames,
    observed,
    missingComponents: payload.contract.components.filter((component) => !mappedComponents.has(component.name)),
    surfaces,
    current: surfaces.find((surface) => surface.current),
  };
}
