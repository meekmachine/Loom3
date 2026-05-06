import { describe, expect, it } from 'vitest';
import type { CharacterConfig } from './types';
import type { Profile } from '../mappings/types';
import { getPresetWithProfile } from '../presets';
import { resolveBoneNames } from '../regions/regionMapping';
import type { Region } from '../regions/types';
import {
  extendProfileConfigWithPreset,
  extractLegacyCharacterProfileOverrides,
  mergeProfileRegionsByName,
  resolveProfileFromPreset,
} from './resolveProfileConfig';

function createConfig(overrides: Partial<CharacterConfig> = {}): CharacterConfig {
  return {
    characterId: 'jonathan',
    characterName: 'Jonathan',
    modelPath: '/jonathan.glb',
    profilePresetId: 'cc4',
    regions: [],
    ...overrides,
  };
}

type Expect<T extends true> = T;

const inferredRuntimeProfileConfig = extendProfileConfigWithPreset({
  profilePresetId: 'cc4',
  regions: [],
});

type InferredRuntimeProfileHasResolvedSurface = Expect<
  typeof inferredRuntimeProfileConfig extends {
    auToMorphs: Profile['auToMorphs'];
    boneNodes: Profile['boneNodes'];
    regions?: Region[];
  }
    ? true
    : false
>;

