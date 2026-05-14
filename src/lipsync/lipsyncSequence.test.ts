import { describe, expect, it } from 'vitest';
import type { Profile } from '../mappings/types';
import { CC4_PRESET } from '../presets/cc4';
import { compileLipsyncSequence } from './lipsyncSequence';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    auToMorphs: {},
    auToBones: {},
    boneNodes: {},
    morphToMesh: { face: ['FaceMesh'], viseme: ['VisemeMesh'] },
    visemeKeys: ['Mouth_Aah', 'Mouth_Closed'],
    visemeSlots: [
      { id: 'aa', label: 'AA', order: 0, providerIds: { azure: [1] }, defaultJawAmount: 0.7 },
      { id: 'bmp', label: 'B/M/P', order: 1, providerIds: { azure: [21] }, defaultJawAmount: 0 },
    ],
    visemeMeshCategory: 'viseme',
    visemeJawAmounts: [0.7, 0],
    ...overrides,
  };
}

describe('compileLipsyncSequence', () => {
  it('compiles raw Microsoft/Azure viseme timing without pre-collapsing source ids', () => {
    const compiled = compileLipsyncSequence(
      CC4_PRESET,
      [
        { visemeId: 21, audioOffset: 2_000_000, animation: { frameIndex: 1 } },
        { viseme_id: 1, audio_offset: 4_000_000 },
      ],
      { sourceProvider: 'microsoft', timeUnit: 'ticks', name: 'ms-visemes' }
    );

    expect(compiled.name).toBe('ms-visemes');
    expect(compiled.events[0]).toMatchObject({
      sourceId: 21,
      slotId: 'b-m-p',
      slotIndex: 2,
      offsetMs: 200,
      durationMs: 200,
      animation: { frameIndex: 1 },
    });
    expect(compiled.events[1]).toMatchObject({
      sourceId: 1,
      slotId: 'ah',
      slotIndex: 1,
      offsetMs: 400,
    });
    expect(compiled.curves['2']).toBeDefined();
    expect(compiled.curves['1']).toBeDefined();
    expect(compiled.clipOptions).toMatchObject({
      snippetCategory: 'visemeSnippet',
      autoVisemeJaw: true,
    });
  });

  it('supports reverse source maps keyed by profile slot id', () => {
    const compiled = compileLipsyncSequence(
      makeProfile(),
      [{ id: 9, time: 0 }],
      {
        sourceProvider: 'custom',
        sourceVisemeMap: { aa: [9] },
      }
    );

    expect(compiled.events[0]).toMatchObject({
      sourceId: 9,
      slotId: 'aa',
      slotIndex: 0,
    });
    expect(compiled.curves['0']).toBeDefined();
  });

  it('adds direct morph override curves and per-viseme jaw overrides', () => {
    const compiled = compileLipsyncSequence(
      makeProfile(),
      [{ visemeId: 1, time: 0, duration: 0.12 }],
      {
        sourceProvider: 'azure',
        morphTargetToViseme: { Custom_Aah: 'aa' },
        jawActivation: { aa: 0.25 },
      }
    );

    expect(compiled.curves.Custom_Aah).toEqual(compiled.curves['0']);
    expect(compiled.clipOptions.meshNames).toEqual(['VisemeMesh']);
    expect(compiled.clipOptions.visemeJawAmounts?.[0]).toBe(0.25);
    expect(compiled.clipOptions.visemeJawAmounts?.[1]).toBe(0);
  });

  it('accepts parallel viseme and timing arrays for legacy snippet callers', () => {
    const compiled = compileLipsyncSequence(
      makeProfile(),
      {
        visemes: [1, 21],
        vtimes: [0, 120],
        vdurations: [80, 60],
      },
      { sourceProvider: 'azure' }
    );

    expect(compiled.events.map((event) => event.slotId)).toEqual(['aa', 'bmp']);
    expect(compiled.events.map((event) => event.durationMs)).toEqual([80, 60]);
  });

  it('passes existing viseme snippet JSON through as mixer clip curves', () => {
    const compiled = compileLipsyncSequence(
      makeProfile(),
      {
        name: 'snippet',
        snippetCategory: 'visemeSnippet',
        snippetJawScale: 0.4,
        snippetIntensityScale: 0.8,
        snippetPlaybackRate: 1.2,
        curves: {
          0: [
            { time: 0, intensity: 0 },
            { time: 0.1, intensity: 1 },
          ],
        },
      }
    );

    expect(compiled.events).toEqual([]);
    expect(compiled.curves['0']).toEqual([
      { time: 0, intensity: 0, inherit: undefined },
      { time: 0.1, intensity: 1, inherit: undefined },
    ]);
    expect(compiled.clipOptions).toMatchObject({
      jawScale: 0.4,
      intensityScale: 0.8,
      playbackRate: 1.2,
      snippetCategory: 'visemeSnippet',
    });
  });
});
