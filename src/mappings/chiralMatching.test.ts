import { describe, expect, it } from 'vitest';
import { getChiralCounterpartNodeKey, inferChiralBonePairs } from './chiralMatching';

describe('inferChiralBonePairs', () => {
  it('pairs common left/right bones beyond eyes', () => {
    const profile = {
      boneNodes: {
        EYE_L: 'CC_Base_L_Eye',
        EYE_R: 'CC_Base_R_Eye',
        HAND_L: 'CC_Base_L_Hand',
        HAND_R: 'CC_Base_R_Hand',
        FOOT_L: 'CC_Base_L_Foot',
        FOOT_R: 'CC_Base_R_Foot',
        HEAD: 'CC_Base_Head',
      },
    };

    const result = inferChiralBonePairs(profile);
    const stems = result.pairs.map((pair) => pair.stem);

    expect(stems).toContain('eye');
    expect(stems).toContain('hand');
    expect(stems).toContain('foot');
    expect(result.neutral.some((node) => node.nodeKey === 'HEAD')).toBe(true);
    expect(result.unpairedLeft).toHaveLength(0);
    expect(result.unpairedRight).toHaveLength(0);
  });

  it('uses bone names when semantic keys are non-chiral', () => {
    const profile = {
      boneNodes: {
        ARM_A: 'LeftUpperArm',
        ARM_B: 'RightUpperArm',
      },
    };

    const result = inferChiralBonePairs(profile);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].left.nodeKey).toBe('ARM_A');
    expect(result.pairs[0].right.nodeKey).toBe('ARM_B');
    expect(result.pairs[0].left.evidence).toBe('boneName');
  });

  it('reports unpaired chiral nodes', () => {
    const profile = {
      boneNodes: {
        LEG_L: 'L_Leg',
        HEAD: 'Head',
      },
    };

    const result = inferChiralBonePairs(profile);
    expect(result.pairs).toHaveLength(0);
    expect(result.unpairedLeft).toHaveLength(1);
    expect(result.unpairedLeft[0].nodeKey).toBe('LEG_L');
    expect(result.unpairedRight).toHaveLength(0);
  });
});

describe('getChiralCounterpartNodeKey', () => {
  const profile = {
    boneNodes: {
      EYE_L: 'CC_Base_L_Eye',
      EYE_R: 'CC_Base_R_Eye',
      HAND_L: 'CC_Base_L_Hand',
      HAND_R: 'CC_Base_R_Hand',
      HEAD: 'CC_Base_Head',
    },
  };

  it('returns opposite node key for a paired node', () => {
    expect(getChiralCounterpartNodeKey(profile, 'EYE_L')).toBe('EYE_R');
    expect(getChiralCounterpartNodeKey(profile, 'HAND_R')).toBe('HAND_L');
  });

  it('returns null when node is not chiral-paired', () => {
    expect(getChiralCounterpartNodeKey(profile, 'HEAD')).toBeNull();
    expect(getChiralCounterpartNodeKey(profile, 'UNKNOWN')).toBeNull();
  });
});
