import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { ClipHandle, ClipOptions, CurvesMap } from '../../../core/types';
import { HairPhysicsController, type HairPhysicsHost } from './HairPhysicsController';

function makeMorphMesh(
  name: string,
  morphKeys: string[] = [
    'L_Hair_Left',
    'L_Hair_Right',
    'L_Hair_Front',
    'Fluffy_Right',
    'Fluffy_Bottom_ALL',
    'Hairline_High_ALL',
    'Length_Short',
  ]
): Mesh {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.name = name;
  (mesh as any).morphTargetDictionary = Object.fromEntries(morphKeys.map((key, index) => [key, index]));
  (mesh as any).morphTargetInfluences = new Array(morphKeys.length).fill(0);
  return mesh;
}

function makeClipHandle(clipName: string): ClipHandle {
  return {
    clipName,
    play: () => {},
    stop: () => {},
    pause: () => {},
    resume: () => {},
    setWeight: () => {},
    setTime: () => {},
    getTime: () => 0,
    getDuration: () => 1,
    finished: Promise.resolve(),
  };
}

describe('HairPhysicsController mesh selection', () => {
  it('uses selected hair meshes from host config when building physics clips', () => {
    const hairA = makeMorphMesh('HairA');
    const hairB = makeMorphMesh('HairB');
    const meshes = new Map([
      [hairA.name, hairA],
      [hairB.name, hairB],
    ]);
    const selected = ['HairB'];
    const buildCalls: Array<{ clipName: string; meshNames: string[] }> = [];

    const host: HairPhysicsHost = {
      getMeshByName: (name) => meshes.get(name),
      getSelectedHairMeshNames: () => selected,
      buildClip: (clipName: string, _curves: CurvesMap, options?: ClipOptions) => {
        buildCalls.push({ clipName, meshNames: options?.meshNames || [] });
        return makeClipHandle(clipName);
      },
      cleanupSnippet: vi.fn(),
    };

    const controller = new HairPhysicsController(host);
    controller.registerHairObjects([hairA, hairB]);
    controller.setHairPhysicsEnabled(true);

    const idleCall = buildCalls.find((call) => call.clipName === 'hair_idle');
    expect(idleCall?.meshNames).toEqual(['HairB']);
  });

  it('refreshes running clip mesh targets when selected hair meshes change', () => {
    const hairA = makeMorphMesh('HairA');
    const hairB = makeMorphMesh('HairB');
    const meshes = new Map([
      [hairA.name, hairA],
      [hairB.name, hairB],
    ]);
    let selected = ['HairB'];
    const buildCalls: Array<{ clipName: string; meshNames: string[] }> = [];

    const host: HairPhysicsHost = {
      getMeshByName: (name) => meshes.get(name),
      getSelectedHairMeshNames: () => selected,
      buildClip: (clipName: string, _curves: CurvesMap, options?: ClipOptions) => {
        buildCalls.push({ clipName, meshNames: options?.meshNames || [] });
        return makeClipHandle(clipName);
      },
      cleanupSnippet: vi.fn(),
    };

    const controller = new HairPhysicsController(host);
    controller.registerHairObjects([hairA, hairB]);
    controller.setHairPhysicsEnabled(true);

    selected = ['HairA'];
    controller.refreshMeshSelection();

    const idleCalls = buildCalls.filter((call) => call.clipName === 'hair_idle');
    expect(idleCalls.length).toBeGreaterThan(1);
    expect(idleCalls[idleCalls.length - 1].meshNames).toEqual(['HairA']);
  });

  it('treats empty selected hair list as authoritative (no fallback to auto-detected hair meshes)', () => {
    const hairA = makeMorphMesh('HairA');
    const hairB = makeMorphMesh('HairB');
    const meshes = new Map([
      [hairA.name, hairA],
      [hairB.name, hairB],
    ]);
    const selected: string[] = [];
    const buildCalls: Array<{ clipName: string; meshNames: string[] }> = [];

    const host: HairPhysicsHost = {
      getMeshByName: (name) => meshes.get(name),
      getSelectedHairMeshNames: () => selected,
      buildClip: (clipName: string, _curves: CurvesMap, options?: ClipOptions) => {
        buildCalls.push({ clipName, meshNames: options?.meshNames || [] });
        return makeClipHandle(clipName);
      },
      cleanupSnippet: vi.fn(),
    };

    const controller = new HairPhysicsController(host);
    controller.registerHairObjects([hairA, hairB]);
    controller.setHairPhysicsEnabled(true);

    expect(buildCalls.length).toBe(0);
  });

  it('stops existing idle clip when selected hair meshes become empty', () => {
    const hairA = makeMorphMesh('HairA');
    const meshes = new Map([[hairA.name, hairA]]);
    let selected = ['HairA'];
    const buildCalls: Array<{ clipName: string; meshNames: string[] }> = [];
    let idleStopCount = 0;

    const host: HairPhysicsHost = {
      getMeshByName: (name) => meshes.get(name),
      getSelectedHairMeshNames: () => selected,
      buildClip: (clipName: string, _curves: CurvesMap, options?: ClipOptions) => {
        buildCalls.push({ clipName, meshNames: options?.meshNames || [] });
        return {
          ...makeClipHandle(clipName),
          stop: () => {
            if (clipName === 'hair_idle') idleStopCount += 1;
          },
        };
      },
      cleanupSnippet: vi.fn(),
    };

    const controller = new HairPhysicsController(host);
    controller.registerHairObjects([hairA]);
    controller.setHairPhysicsEnabled(true);

    const initialIdleBuildCount = buildCalls.filter((call) => call.clipName === 'hair_idle').length;
    expect(initialIdleBuildCount).toBe(1);

    selected = [];
    controller.refreshMeshSelection();

    const finalIdleBuildCount = buildCalls.filter((call) => call.clipName === 'hair_idle').length;
    expect(finalIdleBuildCount).toBe(1);
    expect(idleStopCount).toBeGreaterThan(0);
  });
});
