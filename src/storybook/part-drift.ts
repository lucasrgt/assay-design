import type { DesignEvidence } from '../index.js';
import type { DesignPanelPayload } from './shared.js';
import { implementationsOf } from './atomic-navigation-model.js';

type Finding = { rule: 'storybook/part-implementation-drift'; category: 'coverage'; path: string; message: string };
const childIndices = (evidence: DesignEvidence, parent: number) => evidence.nodes.flatMap((node, index) => node.parent === parent ? [index] : []);
const fingerprint = (evidence: DesignEvidence, root: number): string => {
  const node = evidence.nodes[root]!;
  const attributes = [node.component, node.variant, node.appearance, node.state, node.role, node.widthMode].filter(Boolean).join('@');
  return `${attributes}[${childIndices(evidence, root).map((child) => fingerprint(evidence, child)).join(',')}]`;
};
const matchingRoots = (evidence: DesignEvidence, component: string) => evidence.nodes.flatMap((node, index) => node.component === component ? [index] : []);
const descendants = (evidence: DesignEvidence, owner: number, component: string) => {
  const found: number[] = [];
  const visit = (index: number) => {
    for (const child of childIndices(evidence, index)) {
      if (evidence.nodes[child]?.component === component) found.push(child);
      visit(child);
    }
  };
  visit(owner);
  return found;
};

export function partImplementationFindings(payload: Pick<DesignPanelPayload, 'contract' | 'stories'>, evidenceByStory: ReadonlyMap<string, DesignEvidence>): Finding[] {
  const findings: Finding[] = [];
  for (const parent of payload.contract.components.filter((component) => component.parts.length)) {
    const parentStories = implementationsOf(payload.stories[parent.name]);
    for (const part of parent.parts) {
      const partStories = implementationsOf(payload.stories[part]);
      for (const parentReference of parentStories) {
        const parentImplementation = parentReference;
        const isolatedImplementation = partStories.find((reference) => reference.platform === parentImplementation.platform) ?? partStories[0];
        const parentEvidence = evidenceByStory.get(parentImplementation?.id ?? '');
        const isolatedEvidence = evidenceByStory.get(isolatedImplementation?.id ?? '');
        if (!parentEvidence || !isolatedEvidence) continue;
        const parentParts = matchingRoots(parentEvidence, parent.name).flatMap((owner) => descendants(parentEvidence, owner, part));
        const isolatedRoots = matchingRoots(isolatedEvidence, part).filter((index) => isolatedEvidence.nodes[index]?.parent === undefined);
        if (!parentParts.length || !isolatedRoots.length) continue;
        const expected = new Set(parentParts.map((index) => fingerprint(parentEvidence, index)));
        if (!isolatedRoots.some((index) => expected.has(fingerprint(isolatedEvidence, index)))) findings.push({
          rule: 'storybook/part-implementation-drift', category: 'coverage', path: `stories.${part}`,
          message: `Isolated ${part} differs from the instance rendered inside ${parent.name}${parentImplementation.platform ? ` on ${parentImplementation.platform}` : ''}`,
        });
      }
    }
  }
  return findings;
}
