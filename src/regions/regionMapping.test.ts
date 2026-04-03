import { describe, expect, it } from 'vitest';
import { fuzzyNameMatch, resolveBoneName } from './regionMapping';

describe('resolveBoneName', () => {
  it('builds prefixed/suffixed bone names from semantic nodes', () => {
    expect(
      resolveBoneName('HEAD', {
        characterId: 'betta',
        characterName: 'Betta',
        modelPath: 'characters/betta/scene.gltf',
        regions: [],
        bonePrefix: 'Bone.',
        boneSuffix: '_Armature',
        boneNodes: { HEAD: '001' },
      })
    ).toBe('Bone.001_Armature');
  });
});

describe('fuzzyNameMatch', () => {
  it('treats separator-normalized names as equivalent', () => {
    expect(fuzzyNameMatch('Bone001_Armature', 'Bone.001_Armature', '_\\d+$|\\.\\d+$')).toBe(true);
  });
});
