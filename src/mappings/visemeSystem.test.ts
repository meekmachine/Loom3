import { describe, expect, it } from 'vitest';
import type { Profile } from './types';
import {
  buildMappingEditorModel,
  compileVisemeKeys,
  getMeshNamesForVisemeProfile,
  getProfileVisemeSlots,
  getVisemeBindingTargets,
  getVisemeSlotIndex,
  mapProviderVisemeToSlot,
  resolveVisemeMeshCategory,
} from './visemeSystem';

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  auToMorphs: {},
  auToBones: {},
  boneNodes: {},
  morphToMesh: { face: ['FaceMesh'], viseme: ['VisemeMesh'] },
  visemeKeys: ['AA', 'BMP'],
  visemeSystemId: 'custom',
  visemeSlots: [
    {
      id: 'aa',
      label: 'AA',
      order: 0,
      providerIds: { azure: [1] },
      phonemes: ['AA'],
      matchers: ['(^|_)viseme_aa$'],
      defaultJawAmount: 0.7,
    },
    {
      id: 'bmp',
      label: 'B/M/P',
      order: 1,
      providerIds: { azure: [21] },
      phonemes: ['B', 'M', 'P'],
      matchers: ['(^|_)(viseme_)?bmp$'],
      features: { lipClosed: 1 },
      defaultJawAmount: 0,
    },
  ],
  ...overrides,
});

describe('viseme system helpers', () => {
  it('resolves profile-defined slots and slot ids', () => {
    const profile = makeProfile();

    expect(getProfileVisemeSlots(profile).map((slot) => slot.id)).toEqual(['aa', 'bmp']);
    expect(getVisemeSlotIndex(profile, 'bmp')).toBe(1);
    expect(getVisemeSlotIndex(profile, 'missing')).toBe(-1);
  });

  it('compiles authoring bindings back to legacy visemeKeys', () => {
    const profile = makeProfile({
      visemeBindings: {
        aa: { targets: [{ morph: 'Mouth_Aah' }] },
        bmp: { morph: 'Mouth_Closed' },
      },
    });

    expect(compileVisemeKeys(profile)).toEqual(['Mouth_Aah', 'Mouth_Closed']);
  });

  it('resolves all weighted targets for runtime playback', () => {
    const profile = makeProfile({
      visemeBindings: {
        aa: {
          targets: [
            { morph: 'Mouth_Aah' },
            { morph: 'Mouth_Wide', weight: 0.5 },
          ],
        },
      },
    });

    expect(getVisemeBindingTargets(profile, 0)).toEqual([
      { morph: 'Mouth_Aah', weight: 1 },
      { morph: 'Mouth_Wide', weight: 0.5 },
    ]);
    expect(getVisemeBindingTargets(profile, 1)).toEqual([{ morph: 'BMP', weight: 1 }]);
  });

  it('keeps explicit empty viseme mesh routes authoritative', () => {
    const profile = makeProfile({
      morphToMesh: { face: ['FaceMesh'], viseme: [] },
      visemeMeshCategory: 'viseme',
    });

    expect(resolveVisemeMeshCategory(profile)).toBe('viseme');
    expect(getMeshNamesForVisemeProfile(profile)).toEqual([]);
  });

  it('classifies regex viseme candidates without making them explicit mappings', () => {
    const model = buildMappingEditorModel(makeProfile(), ['viseme_aa', 'not_a_viseme']);
    const visemeCandidate = model.candidates.find((candidate) => candidate.morph === 'viseme_aa');
    const unmapped = model.candidates.find((candidate) => candidate.morph === 'not_a_viseme');

    expect(model.sections.some((section) => section.id === 'Visemes')).toBe(true);
    expect(visemeCandidate).toMatchObject({
      sectionId: 'Visemes',
      kind: 'candidate',
    });
    expect(visemeCandidate?.matches[0]).toMatchObject({ slotId: 'aa', reason: 'regex' });
    expect(unmapped).toMatchObject({ sectionId: 'Unmapped', kind: 'unmapped' });
  });

  it('uses profile mapping section metadata for ordering and mesh routing', () => {
    const model = buildMappingEditorModel(makeProfile({
      auInfo: {
        1: { name: 'Brow', facePart: 'Brows' } as any,
      },
      auFacePartToMeshCategory: { Brows: 'face' },
      mappingSections: [
        { id: 'Visemes', label: 'Speech', kind: 'viseme', order: 0, meshCategory: 'viseme' },
        { id: 'Brows', label: 'Brows', kind: 'au', order: 1, meshCategory: 'face', facePart: 'Brows' },
        { id: 'Unmapped', label: 'Unmapped', kind: 'unmapped', order: 2, meshCategory: 'face' },
      ],
    }));

    expect(model.sections.map((section) => section.id)).toEqual(['Visemes', 'Brows', 'Unmapped']);
    expect(model.sections[0]).toMatchObject({ label: 'Speech', meshCategory: 'viseme' });
  });

  it('maps provider viseme ids and phonemes to active profile slots', () => {
    const profile = makeProfile();

    expect(mapProviderVisemeToSlot(profile, { provider: 'azure', id: 21 })).toMatchObject({
      slotId: 'bmp',
      index: 1,
      reason: 'provider',
    });
    expect(mapProviderVisemeToSlot(profile, { provider: 'unknown', phoneme: 'AA' })).toMatchObject({
      slotId: 'aa',
      index: 0,
      reason: 'phoneme',
    });
  });
});
