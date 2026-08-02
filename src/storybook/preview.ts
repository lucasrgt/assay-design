import { definePreviewAddon } from 'storybook/internal/csf';
import { collectDocument, verifyEvidence, type DesignContract } from '../index.js';

export const ADDON_ID = 'assay-design';
export const VERDICT_EVENT = `${ADDON_ID}/verdict`;

export type DesignPanelPayload = Awaited<ReturnType<typeof verifyEvidence>> & {
  contract: Pick<DesignContract, 'name' | 'components' | 'surfaces'>;
  evidence: ReturnType<typeof collectDocument>;
};

export async function evaluateStory(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2]) {
  return verifyEvidence(contract, collectDocument(document, surface, coverage));
}

export async function evaluateStoryPanel(contract: DesignContract, surface: string, coverage?: Parameters<typeof collectDocument>[2]): Promise<DesignPanelPayload> {
  const evidence = collectDocument(document, surface, coverage);
  return { ...await verifyEvidence(contract, evidence), contract: { name: contract.name, components: contract.components, surfaces: contract.surfaces }, evidence };
}

export default definePreviewAddon({
  decorators: [
    (Story, context) => {
      const settings = context.parameters.designHarness as { contract?: DesignContract; surface?: string; coverage?: Parameters<typeof collectDocument>[2] } | undefined;
      if (settings?.contract && settings.surface) setTimeout(() => { void evaluateStoryPanel(settings.contract!, settings.surface!, settings.coverage).then((payload) => context.channel.emit(VERDICT_EVENT, payload)); });
      return Story();
    },
  ],
});
