import { describe, it, expect } from 'vitest';
import type { Profile } from '../../mappings/types';
import { validateMappings, validateMappingConfig } from '../validateMappings';
import { generateMappingCorrections } from '../generateMappingCorrections';

const createBaseConfig = (): Profile => ({
  auToMorphs: {},
  auToBones: {},
  boneNodes: { HEAD: 'Head' },
  morphToMesh: {},
  visemeKeys: [],
});

describe('validateMappingConfig', () => {
  it('flags missing bone nodes referenced by auToBones', () => {
    const config: Profile = {
      ...createBaseConfig(),
      auToBones: {
        1: [{ node: 'JAW', channel: 'rx', scale: 1 }],
      },
    };

    const result = validateMappingConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((issue) => issue.code === 'BONE_NODE_MISSING')).toBe(true);
  });

  it('flags composite axes missing negative/positive AUs', () => {
    const config: Profile = {
      ...createBaseConfig(),
      compositeRotations: [
        {
          node: 'HEAD',
          pitch: { aus: [1], axis: 'rx', negative: 2, positive: 3 },
          yaw: null,
          roll: null,
        },
      ],
    };

    const result = validateMappingConfig(config);
    expect(result.errors.some((issue) => issue.code === 'COMPOSITE_AU_MISSING')).toBe(true);
  });

  it('requires reciprocal continuum pairs', () => {
    const config: Profile = {
      ...createBaseConfig(),
      continuumPairs: {
        1: { pairId: 2, isNegative: true, axis: 'yaw', node: 'HEAD' },
      },
    };

    const result = validateMappingConfig(config);
    expect(result.errors.some((issue) => issue.code === 'CONTINUUM_PAIR_MISSING')).toBe(true);
  });

  it('warns when continuum pairs do not match composite axes', () => {
    const config: Profile = {
      ...createBaseConfig(),
      compositeRotations: [
        {
          node: 'HEAD',
          pitch: null,
          yaw: { aus: [1, 2], axis: 'ry', negative: 1, positive: 2 },
          roll: null,
        },
      ],
      continuumPairs: {
        1: { pairId: 2, isNegative: true, axis: 'pitch', node: 'HEAD' },
        2: { pairId: 1, isNegative: false, axis: 'pitch', node: 'HEAD' },
      },
    };

    const result = validateMappingConfig(config);
    expect(result.warnings.some((issue) => issue.code === 'CONTINUUM_COMPOSITE_MISMATCH')).toBe(true);
  });

  it('warns when AU info is missing for referenced AUs', () => {
    const config: Profile = {
      ...createBaseConfig(),
      auToMorphs: { 5: { left: [], right: [], center: ['Smile'] } },
      auInfo: {
        '1': { id: '1', name: 'Brow Raise' },
      },
    };

    const result = validateMappingConfig(config);
    expect(result.warnings.some((issue) => issue.code === 'AU_INFO_MISSING')).toBe(true);
  });
});

describe('validateMappings', () => {
  it('detects missing morph targets and bones', () => {
    const meshes = [
      { name: 'FaceMesh', morphTargetDictionary: { Smile: 0 } },
    ];
    const skeleton = { bones: [{ name: 'Head' }] };
    const config: Profile = {
      ...createBaseConfig(),
      auToMorphs: { 1: { left: [], right: [], center: ['Smile', 'Frown'] } },
      auToBones: { 2: [{ node: 'HEAD', channel: 'rx', scale: 1 }] },
    };

    const result = validateMappings(meshes, skeleton, config);
    expect(result.foundMorphs).toContain('Smile');
    expect(result.missingMorphs).toContain('Frown');
    expect(result.foundBones).toContain('Head');
  });

  it('reports missing meshes referenced by morphToMesh', () => {
    const meshes = [
      { name: 'FaceMesh', morphTargetDictionary: { Smile: 0 } },
    ];
    const skeleton = { bones: [{ name: 'Head' }] };
    const config: Profile = {
      ...createBaseConfig(),
      morphToMesh: {
        face: ['FaceMesh', 'MissingMesh'],
      },
    };

    const result = validateMappings(meshes, skeleton, config);
    expect(result.foundMeshes).toContain('FaceMesh');
    expect(result.missingMeshes).toContain('MissingMesh');
  });

  it('returns correction data when requested', () => {
    const meshes = [
      { name: 'FaceMesh', morphTargetDictionary: { Smile: 0 } },
    ];
    const skeleton = { bones: [{ name: 'Head' }] };
    const config: Profile = {
      ...createBaseConfig(),
      auToMorphs: { 1: { left: [], right: [], center: ['Smyle'] } },
    };

    const result = validateMappings(meshes, skeleton, config, { suggestCorrections: true });
    expect(result.suggestedConfig).toBeDefined();
    expect(result.corrections?.length).toBeGreaterThan(0);
  });
});

describe('generateMappingCorrections', () => {
  it('suggests corrected morph and mesh names using fuzzy matching', () => {
    const meshes = [
      { name: 'FaceMesh', morphTargetDictionary: { Smile: 0 } },
    ];
    const skeleton = { bones: [{ name: 'Head' }] };
    const config: Profile = {
      ...createBaseConfig(),
      auToMorphs: { 1: { left: [], right: [], center: ['Smyle'] } },
      morphToMesh: { face: ['FaceMsh'] },
    };

    const result = generateMappingCorrections(meshes, skeleton, config, { minConfidence: 0.5 });
    expect(result.corrections.some((c) => c.type === 'morph')).toBe(true);
    expect(result.corrections.some((c) => c.type === 'mesh')).toBe(true);
  });
});
