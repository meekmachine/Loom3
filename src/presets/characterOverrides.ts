import type { Profile } from '../mappings/types';

const JONATHAN_PROFILE_OVERRIDES: Partial<Profile> = {
  annotationRegions: [
    { name: 'face', paddingFactor: 1.1 },
    { name: 'left_eye', paddingFactor: 0.5, cameraAngle: 45 },
    { name: 'right_eye', paddingFactor: 0.5, cameraAngle: 315 },
  ],
};

const CHARACTER_PROFILE_OVERRIDES: Record<string, Partial<Profile>> = {
  jonathan: JONATHAN_PROFILE_OVERRIDES,
};

export function resolveCharacterProfileOverrides(
  characterId: string | undefined
): Partial<Profile> | undefined {
  if (!characterId) {
    return undefined;
  }

  return CHARACTER_PROFILE_OVERRIDES[characterId.toLowerCase()];
}
