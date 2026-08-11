import type { DesignContract, DesignEvidence, DesignGroups } from '../index.js';
export type { DesignGroups, DesignGroupRule } from '../index.js';
import type { FeatureVerdict } from 'avp-assay';

export const ADDON_ID = 'assay-design';
export const VERDICT_EVENT = `${ADDON_ID}/verdict`;
export const REQUEST_EVENT = `${ADDON_ID}/request`;

export type StoryArgs = Record<string, string | number | boolean | null>;
export type DesignStoryControls = Record<string, Record<string, StoryArgs> | undefined>;
export type DesignImplementationPlatform = { id: string; label: string };
export type DesignStoryImplementation = { id: string; label?: string; platform?: string; path?: string | readonly string[]; controls?: DesignStoryControls };
export type DesignStoryReference = string | DesignStoryImplementation | readonly DesignStoryImplementation[];
export type DesignStoryMap = Record<string, DesignStoryReference>;
export type DesignPanelPayload = FeatureVerdict & {
  contract: Pick<DesignContract, 'name' | 'components' | 'surfaces' | 'tokens' | 'tokenMeta' | 'groups'>;
  evidence: DesignEvidence;
  stories: DesignStoryMap;
  implementationPlatforms: readonly DesignImplementationPlatform[];
  pages?: DesignStoryMap;
  controls?: Record<string, DesignStoryControls>;
  groups?: Partial<DesignGroups>;
};
