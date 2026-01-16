import { describe, it, expect } from 'vitest';
import {
  AU_TO_MORPHS,
  BONE_AU_TO_BINDINGS,
  COMPOSITE_ROTATIONS,
  CONTINUUM_PAIRS_MAP,
  VISEME_KEYS,
  isMixedAU,
  hasLeftRightMorphs,
  hasLeftRightBones,
} from '../cc4';

describe('CC4 Preset', () => {
  describe('AU_TO_MORPHS', () => {
    it('should have mappings for standard facial AUs', () => {
      // Brows
      expect(AU_TO_MORPHS[1].left).toContain('Brow_Raise_Inner_L');
      expect(AU_TO_MORPHS[2].left).toContain('Brow_Raise_Outer_L');
      expect(AU_TO_MORPHS[4].left).toContain('Brow_Drop_L');

      // Eyes
      expect(AU_TO_MORPHS[5].left).toContain('Eye_Wide_L');
      expect(AU_TO_MORPHS[7].left).toContain('Eye_Squint_L');
      expect(AU_TO_MORPHS[43].left).toContain('Eye_Blink_L');

      // Mouth
      expect(AU_TO_MORPHS[12].left).toContain('Mouth_Smile_L');
      expect(AU_TO_MORPHS[15].left).toContain('Mouth_Frown_L');
      expect(AU_TO_MORPHS[18].center).toContain('Mouth_Pucker');
      expect(AU_TO_MORPHS[26].center).toContain('Jaw_Open');
    });

    it('should have mappings for head position AUs (51-56)', () => {
      expect(AU_TO_MORPHS[51].left).toContain('Head_Turn_L');
      expect(AU_TO_MORPHS[52].right).toContain('Head_Turn_R');
      expect(AU_TO_MORPHS[53].center).toContain('Head_Turn_Up');
      expect(AU_TO_MORPHS[54].center).toContain('Head_Turn_Down');
      expect(AU_TO_MORPHS[55].left).toContain('Head_Tilt_L');
      expect(AU_TO_MORPHS[56].right).toContain('Head_Tilt_R');
    });

    it('should have mappings for eye direction AUs (61-64)', () => {
      expect(AU_TO_MORPHS[61].left).toContain('Eye_L_Look_L');
      expect(AU_TO_MORPHS[62].right).toContain('Eye_L_Look_R');
      expect(AU_TO_MORPHS[63].center).toContain('Eye_L_Look_Up');
      expect(AU_TO_MORPHS[64].center).toContain('Eye_L_Look_Down');
    });

    it('should have bilateral morphs (L and R) for applicable AUs', () => {
      // Most facial AUs should have both L and R variants
      const bilateralAUs = [1, 2, 4, 5, 6, 7, 12, 15, 43];
      for (const auId of bilateralAUs) {
        const morphs = AU_TO_MORPHS[auId];
        const hasLeft = morphs.left.some(m => /_L$|Left$/i.test(m));
        const hasRight = morphs.right.some(m => /_R$|Right$/i.test(m));
        expect(hasLeft, `AU ${auId} should have left morph`).toBe(true);
        expect(hasRight, `AU ${auId} should have right morph`).toBe(true);
      }
    });
  });

  describe('BONE_AU_TO_BINDINGS', () => {
    it('should have bone bindings for head AUs (51-56)', () => {
      // Head turn left
      expect(BONE_AU_TO_BINDINGS[51]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[51][0].node).toBe('HEAD');
      expect(BONE_AU_TO_BINDINGS[51][0].channel).toBe('ry');

      // Head turn right
      expect(BONE_AU_TO_BINDINGS[52]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[52][0].node).toBe('HEAD');

      // Head up/down
      expect(BONE_AU_TO_BINDINGS[53]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[53][0].channel).toBe('rx');
      expect(BONE_AU_TO_BINDINGS[54]).toBeDefined();

      // Head tilt
      expect(BONE_AU_TO_BINDINGS[55]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[55][0].channel).toBe('rz');
      expect(BONE_AU_TO_BINDINGS[56]).toBeDefined();
    });

    it('should have bone bindings for eye AUs (61-64)', () => {
      // Eyes look left/right (horizontal)
      expect(BONE_AU_TO_BINDINGS[61]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[61].length).toBe(2); // EYE_L and EYE_R
      expect(BONE_AU_TO_BINDINGS[61][0].node).toBe('EYE_L');
      expect(BONE_AU_TO_BINDINGS[61][1].node).toBe('EYE_R');
      expect(BONE_AU_TO_BINDINGS[61][0].channel).toBe('rz'); // CC4 uses rz for horizontal

      expect(BONE_AU_TO_BINDINGS[62]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[62].length).toBe(2);

      // Eyes look up/down (vertical)
      expect(BONE_AU_TO_BINDINGS[63]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[63][0].channel).toBe('rx'); // rx for vertical
      expect(BONE_AU_TO_BINDINGS[64]).toBeDefined();
    });

    it('should have correct maxDegrees for head rotation', () => {
      // Head yaw should allow reasonable rotation range (typically 45-65 degrees)
      expect(BONE_AU_TO_BINDINGS[51][0].maxDegrees).toBeGreaterThanOrEqual(30);
      expect(BONE_AU_TO_BINDINGS[51][0].maxDegrees).toBeLessThanOrEqual(90);

      // Head pitch should allow reasonable rotation range
      expect(BONE_AU_TO_BINDINGS[53][0].maxDegrees).toBeGreaterThanOrEqual(20);
      expect(BONE_AU_TO_BINDINGS[53][0].maxDegrees).toBeLessThanOrEqual(45);
    });

    it('should have jaw bone binding for AU 26', () => {
      expect(BONE_AU_TO_BINDINGS[26]).toBeDefined();
      expect(BONE_AU_TO_BINDINGS[26][0].node).toBe('JAW');
    });
  });

  describe('COMPOSITE_ROTATIONS', () => {
    it('should include HEAD composite', () => {
      const head = COMPOSITE_ROTATIONS.find(c => c.node === 'HEAD');
      expect(head).toBeDefined();
      expect(head!.pitch).toBeDefined();
      expect(head!.yaw).toBeDefined();
      expect(head!.roll).toBeDefined();
    });

    it('should include EYE_L and EYE_R composites', () => {
      const eyeL = COMPOSITE_ROTATIONS.find(c => c.node === 'EYE_L');
      const eyeR = COMPOSITE_ROTATIONS.find(c => c.node === 'EYE_R');
      expect(eyeL).toBeDefined();
      expect(eyeR).toBeDefined();

      // Eyes should have pitch (up/down) and yaw (left/right) but no roll
      expect(eyeL!.pitch).toBeDefined();
      expect(eyeL!.yaw).toBeDefined();
      expect(eyeL!.roll).toBeNull();
    });

    it('should include JAW composite', () => {
      const jaw = COMPOSITE_ROTATIONS.find(c => c.node === 'JAW');
      expect(jaw).toBeDefined();
      expect(jaw!.pitch).toBeDefined(); // Jaw open/close
    });

    it('should include TONGUE composite', () => {
      const tongue = COMPOSITE_ROTATIONS.find(c => c.node === 'TONGUE');
      expect(tongue).toBeDefined();
    });

    it('should have correct AU mappings in HEAD composite', () => {
      const head = COMPOSITE_ROTATIONS.find(c => c.node === 'HEAD')!;

      // Yaw: AU 51 (left) and 52 (right)
      expect(head.yaw!.aus).toContain(51);
      expect(head.yaw!.aus).toContain(52);
      expect(head.yaw!.negative).toBe(51);
      expect(head.yaw!.positive).toBe(52);

      // Pitch: AU 53 (up) and 54 (down)
      expect(head.pitch!.aus).toContain(53);
      expect(head.pitch!.aus).toContain(54);

      // Roll: AU 55 (left) and 56 (right)
      expect(head.roll!.aus).toContain(55);
      expect(head.roll!.aus).toContain(56);
    });

    it('should have correct AU mappings in eye composites', () => {
      const eyeL = COMPOSITE_ROTATIONS.find(c => c.node === 'EYE_L')!;

      // Yaw: AU 61 (left) and 62 (right)
      expect(eyeL.yaw!.aus).toContain(61);
      expect(eyeL.yaw!.aus).toContain(62);

      // Pitch: AU 63 (up) and 64 (down)
      expect(eyeL.pitch!.aus).toContain(63);
      expect(eyeL.pitch!.aus).toContain(64);
    });
  });

  describe('CONTINUUM_PAIRS_MAP', () => {
    it('should have bidirectional mappings for eye AUs', () => {
      // Eye horizontal (61 ↔ 62)
      expect(CONTINUUM_PAIRS_MAP[61]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[61].pairId).toBe(62);
      expect(CONTINUUM_PAIRS_MAP[62]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[62].pairId).toBe(61);

      // Eye vertical (63 ↔ 64)
      expect(CONTINUUM_PAIRS_MAP[63]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[63].pairId).toBe(64);
      expect(CONTINUUM_PAIRS_MAP[64]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[64].pairId).toBe(63);
    });

    it('should have bidirectional mappings for head AUs', () => {
      // Head yaw (51 ↔ 52)
      expect(CONTINUUM_PAIRS_MAP[51]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[51].pairId).toBe(52);
      expect(CONTINUUM_PAIRS_MAP[52].pairId).toBe(51);

      // Head pitch (53 ↔ 54)
      expect(CONTINUUM_PAIRS_MAP[53]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[53].pairId).toBe(54);
      expect(CONTINUUM_PAIRS_MAP[54].pairId).toBe(53);

      // Head roll (55 ↔ 56)
      expect(CONTINUUM_PAIRS_MAP[55]).toBeDefined();
      expect(CONTINUUM_PAIRS_MAP[55].pairId).toBe(56);
      expect(CONTINUUM_PAIRS_MAP[56].pairId).toBe(55);
    });

    it('should mark correct isNegative for continuum pairs', () => {
      // For eye yaw: 61 is negative (left), 62 is positive (right)
      expect(CONTINUUM_PAIRS_MAP[61].isNegative).toBe(true);
      expect(CONTINUUM_PAIRS_MAP[62].isNegative).toBe(false);

      // For head yaw: 51 is negative (left), 52 is positive (right)
      expect(CONTINUUM_PAIRS_MAP[51].isNegative).toBe(true);
      expect(CONTINUUM_PAIRS_MAP[52].isNegative).toBe(false);
    });
  });

  describe('VISEME_KEYS', () => {
    it('should have 15 viseme keys (ARKit standard)', () => {
      expect(VISEME_KEYS.length).toBe(15);
    });

    it('should include common visemes', () => {
      expect(VISEME_KEYS).toContain('EE');
      expect(VISEME_KEYS).toContain('Ah');
      expect(VISEME_KEYS).toContain('Oh');
      expect(VISEME_KEYS).toContain('B_M_P');
      expect(VISEME_KEYS).toContain('F_V');
    });
  });

  describe('Helper Functions', () => {
    describe('isMixedAU', () => {
      it('should return true for AUs with both morphs and bones', () => {
        // Head AUs have both morph targets (Head_Turn_L) and bones (HEAD)
        expect(isMixedAU(51)).toBe(true);
        expect(isMixedAU(52)).toBe(true);

        // Eye direction AUs have both
        expect(isMixedAU(61)).toBe(true);
        expect(isMixedAU(62)).toBe(true);

        // Jaw open has both
        expect(isMixedAU(26)).toBe(true);
      });

      it('should return false for AUs with only morphs', () => {
        // Brow AUs typically only have morphs
        expect(isMixedAU(1)).toBe(false);
        expect(isMixedAU(2)).toBe(false);
        expect(isMixedAU(4)).toBe(false);

        // Smile only has morphs
        expect(isMixedAU(12)).toBe(false);
      });
    });

    describe('hasLeftRightMorphs', () => {
      it('should return true for bilateral AUs', () => {
        expect(hasLeftRightMorphs(1)).toBe(true); // Brow_Raise_Inner_L/R
        expect(hasLeftRightMorphs(12)).toBe(true); // Mouth_Smile_L/R
        expect(hasLeftRightMorphs(43)).toBe(true); // Eye_Blink_L/R
      });

      it('should return false for unilateral AUs', () => {
        expect(hasLeftRightMorphs(18)).toBe(false); // Mouth_Pucker (single morph)
        expect(hasLeftRightMorphs(22)).toBe(false); // Mouth_Funnel (single morph)
      });
    });

    describe('hasLeftRightBones', () => {
      it('should return true for eye AUs (EYE_L and EYE_R bones)', () => {
        expect(hasLeftRightBones(61)).toBe(true);
        expect(hasLeftRightBones(62)).toBe(true);
        expect(hasLeftRightBones(63)).toBe(true);
        expect(hasLeftRightBones(64)).toBe(true);
      });

      it('should return false for head AUs (single HEAD bone)', () => {
        expect(hasLeftRightBones(51)).toBe(false);
        expect(hasLeftRightBones(52)).toBe(false);
      });
    });
  });
});
