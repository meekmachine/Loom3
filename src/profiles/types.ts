import type { Profile } from '../mappings/types';
import type { PresetType } from '../presets';
import type {
  LineConfig,
  MarkerGroup,
  MarkerStyle,
  MarkerStyleOverrides,
  Region,
} from '../regions/types';

export type ProfileOverrides = Partial<Profile>;
export type ProfilePresetId = PresetType | string;

/**
 * Profile-derived runtime config accepted by Loom3 compatibility helpers.
 *
 * Loom3's canonical model is `Profile`; these fields describe how apps select
 * and extend a base profile preset before handing the resolved profile to
 * runtime tools.
 */
export interface ProfileRuntimeConfig extends Partial<Profile> {
  /** Preferred preset/profile id field for new callers. */
  profilePresetId?: ProfilePresetId;
  /** Compatibility alias for callers already using preset-oriented naming. */
  presetId?: ProfilePresetId;
  /** Compatibility alias for callers that frame presets as base profiles. */
  baseProfileId?: ProfilePresetId;
  /** @deprecated Use `profilePresetId` instead. */
  auPresetType?: ProfilePresetId;
  /**
   * Optional legacy nested override blob.
   * New stored documents should flatten preset overrides onto the top-level
   * profile object instead of nesting them here.
   */
  profile?: ProfileOverrides;

  /** Which annotation region to focus on load. */
  defaultRegion?: string;
  /** Runtime mirror of `annotationRegions` retained for older camera/marker UIs. */
  regions?: Region[];
  /** Marker visualization style. Default: '3d'. */
  markerStyle?: MarkerStyle;
  /** Play intro animation on load. Default: false. */
  playIntroOnLoad?: boolean;
  /** Model position offset to apply on load. */
  modelOffset?: { x?: number; y?: number; z?: number };
  /** Model rotation in degrees to apply on load. */
  modelRotation?: { x?: number; y?: number; z?: number };
  /** Ensure model's lowest point clears the ground by this amount. */
  modelGroundClearance?: number;
  /** Baked clip names hidden from downstream UIs and filtered out on load. */
  deletedBakedAnimationClips?: string[];

  /** Marker groups for fallback behavior. */
  markerGroups?: MarkerGroup[];
  /** Global line styling defaults. */
  lineDefaults?: LineConfig;
  /** Global marker style defaults, overridden by per-region style. */
  markerDefaults?: Partial<MarkerStyleOverrides>;
}

/**
 * Optional downstream app metadata carried next to a profile.
 *
 * Loom3 does not treat these as a separate character configuration model; they
 * are preserved only for apps that store model records beside profile fields.
 */
export interface CharacterProfile extends ProfileRuntimeConfig {
  characterId?: string;
  characterName?: string;
  modelPath?: string;
}

export type ResolvedProfileRuntimeConfig<T extends CharacterProfile = CharacterProfile> = T & Profile & {
  annotationRegions?: Region[];
  regions?: Region[];
};

export type PresetBackedProfileRuntimeConfig = CharacterProfile & (
  | { profilePresetId: ProfilePresetId }
  | { presetId: ProfilePresetId }
  | { baseProfileId: ProfilePresetId }
  | { auPresetType: ProfilePresetId }
);

export type CustomProfileRuntimeConfig = CharacterProfile & (
  | { profilePresetId: 'custom' }
  | { presetId: 'custom' }
  | { baseProfileId: 'custom' }
  | { auPresetType: 'custom' }
);

export interface ProfileRegistry {
  profiles: CharacterProfile[];
  defaultProfile?: string;
}

/**
 * @deprecated Use `CharacterProfile` plus `profilePresetId` and
 * `annotationRegions`/`regions` instead. This alias is kept for downstream
 * apps that still persist LoomLarge-style character records.
 */
export type CharacterConfig = CharacterProfile & {
  characterId: string;
  characterName: string;
  modelPath: string;
  regions: Region[];
};

/**
 * @deprecated Use `ProfileRegistry`.
 */
export interface CharacterRegistry {
  characters: CharacterConfig[];
  defaultCharacter?: string;
}
