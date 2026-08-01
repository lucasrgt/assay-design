import { definePreviewAddon } from 'storybook/internal/csf';
import { collectDocument, verifyEvidence, type DesignContract } from '../index.js';

export const ADDON_ID = 'assay-design';
export const VERDICT_EVENT = `${ADDON_ID}/verdict`;

export async function evaluateStory(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2]) {
  return verifyEvidence(contract, collectDocument(document, surface, coverage));
}

export default definePreviewAddon({
  decorators: [
    (Story, context) => {
      const settings = context.parameters.designHarness as { contract?: DesignContract; surface?: string; coverage?: Parameters<typeof collectDocument>[2] } | undefined;
      if (settings?.contract && settings.surface) setTimeout(() => { void evaluateStory(settings.contract!, settings.surface!, settings.coverage).then((verdict) => context.channel.emit(VERDICT_EVENT, verdict)); });
      return Story();
    },
  ],
});
