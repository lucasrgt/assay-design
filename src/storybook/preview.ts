import { collectDocument, verifyEvidence, type DesignContract } from '../index.js';
import { archetype, AvpFail, composeVerdicts, criterion, mechanical, runVerification } from 'avp-assay';
import { implementationMatrixFindings } from './atomic-navigation-model.js';
import { REQUEST_EVENT, VERDICT_EVENT, type DesignGroups, type DesignImplementationPlatform, type DesignPanelPayload, type DesignStoryControls, type DesignStoryMap } from './shared.js';
export { ADDON_ID, REQUEST_EVENT, VERDICT_EVENT } from './shared.js';
export type { DesignGroups, DesignGroupRule, DesignImplementationPlatform, DesignPanelPayload, DesignStoryControls, DesignStoryImplementation, DesignStoryMap, DesignStoryReference, StoryArgs } from './shared.js';

type Channel = {
  emit(event: string, payload?: unknown): void;
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
};

type StorybookPreviewGlobal = typeof globalThis & {
  __STORYBOOK_MODULE_PREVIEW_API__?: { addons?: { getChannel(): Channel } };
};

let connectedChannel: Channel | undefined;
let emitLatest: (() => void) | undefined;
const answerRequest = () => emitLatest?.();
const afterStoryPaint = (callback: () => void = answerRequest) => {
  if (typeof requestAnimationFrame !== 'function') return setTimeout(callback);
  requestAnimationFrame(() => requestAnimationFrame(callback));
};
const maxEmptyEvidenceRetries = 8;

export async function evaluateStory(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2]) {
  return verifyEvidence(contract, collectDocument(document, surface, coverage));
}

type ImplementationExpect = { complete(): void };
const implementationArchetype = archetype('storybook-implementation-matrix', '0.1.0', () => {
  criterion('complete-platform-matrix', 'Every component has exactly one story for every declared implementation platform', { substrate: 'static' }, mechanical<ImplementationExpect>(({ expect }) => expect.complete()));
});
const verifyImplementationMatrix = (contract: DesignContract, stories: DesignStoryMap, implementationPlatforms: readonly DesignImplementationPlatform[]) => {
  const findings = implementationMatrixFindings({ contract, stories, implementationPlatforms });
  return runVerification(contract.name, implementationArchetype, {
    probe: () => ({ act: async () => undefined, expect: { complete() { if (findings.length) throw new AvpFail(findings.map((finding) => `${finding.path}: ${finding.message}`).join('; '), findings); } } satisfies ImplementationExpect }),
  });
};

export async function evaluateStoryPanel(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2], stories: DesignStoryMap = {}, controls: Record<string, DesignStoryControls> = {}, pages: DesignStoryMap = {}, groups?: Partial<DesignGroups>, implementationPlatforms: readonly DesignImplementationPlatform[] = []): Promise<DesignPanelPayload> {
  const evidence = collectDocument(document, surface, coverage);
  const contractGroups = contract.groups ?? { sharedLabel: 'Shared', foundations: [], composition: [] };
  const verdict = composeVerdicts(surface, await Promise.all([verifyEvidence(contract, evidence), verifyImplementationMatrix(contract, stories, implementationPlatforms)]));
  return { ...verdict, contract: { name: contract.name, components: contract.components, surfaces: contract.surfaces, groups: contractGroups, ...(contract.tokens ? { tokens: contract.tokens } : {}), ...(contract.tokenMeta ? { tokenMeta: contract.tokenMeta } : {}) }, evidence, stories, implementationPlatforms, pages, controls, ...(groups ? { groups } : {}) };
}

export function publishStoryPanel(channel: Channel, evaluate: () => Promise<DesignPanelPayload>) {
  const evaluateAfterPaint = async (attempt = 0): Promise<void> => {
    const payload = await evaluate();
    if (!payload.evidence.nodes.length && attempt < maxEmptyEvidenceRetries) {
      afterStoryPaint(() => { void evaluateAfterPaint(attempt + 1); });
      return;
    }
    channel.emit(VERDICT_EVENT, payload);
  };
  emitLatest = () => { void evaluateAfterPaint(); };
  if (connectedChannel !== channel) {
    connectedChannel?.off(REQUEST_EVENT, answerRequest);
    connectedChannel = channel;
    channel.on(REQUEST_EVENT, answerRequest);
  }
  afterStoryPaint();
}

export default {
  decorators: [
    (Story: () => unknown, context: { parameters: Record<string, unknown> }, suppliedChannel?: Channel) => {
      const settings = context.parameters.designHarness as { contract?: DesignContract; surface?: string; coverage?: Parameters<typeof collectDocument>[2]; stories?: DesignStoryMap; pages?: DesignStoryMap; controls?: Record<string, DesignStoryControls>; groups?: Partial<DesignGroups>; implementationPlatforms?: readonly DesignImplementationPlatform[] } | undefined;
      const channel = suppliedChannel ?? (globalThis as StorybookPreviewGlobal).__STORYBOOK_MODULE_PREVIEW_API__?.addons?.getChannel();
      if (settings?.contract && settings.surface && channel) publishStoryPanel(channel, () => evaluateStoryPanel(settings.contract!, settings.surface!, settings.coverage, settings.stories, settings.controls, settings.pages, settings.groups, settings.implementationPlatforms));
      return Story();
    },
  ],
};
