import { definePreviewAddon } from 'storybook/internal/csf';
import { addons } from 'storybook/preview-api';
import { collectDocument, verifyEvidence, type DesignContract } from '../index.js';
import { REQUEST_EVENT, VERDICT_EVENT, type DesignPanelPayload, type DesignStoryControls, type DesignStoryMap } from './shared.js';
export { ADDON_ID, REQUEST_EVENT, VERDICT_EVENT } from './shared.js';
export type { DesignPanelPayload, DesignStoryControls, DesignStoryImplementation, DesignStoryMap, DesignStoryReference, StoryArgs } from './shared.js';

type Channel = {
  emit(event: string, payload?: unknown): void;
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
};

let connectedChannel: Channel | undefined;
let emitLatest: (() => void) | undefined;
const answerRequest = () => emitLatest?.();

export async function evaluateStory(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2]) {
  return verifyEvidence(contract, collectDocument(document, surface, coverage));
}

export async function evaluateStoryPanel(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2], stories: DesignStoryMap = {}, controls: Record<string, DesignStoryControls> = {}): Promise<DesignPanelPayload> {
  const evidence = collectDocument(document, surface, coverage);
  return { ...await verifyEvidence(contract, evidence), contract: { name: contract.name, components: contract.components, surfaces: contract.surfaces }, evidence, stories, controls };
}

export function publishStoryPanel(channel: Channel, evaluate: () => Promise<DesignPanelPayload>) {
  emitLatest = () => { void evaluate().then((payload) => channel.emit(VERDICT_EVENT, payload)); };
  if (connectedChannel !== channel) {
    connectedChannel?.off(REQUEST_EVENT, answerRequest);
    connectedChannel = channel;
    channel.on(REQUEST_EVENT, answerRequest);
  }
  setTimeout(answerRequest);
}

export default definePreviewAddon({
  decorators: [
    (Story, context, channel: Channel = addons.getChannel()) => {
      const settings = context.parameters.designHarness as { contract?: DesignContract; surface?: string; coverage?: Parameters<typeof collectDocument>[2]; stories?: DesignStoryMap; controls?: Record<string, DesignStoryControls> } | undefined;
      if (settings?.contract && settings.surface) publishStoryPanel(channel, () => evaluateStoryPanel(settings.contract!, settings.surface!, settings.coverage, settings.stories, settings.controls));
      return Story();
    },
  ],
});
