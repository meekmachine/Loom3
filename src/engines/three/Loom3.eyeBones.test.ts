import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { Loom3 } from './Loom3';

const INDEPENDENT_EYE_CASES = [
  { auA: 65, auB: 66, node: 'EYE_L', otherNode: 'EYE_R', axisIndex: 2, label: 'left-eye yaw' },
  { auA: 67, auB: 68, node: 'EYE_L', otherNode: 'EYE_R', axisIndex: 0, label: 'left-eye pitch' },
  { auA: 69, auB: 70, node: 'EYE_R', otherNode: 'EYE_L', axisIndex: 2, label: 'right-eye yaw' },
  { auA: 71, auB: 72, node: 'EYE_R', otherNode: 'EYE_L', axisIndex: 0, label: 'right-eye pitch' },
] as const;

function makeEyeRig() {
  const model = new Object3D();

  const leftEye = new Object3D();
  leftEye.name = 'CC_Base_L_Eye';

  const rightEye = new Object3D();
  rightEye.name = 'CC_Base_R_Eye';

  model.add(leftEye, rightEye);
  return { model, leftEye, rightEye };
}

describe('Loom3 independent eye bone rotations', () => {
  it.each(INDEPENDENT_EYE_CASES)('setAU drives only the intended eye for $label', ({ auA, auB, node, otherNode, axisIndex }) => {
    const { model } = makeEyeRig();
    const engine = new Loom3({ presetType: 'cc4' });

    engine.onReady({ model, meshes: [] });

    engine.setAU(auA, 1);
    engine.update(1 / 60);
    const first = engine.getBones();
    const firstRotation = first[node].rotation[axisIndex];
    expect(Math.abs(firstRotation)).toBeGreaterThan(5);
    expect(Math.abs(first[otherNode].rotation[axisIndex])).toBeLessThan(0.001);

    engine.setAU(auA, 0);
    engine.setAU(auB, 1);
    engine.update(1 / 60);
    const second = engine.getBones();
    const secondRotation = second[node].rotation[axisIndex];
    expect(Math.abs(secondRotation)).toBeGreaterThan(5);
    expect(Math.abs(second[otherNode].rotation[axisIndex])).toBeLessThan(0.001);
    expect(Math.sign(firstRotation)).toBe(-Math.sign(secondRotation));
  });

  it.each(INDEPENDENT_EYE_CASES)('transitionAU drives only the intended eye for $label', ({ auA, auB, node, otherNode, axisIndex }) => {
    const { model } = makeEyeRig();
    const engine = new Loom3({ presetType: 'cc4' });

    engine.onReady({ model, meshes: [] });

    engine.transitionAU(auA, 1, 0);
    engine.update(1 / 60);
    const first = engine.getBones();
    const firstRotation = first[node].rotation[axisIndex];
    expect(Math.abs(firstRotation)).toBeGreaterThan(5);
    expect(Math.abs(first[otherNode].rotation[axisIndex])).toBeLessThan(0.001);

    engine.transitionAU(auA, 0, 0);
    engine.transitionAU(auB, 1, 0);
    engine.update(1 / 60);
    const second = engine.getBones();
    const secondRotation = second[node].rotation[axisIndex];
    expect(Math.abs(secondRotation)).toBeGreaterThan(5);
    expect(Math.abs(second[otherNode].rotation[axisIndex])).toBeLessThan(0.001);
    expect(Math.sign(firstRotation)).toBe(-Math.sign(secondRotation));
  });
});
