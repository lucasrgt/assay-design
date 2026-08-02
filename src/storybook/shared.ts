import type { DesignContract, DesignEvidence } from '../index.js';
import type { Verdict } from 'avp-assay';

export const ADDON_ID = 'assay-design';
export const VERDICT_EVENT = `${ADDON_ID}/verdict`;
export const REQUEST_EVENT = `${ADDON_ID}/request`;

export type StoryArgs = Record<string, string | number | boolean | null>;
export type DesignStoryControls = Partial<Record<'variants' | 'states' | 'widths', Record<string, StoryArgs>>>;
export type DesignStoryImplementation = { id: string; label?: string; platform?: string; controls?: DesignStoryControls };
export type DesignStoryReference = string | DesignStoryImplementation | readonly DesignStoryImplementation[];
export type DesignStoryMap = Record<string, DesignStoryReference>;
export type DesignPanelPayload = Verdict & {
  contract: Pick<DesignContract, 'name' | 'components' | 'surfaces'>;
  evidence: DesignEvidence;
  stories: DesignStoryMap;
  controls?: Record<string, DesignStoryControls>;
};
