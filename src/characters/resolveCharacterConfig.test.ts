import { describe, expect, it } from 'vitest';
import type { CharacterConfig } from './types';
import { resolvePresetWithOverrides } from '../presets';
import {
  applyCharacterProfileToPreset,
  extendCharacterConfigWithPreset,
  extractProfileOverrides,
  mergeRegionsByName,
  resolveCharacterConfig,
} from './resolveCharacterConfig';

function createConfig(overrides: Partial<CharacterConfig> = {}): CharacterConfig {
  return {
    characterId: 'jonathan',
    characterName: 'Jonathan',
    modelPath: '/jonathan.glb',
    auPresetType: 'cc4',
    regions: [],
    ...overrides,
  };
}

describe('mergeRegionsByName', () => {
  it('merges nested region fields by name while preserving preset geometry', () => {
    const merged = mergeRegionsByName(
      [
        {
          name: 'left_eye',
          bones: ['CC_Base_L_Eye'],
          paddingFactor: 1.2,
          style: { opacity: 0.5, line: { thickness: 2 } },
        },
      ],
      [
        {
          name: 'left_eye',
          cameraAngle: 45,
          style: { lineDirection: 'camera', line: { length: 0.2 } },
        },
      ]
    );

    expect(merged).toEqual([
      {
        name: 'left_eye',
        bones: ['CC_Base_L_Eye'],
        paddingFactor: 1.2,
        cameraAngle: 45,
        style: {
          opacity: 0.5,
          lineDirection: 'camera',
          line: {
            thickness: 2,
            length: 0.2,
          },
        },
      },
    ]);
  });
});

describe('extendCharacterConfigWithPreset', () => {
  it('lets saved top-level regions override preset defaults by region name', () => {
    const presetRegions = resolvePresetWithOverrides('cc4').annotationRegions ?? [];
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        regions: presetRegions.map((region) =>
          region.name === 'left_eye'
            ? { ...region, cameraAngle: 45, paddingFactor: 0.5 }
            : region.name === 'right_eye'
              ? { ...region, cameraAngle: 315, paddingFactor: 0.5 }
              : region.name === 'face'
                ? { ...region, paddingFactor: 1.1 }
                : { ...region }
        ),
      })
    );

    const head = resolved.regions.find((region) => region.name === 'head');
    const face = resolved.regions.find((region) => region.name === 'face');
    const leftEye = resolved.regions.find((region) => region.name === 'left_eye');
    const rightEye = resolved.regions.find((region) => region.name === 'right_eye');

    expect(head?.children).toEqual(['face', 'left_eye', 'right_eye', 'mouth']);
    expect(face).toMatchObject({
      parent: 'head',
      paddingFactor: 1.1,
    });
    expect(leftEye).toMatchObject({
      name: 'left_eye',
      parent: 'head',
      paddingFactor: 0.5,
    });
    expect(leftEye?.cameraAngle).toBe(45);
    expect(rightEye).toMatchObject({
      name: 'right_eye',
      parent: 'head',
      paddingFactor: 0.5,
    });
    expect(rightEye?.cameraAngle).toBe(315);
  });

  it('merges saved top-level regions over preset regions while preserving preset geometry', () => {
    const presetRightEye = resolvePresetWithOverrides('cc4').annotationRegions?.find(
      (region) => region.name === 'right_eye'
    );
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        regions: [
          { name: 'left_eye', cameraAngle: 45, paddingFactor: 0.5 },
          { name: 'hat', objects: ['HatMesh'], paddingFactor: 1.1 },
        ],
      })
    );

    const leftEye = resolved.regions.find((region) => region.name === 'left_eye');
    const rightEye = resolved.regions.find((region) => region.name === 'right_eye');
    const head = resolved.regions.find((region) => region.name === 'head');
    const hat = resolved.regions.find((region) => region.name === 'hat');

    expect(head).toBeTruthy();
    expect(leftEye).toMatchObject({
      name: 'left_eye',
      bones: ['CC_Base_L_Eye'],
      paddingFactor: 0.5,
      parent: 'head',
    });
    expect(leftEye?.cameraAngle).toBe(45);
    expect(rightEye).toMatchObject({
      name: 'right_eye',
      bones: ['CC_Base_R_Eye'],
      paddingFactor: presetRightEye?.paddingFactor,
      parent: 'head',
    });
    expect(head?.children).toEqual(['face', 'left_eye', 'right_eye', 'mouth']);
    expect(hat).toMatchObject({
      name: 'hat',
      objects: ['HatMesh'],
      paddingFactor: 1.1,
    });
  });

  it('preserves saved region order ahead of preset-only fill-ins', () => {
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        regions: [
          { name: 'full_body', objects: ['*'], paddingFactor: 2.5 },
          { name: 'head', bones: ['TRex_Head'], paddingFactor: 1.5 },
          { name: 'body', bones: ['TRex_Spine'], paddingFactor: 1.8 },
        ],
      })
    );

    const regionNames = resolved.regions.map((region) => region.name);

    expect(regionNames.slice(0, 7)).toEqual([
      'full_body',
      'head',
      'body',
      'face',
      'left_eye',
      'right_eye',
      'mouth',
    ]);
  });

  it('still honors legacy nested profile annotation overrides during migration', () => {
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        profile: {
          annotationRegions: [
            { name: 'left_eye', paddingFactor: 1.1, cameraAngle: 30 },
            { name: 'mouth', style: { lineDirection: 'camera' } },
          ],
        },
        regions: [
          { name: 'left_eye', cameraAngle: 45, paddingFactor: 0.5 },
        ],
      })
    );

    const leftEye = resolved.regions.find((region) => region.name === 'left_eye');
    const mouth = resolved.regions.find((region) => region.name === 'mouth');

    expect(leftEye).toMatchObject({
      name: 'left_eye',
      bones: ['CC_Base_L_Eye'],
      paddingFactor: 0.5,
      cameraAngle: 45,
      parent: 'head',
    });
    expect(mouth?.style).toMatchObject({
      lineDirection: 'camera',
    });
  });

  it('carries preset bone resolution metadata needed by runtime consumers', () => {
    const resolved = extendCharacterConfigWithPreset(createConfig());

    expect(resolved.suffixPattern).toBeDefined();
    expect(resolved.boneNodes).toBeDefined();
  });

  it('returns the full preset-extended profile surface instead of only bone metadata', () => {
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        morphToMesh: { face: ['CustomFace'] },
        meshes: { CustomFace: { category: 'body', morphCount: 1 } },
      })
    );

    expect(resolved.morphToMesh).toMatchObject({
      face: ['CustomFace'],
    });
    expect(resolved.meshes).toMatchObject({
      CustomFace: { category: 'body', morphCount: 1 },
    });
    expect(resolved.auToBones).toBeDefined();
    expect(resolved.auToMorphs).toBeDefined();
    expect(resolved.visemeKeys?.length).toBeGreaterThan(0);
  });

  it('merges saved top-level bone node overrides over preset bone mappings by key', () => {
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        auPresetType: 'fish',
        boneNodes: {
          HEAD: 'CustomHead',
          CUSTOM_FIN: '777',
        },
      })
    );

    expect(resolved.boneNodes).toMatchObject({
      HEAD: 'CustomHead',
      CUSTOM_FIN: '777',
      TAIL_BASE: '005',
      DORSAL_ROOT: '006',
    });
    expect(resolved.bonePrefix).toBe('Bone.');
    expect(resolved.boneSuffix).toBe('_Armature');
    expect(resolved.suffixPattern).toBe('_\\d+$|\\.\\d+$');
  });

  it('uses fish preset annotation regions when saved top-level regions are absent', () => {
    const resolved = extendCharacterConfigWithPreset(
      createConfig({
        auPresetType: 'fish',
        regions: [],
      })
    );

    expect(resolved.regions.map((region) => region.name)).toEqual([
      'full_body',
      'head',
      'left_eye',
      'right_eye',
      'mouth',
      'body',
      'tail',
      'dorsal_fin',
      'pectoral_fins',
      'pectoral_fin_left',
      'pectoral_fin_right',
      'ventral_fins',
      'gills',
      'throat',
      'gill',
    ]);
    expect(resolved.regions.find((region) => region.name === 'left_eye')).toMatchObject({
      meshes: ['EYES_0'],
      parent: 'head',
      cameraAngle: 270,
    });
  });

  it('keeps custom characters on their raw saved region list', () => {
    const config = createConfig({
      auPresetType: 'custom',
      regions: [{ name: 'visor', objects: ['VisorMesh'], paddingFactor: 1.4 }],
    });

    const resolved = extendCharacterConfigWithPreset(config);

    expect(resolved).toBe(config);
  });
});

