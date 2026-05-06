import { describe, expect, it } from 'vitest';
import { fuzzyNameMatch, resolveBoneName, resolveBoneNames } from './regionMapping';

describe('resolveBoneName', () => {
  it('builds prefixed/suffixed bone names from semantic nodes', () => {
    expect(
      resolveBoneName('HEAD', {
        bonePrefix: 'Bone.',
        boneSuffix: '_Armature',
        boneNodes: { HEAD: '001' },
      })
    ).toBe('Bone.001_Armature');
  });
});

describe('resolveBoneNames', () => {
  it('tries both prefixed and exact node-name candidates for semantic region bones', () => {
    expect(
      resolveBoneNames(['EYE_L', 'HAND_L'], {
        bonePrefix: 'TRex_',
        boneNodes: {
          EYE_L: 'eye_L',
          HAND_L: 'L_Hand',
        },
      })
    ).toEqual(['TRex_eye_L', 'eye_L', 'TRex_L_Hand', 'L_Hand']);
  });
});

describe('fuzzyNameMatch', () => {
  it('treats separator-normalized names as equivalent', () => {
    expect(fuzzyNameMatch('Bone001_Armature', 'Bone.001_Armature', '_\\d+$|\\.\\d+$')).toBe(true);
  });
});
