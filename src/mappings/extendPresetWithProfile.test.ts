import { describe, it, expect } from 'vitest';
import type { Profile } from './types';
import { extendPresetWithProfile } from './extendPresetWithProfile';

const basePreset: Profile = {
  name: 'base',
  auToMorphs: { 1: { left: [], right: [], center: ['A'] } },
  auToBones: { 51: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }] },
  boneNodes: { HEAD: 'Head' },
  morphToMesh: { face: ['FaceMesh'] },
  auFacePartToMeshCategory: { Eye: 'eye' },
  visemeKeys: ['viseme_aa'],
  visemeMeshCategory: 'viseme',
  annotationRegions: [
    {
      name: 'face',
      bones: ['Head'],
      paddingFactor: 1.3,
    },
  ],
};

describe('extendPresetWithProfile', () => {
  it('merges maps and overrides scalars', () => {
    const result = extendPresetWithProfile(basePreset, {
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
    const result = extendPresetWithProfile(basePreset, {
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

  it('carries disabled region names without pruning annotation regions', () => {
    const result = extendPresetWithProfile(
      {
        ...basePreset,
        annotationRegions: [
          {
            name: 'head',
            children: ['face', 'mouth'],
          },
          ...(basePreset.annotationRegions ?? []),
          {
            name: 'mouth',
            parent: 'head',
            bones: ['Jaw'],
          },
        ],
      },
      {
        disabledRegions: ['mouth'],
      }
    );

    expect(result.disabledRegions).toEqual(['mouth']);
    expect(result.annotationRegions?.find((region) => region.name === 'mouth')).toMatchObject({
      parent: 'head',
      bones: ['Jaw'],
    });
    expect(result.annotationRegions?.find((region) => region.name === 'head')?.children).toEqual(['face', 'mouth']);
  });

  it('does not mutate the base preset', () => {
    extendPresetWithProfile(basePreset, {
      annotationRegions: [{ name: 'face', meshes: ['FaceMesh2'] }],
    });

    expect(basePreset.annotationRegions?.[0].meshes).toBeUndefined();
  });

  it('merges auFacePartToMeshCategory mappings', () => {
    const result = extendPresetWithProfile(basePreset, {
      auFacePartToMeshCategory: { Tongue: 'tongue' },
    });

    expect(result.auFacePartToMeshCategory).toEqual({
      Eye: 'eye',
      Tongue: 'tongue',
    });
  });
});

describe('extendPresetWithProfile reuse', () => {
  it('returns the base preset unchanged when no extension is provided', () => {
    expect(extendPresetWithProfile(basePreset)).toBe(basePreset);
  });

  it('applies a profile extension on top of the preset', () => {
    const result = extendPresetWithProfile(basePreset, {
      morphToMesh: { face: ['CustomFace'] },
    });

    expect(result.morphToMesh.face).toEqual(['CustomFace']);
  });
});
