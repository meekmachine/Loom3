/**
 * CLEAN Character Creator (CC) Configuration
 *
 * This file contains ONLY the exact mappings needed for your CC model.
 * No fallback variants, no candidate lists - just direct matches.
 *
 * Generated from actual model analysis showing 195 unique shape keys.
 */

// ============================================================================
// EXACT BONE NAMES (No candidates needed - we know exactly what CC uses)
// ============================================================================

export const CC_BONES = {
  EYE_L: 'CC_Base_L_Eye',
  EYE_R: 'CC_Base_R_Eye',
  JAW: 'CC_Base_JawRoot',
  HEAD: 'CC_Base_Head',
  NECK: 'CC_Base_NeckTwist01',
  NECK2: 'CC_Base_NeckTwist02',
  TONGUE: 'CC_Base_Tongue01',
} as const;

// ============================================================================
// EXACT MORPH NAMES (No variants needed - CC uses consistent naming)
// ============================================================================

export const CC_AU_TO_MORPHS: Record<number, string[]> = {
  // Brows / Forehead
  1: ['Brow_Raise_Inner_L', 'Brow_Raise_Inner_R'],
  2: ['Brow_Raise_Outer_L', 'Brow_Raise_Outer_R'],
  4: ['Brow_Drop_L', 'Brow_Drop_R'],

  // Eyes / Lids
  5: ['Eye_Wide_L', 'Eye_Wide_R'],
  6: ['Cheek_Raise_L', 'Cheek_Raise_R'],
  7: ['Eye_Squint_L', 'Eye_Squint_R'],
  43: ['Eye_Blink_L', 'Eye_Blink_R'],

  // Nose / Midface
  9: ['Nose_Sneer_L', 'Nose_Sneer_R'],
  34: ['Cheek_Puff_L', 'Cheek_Puff_R'],

  // Mouth / Lips
  8: ['Mouth_Press_L', 'Mouth_Press_R', 'Mouth_Close'],
  10: ['Mouth_Up_Upper_L', 'Mouth_Up_Upper_R'],
  11: ['Mouth_Dimple_L', 'Mouth_Dimple_R'],
  12: ['Mouth_Smile_L', 'Mouth_Smile_R'],
  13: ['Mouth_Stretch_L', 'Mouth_Stretch_R'],
  14: ['Mouth_Dimple_L', 'Mouth_Dimple_R'],
  15: ['Mouth_Frown_L', 'Mouth_Frown_R'],
  16: ['Mouth_Down_Lower_L', 'Mouth_Down_Lower_R'],
  17: ['Mouth_Shrug_Lower'],
  18: ['Mouth_Pucker'],
  20: ['Mouth_Stretch_L', 'Mouth_Stretch_R'],
  22: ['Mouth_Funnel'],
  23: ['Mouth_Press_L', 'Mouth_Press_R'],
  24: ['Mouth_Press_L', 'Mouth_Press_R'],
  25: [], // Lips Part - BONE ONLY
  26: [], // Jaw Drop - BONE ONLY
  27: [], // Mouth Stretch - BONE ONLY
  28: ['Mouth_Roll_In_Upper', 'Mouth_Roll_In_Lower'],

  // Tongue
  19: ['Tongue_Out'],
  36: ['Tongue_Bulge_L', 'Tongue_Bulge_R'],
  37: [], // Tongue Up - BONE ONLY
  38: [], // Tongue Down - BONE ONLY
  39: [], // Tongue Left - BONE ONLY
  40: [], // Tongue Right - BONE ONLY

  // Jaw / Head
  29: ['Jaw_Forward'],
  30: [], // Jaw Left - BONE ONLY
  35: [], // Jaw Right - BONE ONLY
  31: ['Head_Turn_L'],
  32: ['Head_Turn_R'],
  33: ['Head_Turn_Up'],
  54: ['Head_Turn_Down'],
  55: ['Head_Tilt_L'],
  56: ['Head_Tilt_R'],

  // Eye Direction
  61: ['Eye_L_Look_L', 'Eye_R_Look_L'],
  62: ['Eye_L_Look_R', 'Eye_R_Look_R'],
  63: ['Eye_L_Look_Up', 'Eye_R_Look_Up'],
  64: ['Eye_L_Look_Down', 'Eye_R_Look_Down'],
  // Single-eye controls (Left)
  65: ['Eye_L_Look_L'],
  66: ['Eye_L_Look_R'],
  67: ['Eye_L_Look_Up'],
  68: ['Eye_L_Look_Down'],
  // Single-eye controls (Right)
  69: ['Eye_R_Look_L'],
  70: ['Eye_R_Look_R'],
  71: ['Eye_R_Look_Up'],
  72: ['Eye_R_Look_Down'],
};

// ============================================================================
// VISEME KEYS (Exact names from your model)
// ============================================================================

export const CC_VISEME_KEYS = [
  'EE', 'Er', 'IH', 'Ah', 'Oh', 'W_OO', 'S_Z', 'Ch_J', 'F_V', 'TH', 'T_L_D_N', 'B_M_P', 'K_G_H_NG', 'AE', 'R'
] as const;

// ============================================================================
// SUMMARY
// ============================================================================

/*
WHAT WAS REMOVED:

1. MORPH_VARIANTS - Your CC model uses consistent naming, no variants needed
2. BONE_CANDIDATES - You only use one model, exact bone names work
3. EYE/JAW/HEAD/TONGUE_BONE_CANDIDATES - Not needed with exact names
4. Pattern matching logic - Direct lookups are faster and cleaner

WHAT YOU HAVE:
- 195 unique shape keys across 15 meshes
- Consistent CC naming convention (Brow_Drop_L, Eye_Blink_R, etc.)
- All bones resolved on first try (CC_Base_*)

PERFORMANCE IMPROVEMENT:
- Old: Try morph name → try 4-7 variants → finally find it
- New: Direct lookup, instant match

MAINTAINABILITY:
- Old: 143 lines of variants you never use
- New: Exact names only, crystal clear what exists
*/
