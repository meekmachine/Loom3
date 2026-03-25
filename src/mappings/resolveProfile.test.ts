import { describe, it, expect } from 'vitest';
import type { Profile } from './types';
import { resolveProfile } from './resolveProfile';

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

describe('resolveProfile', () => {
  it('merges maps and overrides scalars', () => {
    const result = resolveProfile(basePreset, {
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
    const result = resolveProfile(basePreset, {
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
    resolveProfile(basePreset, {
      annotationRegions: [{ name: 'face', meshes: ['FaceMesh2'] }],
    });

    expect(basePreset.annotationRegions?.[0].meshes).toBeUndefined();
  });

  it('merges auFacePartToMeshCategory mappings', () => {
    const result = resolveProfile(basePreset, {
      auFacePartToMeshCategory: { Tongue: 'tongue' },
    });

    expect(result.auFacePartToMeshCategory).toEqual({
      Eye: 'eye',
      Tongue: 'tongue',
    });
  });

  it('compiles legacy viseme arrays from explicit viseme bindings while preserving canonical slots', () => {
    const result = resolveProfile(basePreset, {
      visemeBindings: {
        EE: { morph: 'viseme_ee', jawAmount: 0.2 },
        Ah: { morph: 'viseme_ah', jawAmount: 0.8 },
      },
    });

    expect(result.visemeBindings?.EE?.morph).toBe('viseme_ee');
    expect(result.visemeKeys).toHaveLength(15);
    expect(result.visemeKeys?.[0]).toBe('viseme_ee');
    expect(result.visemeKeys?.[1]).toBe('viseme_ah');
    expect(result.visemeKeys?.[2]).toBeUndefined();
    expect(result.visemeJawAmounts?.[0]).toBeCloseTo(0.2, 2);
    expect(result.visemeJawAmounts?.[1]).toBeCloseTo(0.8, 2);
  });
});