describe('mergeProfileRegionsByName', () => {
  it('merges nested region fields by name while preserving preset geometry', () => {
    const merged = mergeProfileRegionsByName(
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

  it('merges nested camera offsets by axis instead of replacing the whole vector', () => {
    const merged = mergeProfileRegionsByName(
      [
        {
          name: 'head',
          cameraOffset: { x: 1, y: 2, z: 3 },
        },
      ],
      [
        {
          name: 'head',
          cameraOffset: { y: 9 },
        },
      ]
    );

    expect(merged).toEqual([
      {
        name: 'head',
        cameraOffset: { x: 1, y: 9, z: 3 },
      },
    ]);
  });
});

describe('extendProfileConfigWithPreset', () => {
  it('lets saved annotationRegions override preset defaults by region name', () => {
    const presetRegions = getPresetWithProfile('cc4').annotationRegions ?? [];
    const extended = extendProfileConfigWithPreset(
      createConfig({
        annotationRegions: presetRegions.map((region) =>
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

    const head = extended.regions.find((region) => region.name === 'head');
    const face = extended.regions.find((region) => region.name === 'face');
    const leftEye = extended.regions.find((region) => region.name === 'left_eye');
    const rightEye = extended.regions.find((region) => region.name === 'right_eye');

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
    expect(extended.annotationRegions?.find((region) => region.name === 'left_eye')).toMatchObject({
      cameraAngle: 45,
      paddingFactor: 0.5,
    });
  });

  it('keeps preset order when canonical annotationRegions only override a subset', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        annotationRegions: [
          { name: 'left_eye', cameraAngle: 45, paddingFactor: 0.5 },
        ],
      })
    );

    expect(extended.regions.slice(0, 6).map((region) => region.name)).toEqual([
      'full_body',
      'head',
      'face',
      'left_eye',
      'right_eye',
      'mouth',
    ]);
    expect(extended.regions.find((region) => region.name === 'left_eye')).toMatchObject({
      name: 'left_eye',
      bones: ['EYE_L'],
      cameraAngle: 45,
      paddingFactor: 0.5,
      parent: 'head',
    });
  });

  it('treats saved top-level regions as a legacy fallback when annotationRegions are absent', () => {
    const presetRightEye = getPresetWithProfile('cc4').annotationRegions?.find(
      (region) => region.name === 'right_eye'
    );
    const extended = extendProfileConfigWithPreset(
      createConfig({
        regions: [
          { name: 'left_eye', cameraAngle: 45, paddingFactor: 0.5 },
          { name: 'hat', objects: ['HatMesh'], paddingFactor: 1.1 },
        ],
      })
    );

    const leftEye = extended.regions.find((region) => region.name === 'left_eye');
    const rightEye = extended.regions.find((region) => region.name === 'right_eye');
    const head = extended.regions.find((region) => region.name === 'head');
    const hat = extended.regions.find((region) => region.name === 'hat');

    expect(head).toBeTruthy();
    expect(leftEye).toMatchObject({
      name: 'left_eye',
      bones: ['EYE_L'],
      paddingFactor: 0.5,
      parent: 'head',
    });
    expect(leftEye?.cameraAngle).toBe(45);
    expect(rightEye).toMatchObject({
      name: 'right_eye',
      bones: ['EYE_R'],
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
    const extended = extendProfileConfigWithPreset(
      createConfig({
        regions: [
          { name: 'full_body', objects: ['*'], paddingFactor: 2.5 },
          { name: 'head', bones: ['TRex_Head'], paddingFactor: 1.5 },
          { name: 'body', bones: ['TRex_Spine'], paddingFactor: 1.8 },
        ],
      })
    );

    const regionNames = extended.regions.map((region) => region.name);

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

  it('prefers canonical annotationRegions over legacy regions while preserving legacy extras', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        profile: {
          annotationRegions: [
            { name: 'left_eye', paddingFactor: 1.1, cameraAngle: 30 },
            { name: 'mouth', style: { lineDirection: 'camera' } },
          ],
        },
        regions: [
          { name: 'left_eye', cameraAngle: 45, paddingFactor: 0.5 },
          { name: 'hat', objects: ['HatMesh'], paddingFactor: 1.4 },
        ],
      })
    );

    const leftEye = extended.regions.find((region) => region.name === 'left_eye');
    const mouth = extended.regions.find((region) => region.name === 'mouth');
    const hat = extended.regions.find((region) => region.name === 'hat');

    expect(leftEye).toMatchObject({
      name: 'left_eye',
      bones: ['EYE_L'],
      paddingFactor: 1.1,
      cameraAngle: 30,
      parent: 'head',
    });
    expect(mouth?.style).toMatchObject({
      lineDirection: 'camera',
    });
    expect(hat).toMatchObject({
      name: 'hat',
      objects: ['HatMesh'],
      paddingFactor: 1.4,
    });
  });

  it('drops disabled preset regions after extension and cleans parent-child links', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        disabledRegions: ['mouth', 'right_eye'],
      })
    );

    expect(extended.disabledRegions).toEqual(['mouth', 'right_eye']);
    expect(extended.regions.find((region) => region.name === 'mouth')).toBeUndefined();
    expect(extended.regions.find((region) => region.name === 'right_eye')).toBeUndefined();
    expect(extended.regions.find((region) => region.name === 'head')?.children).toEqual([
      'face',
      'left_eye',
    ]);
  });

  it('carries preset bone metadata needed by runtime consumers', () => {
    const extended = extendProfileConfigWithPreset(createConfig());

    expect(extended.suffixPattern).toBeDefined();
    expect(extended.boneNodes).toBeDefined();
  });

  it('lets semantic annotation region bones use preset bone nodes plus profile affixes', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        characterId: 'trex',
        characterName: 'T-Rex',
        bonePrefix: 'TRex_',
        boneNodes: {
          HEAD: 'Head',
          JAW: 'Jaw',
          EYE_L: 'eye_L',
          EYE_R: 'eye_R',
        },
      })
    );

    const head = extended.regions.find((region) => region.name === 'head');
    const leftEye = extended.regions.find((region) => region.name === 'left_eye');
    const leftHand = extended.regions.find((region) => region.name === 'left_hand');
    const leftFoot = extended.regions.find((region) => region.name === 'left_foot');

    expect(head?.bones).toEqual(['HEAD', 'JAW']);
    expect(resolveBoneNames(head?.bones, extended)).toEqual(['TRex_Head', 'Head', 'TRex_Jaw', 'Jaw']);
    expect(resolveBoneNames(leftEye?.bones, extended)).toEqual(['TRex_eye_L', 'eye_L']);
    expect(resolveBoneNames(leftHand?.bones, extended)).toEqual(['TRex_L_Hand', 'L_Hand']);
    expect(resolveBoneNames(leftFoot?.bones, extended)).toEqual([
      'TRex_L_Foot',
      'L_Foot',
      'TRex_L_ToeBase',
      'L_ToeBase',
    ]);
  });

  it('returns the full preset-extended profile surface instead of only bone metadata', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        morphToMesh: { face: ['CustomFace'] },
        meshes: { CustomFace: { category: 'body', morphCount: 1 } },
      })
    );

    expect(extended.morphToMesh).toMatchObject({
      face: ['CustomFace'],
    });
    expect(extended.meshes).toMatchObject({
      CustomFace: { category: 'body', morphCount: 1 },
    });
    expect(extended.auToBones).toBeDefined();
    expect(extended.auToMorphs).toBeDefined();
    expect(extended.visemeKeys?.length).toBeGreaterThan(0);
  });

  it('merges saved top-level bone node overrides over preset bone mappings by key', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        profilePresetId: 'fish',
        boneNodes: {
          HEAD: 'CustomHead',
          CUSTOM_FIN: '777',
        },
      })
    );

    expect(extended.boneNodes).toMatchObject({
      HEAD: 'CustomHead',
      CUSTOM_FIN: '777',
      TAIL_BASE: '005',
      DORSAL_ROOT: '006',
    });
    expect(extended.bonePrefix).toBe('Bone.');
    expect(extended.boneSuffix).toBe('_Armature');
    expect(extended.suffixPattern).toBe('_\\d+$|\\.\\d+$');
  });

  it('uses fish preset annotation regions when saved top-level regions are absent', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        profilePresetId: 'fish',
        regions: [],
      })
    );

    expect(extended.regions.map((region) => region.name)).toEqual([
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
      'gill_left',
      'gill_right',
    ]);
    expect(extended.regions.find((region) => region.name === 'left_eye')).toMatchObject({
      meshes: ['EYES_0'],
      parent: 'head',
      cameraAngle: 270,
    });
    expect(extended.regions.find((region) => region.name === 'gill_left')).toMatchObject({
      parent: 'gills',
      style: { lineDirection: 'left' },
    });
  });

  it('keeps auPresetType as a deprecated preset id fallback', () => {
    const extended = extendProfileConfigWithPreset(
      createConfig({
        profilePresetId: undefined,
        auPresetType: 'fish',
        regions: [],
      })
    );

    expect(extended.bonePrefix).toBe('Bone.');
    expect(extended.regions.map((region) => region.name)).toContain('tail');
  });

  it('keeps custom profile configs on their raw saved region list', () => {
    const config = createConfig({
      profilePresetId: 'custom',
      regions: [{ name: 'visor', objects: ['VisorMesh'], paddingFactor: 1.4 }],
    });

    const extended = extendProfileConfigWithPreset(config);

    expect(extended).toBe(config);
  });
});