describe('resolveCharacterConfig', () => {
  it('stays as a compatibility alias for the explicit extender helper', () => {
    const config = createConfig({
      morphToMesh: { face: ['CustomFace'] },
    });

    expect(resolveCharacterConfig(config)).toEqual(extendCharacterConfigWithPreset(config));
  });
});

describe('extractProfileOverrides', () => {
  it('flattens legacy nested profile overrides onto the top-level character profile shape', () => {
    const overrides = extractProfileOverrides(
      createConfig({
        bonePrefix: 'Top_',
        boneNodes: { HEAD: 'TopHead' },
        profile: {
          bonePrefix: 'Nested_',
          boneNodes: { HEAD: 'NestedHead', EYE_L: 'NestedEye' },
          meshes: { Head: { category: 'body', morphCount: 1 } },
        },
      })
    );

    expect(overrides.bonePrefix).toBe('Top_');
    expect(overrides.boneNodes).toMatchObject({
      HEAD: 'TopHead',
      EYE_L: 'NestedEye',
    });
    expect(overrides.meshes).toMatchObject({
      Head: { category: 'body', morphCount: 1 },
    });
    expect(overrides.annotationRegions).toBeUndefined();
  });
});

describe('applyCharacterProfileToPreset', () => {
  it('applies flattened character profile overrides on top of the selected preset', () => {
    const resolvedProfile = applyCharacterProfileToPreset(
      createConfig({
        morphToMesh: { face: ['CustomFace'] },
        meshes: { CustomFace: { category: 'body', morphCount: 1 } },
      })
    );

    expect(resolvedProfile?.morphToMesh.face).toEqual(['CustomFace']);
    expect(resolvedProfile?.meshes?.CustomFace).toMatchObject({
      category: 'body',
      morphCount: 1,
    });
  });
});
