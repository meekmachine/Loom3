import { describe, expect, it } from 'vitest';
import type { AnnotationRegion } from '../mappings/types';
import {
  cloneAnnotationRegion,
  mergeAnnotationRegionsByName,
  removeAnnotationRegionByName,
  reorderAnnotationRegions,
  resetAnnotationRegionByName,
  validateAnnotationRegions,
} from './annotationRegions';

describe('annotationRegions helpers', () => {
  it('deep-clones nested annotation region fields', () => {
    const original: AnnotationRegion = {
      name: 'left_eye',
      bones: ['EYE_L'],
      cameraOffset: { x: 1 },
      customPosition: { x: 1, y: 2, z: 3 },
      style: {
        lineDirection: 'camera',
        line: { thickness: 2 },
      },
    };

    const cloned = cloneAnnotationRegion(original);
    cloned.bones?.push('EXTRA');
    cloned.cameraOffset!.x = 4;
    cloned.customPosition!.x = 9;
    cloned.style!.line!.thickness = 5;

    expect(original).toEqual({
      name: 'left_eye',
      bones: ['EYE_L'],
      cameraOffset: { x: 1 },
      customPosition: { x: 1, y: 2, z: 3 },
      style: {
        lineDirection: 'camera',
        line: { thickness: 2 },
      },
    });
  });

  it('merges annotation regions by name including customPosition', () => {
    const merged = mergeAnnotationRegionsByName(
      [
        {
          name: 'face',
          bones: ['HEAD'],
          style: { opacity: 0.5, line: { thickness: 2 } },
        },
      ],
      [
        {
          name: 'face',
          cameraAngle: 45,
          customPosition: { x: 1, y: 2, z: 3 },
          style: { lineDirection: 'camera', line: { length: 0.2 } },
        },
      ]
    );

    expect(merged).toEqual([
      {
        name: 'face',
        bones: ['HEAD'],
        cameraAngle: 45,
        customPosition: { x: 1, y: 2, z: 3 },
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

  it('removes, reorders, and resets annotation regions against a base preset list', () => {
    const base: AnnotationRegion[] = [
      { name: 'head', bones: ['HEAD'] },
      { name: 'left_eye', bones: ['EYE_L'], parent: 'head' },
      { name: 'right_eye', bones: ['EYE_R'], parent: 'head' },
    ];
    const current: AnnotationRegion[] = [
      { name: 'visor', objects: ['VisorMesh'] },
      { name: 'left_eye', bones: ['CUSTOM_EYE'], cameraAngle: 45 },
      { name: 'head', bones: ['CUSTOM_HEAD'] },
    ];

    const removed = removeAnnotationRegionByName(current, 'visor');
    expect(removed?.map((region) => region.name)).toEqual(['left_eye', 'head']);

    const reordered = reorderAnnotationRegions(current, ['head', 'left_eye']);
    expect(reordered?.map((region) => region.name)).toEqual(['head', 'left_eye', 'visor']);

    const resetExisting = resetAnnotationRegionByName(current, base, 'left_eye');
    expect(resetExisting?.find((region) => region.name === 'left_eye')).toEqual({
      name: 'left_eye',
      bones: ['EYE_L'],
      parent: 'head',
    });

    const resetMissingToBase = resetAnnotationRegionByName(current, base, 'right_eye');
    expect(resetMissingToBase?.map((region) => region.name)).toEqual(['visor', 'left_eye', 'head', 'right_eye']);
    expect(resetMissingToBase?.find((region) => region.name === 'right_eye')).toEqual({
      name: 'right_eye',
      bones: ['EYE_R'],
      parent: 'head',
    });

    const resetCustomOnly = resetAnnotationRegionByName(current, base, 'visor');
    expect(resetCustomOnly?.map((region) => region.name)).toEqual(['left_eye', 'head']);
  });

  it('validates duplicate names, hierarchy problems, invalid vectors, and unknown disabled regions', () => {
    const issues = validateAnnotationRegions(
      [
        {
          name: 'head',
          children: ['left_eye', 'missing_child'],
        },
        {
          name: 'left_eye',
          parent: 'face',
          style: {
            lineDirection: { x: 1, y: Number.NaN, z: 0 },
          },
        },
        {
          name: 'loop_a',
          children: ['loop_b'],
        },
        {
          name: 'loop_b',
          parent: 'loop_a',
          children: ['loop_a'],
          customPosition: { x: 1, y: 2, z: Number.POSITIVE_INFINITY },
        },
        {
          name: 'fallback_marker',
          isFallback: true,
        },
        {
          name: 'head',
          cameraOffset: { x: Number.NaN },
        },
      ],
      { disabledRegions: ['mouth'] }
    );

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate-region-name',
      'missing-parent',
      'missing-child',
      'inconsistent-parent-child',
      'cycle-detected',
      'invalid-camera-offset',
      'invalid-custom-position',
      'invalid-line-direction',
      'fallback-without-group',
      'unknown-disabled-region',
    ]));
  });

  it('returns no issues for a valid annotation region tree', () => {
    const issues = validateAnnotationRegions(
      [
        {
          name: 'head',
          children: ['left_eye'],
        },
        {
          name: 'left_eye',
          parent: 'head',
          customPosition: { x: 1, y: 2, z: 3 },
          style: {
            lineDirection: { x: 0, y: 1, z: 0 },
          },
          groupId: 'eyes',
        },
      ],
      { disabledRegions: ['left_eye'] }
    );

    expect(issues).toEqual([]);
  });
});