describe('extractLegacyCharacterProfileOverrides', () => {
  it('flattens legacy nested profile overrides onto the top-level character profile shape', () => {
    const overrides = extractLegacyCharacterProfileOverrides(
      createConfig({
        bonePrefix: 'Top_',
        boneNodes: { HEAD: 'TopHead' },
        disabledRegions: ['mouth'],
        profile: {
          bonePrefix: 'Nested_',
          boneNodes: { HEAD: 'NestedHead', EYE_L: 'NestedEye' },
          meshes: { Head: { category: 'body', morphCount: 1 } },
          disabledRegions: ['left_eye'],
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
    expect(overrides.disabledRegions).toEqual(['mouth']);
    expect(overrides.annotationRegions).toBeUndefined();
  });

  it('prefers canonical annotationRegions over legacy runtime regions during extraction', () => {
    const overrides = extractLegacyCharacterProfileOverrides(
      createConfig({
        annotationRegions: [
          { name: 'left_eye', cameraAngle: 30, paddingFactor: 1.1 },
        ],
        regions: [
          { name: 'left_eye', cameraAngle: 45, paddingFactor: 0.5 },
          { name: 'hat', objects: ['HatMesh'], paddingFactor: 1.4 },
        ],
      })
    );

    expect(overrides.annotationRegions).toEqual([
      { name: 'left_eye', cameraAngle: 30, paddingFactor: 1.1 },
    ]);
  });
});

describe('resolveProfileFromPreset', () => {
  it('applies flattened character profile overrides on top of the selected preset', () => {
    const extendedPreset = resolveProfileFromPreset(
      createConfig({
        morphToMesh: { face: ['CustomFace'] },
        meshes: { CustomFace: { category: 'body', morphCount: 1 } },
      })
    );

    expect(extendedPreset?.morphToMesh.face).toEqual(['CustomFace']);
    expect(extendedPreset?.meshes?.CustomFace).toMatchObject({
      category: 'body',
      morphCount: 1,
    });
  });
});
