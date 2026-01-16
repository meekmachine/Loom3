import { describe, it, expect } from 'vitest';
import type { Profile } from '../../mappings/types';
import { mergePreset } from '../mergePreset';

const basePreset: Profile = {
  name: 'base',
  auToMorphs: { 1: { left: [], right: [], center: ['A'] } },
  auToBones: { 51: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }] },
  boneNodes: { HEAD: 'Head' },
  morphToMesh: { face: ['FaceMesh'] },
  visemeKeys: ['viseme_aa'],
  annotationRegions: [
    {
      name: 'face',
      bones: ['Head'],
      paddingFactor: 1.3,
    },
  ],
};

describe('mergePreset', () => {
  it('merges maps and overrides scalars', () => {
    const result = mergePreset(basePreset, {
      name: 'override',
      auToMorphs: { 2: { left: [], right: [], center: ['B'] } },
      boneNodes: { HEAD: 'CC_Base_Head' },
    });

    expect(result.name).toBe('override');
    expect(result.auToMorphs[1]).toEqual({ left: [], right: [], center: ['A'] });
    expect(result.auToMorphs[2]).toEqual({ left: [], right: [], center: ['B'] });
    expect(result.boneNodes.HEAD).toBe('CC_Base_Head');
  });

  it('merges annotation regions by name', () => {
    const result = mergePreset(basePreset, {
      annotationRegions: [
        { name: 'face', meshes: ['FaceMesh2'], paddingFactor: 1.5 },
        { name: 'mouth', bones: ['Jaw'] },
      ],
    });

    const face = result.annotationRegions?.find(r => r.name === 'face');
    const mouth = result.annotationRegions?.find(r => r.name === 'mouth');

    expect(face?.meshes).toEqual(['FaceMesh2']);
    expect(face?.bones).toEqual(['Head']);
    expect(face?.paddingFactor).toBe(1.5);
    expect(mouth?.bones).toEqual(['Jaw']);
  });

  it('does not mutate the base preset', () => {
    mergePreset(basePreset, {
      annotationRegions: [{ name: 'face', meshes: ['FaceMesh2'] }],
    });

    expect(basePreset.annotationRegions?.[0].meshes).toBeUndefined();
  });
});
