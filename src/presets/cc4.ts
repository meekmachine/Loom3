/**
 * CC4 Preset - Character Creator 4 AU Mappings
 *
 * Complete FACS Action Unit to morph target and bone mappings for CC4 rigs.
 * This includes all the composite rotations, continuum pairs, mesh classifications,
 * and AU metadata that we painstakingly worked through.
 */

import type { Profile, MeshCategory, BlendingMode, MeshMaterialSettings, MeshInfo, MorphCategory, MorphTargetsBySide } from '../mappings/types';
import type { BoneBinding, AUInfo, CompositeRotation } from '../core/types';

// ============================================================================
// AU TO MORPHS - Maps AU IDs to morph target names
// ============================================================================

export const AU_TO_MORPHS: Record<number, MorphTargetsBySide> = {
  1: {
    left: ['Brow_Raise_Inner_L'],
    right: ['Brow_Raise_Inner_R'],
    center: [],
  },
  2: {
    left: ['Brow_Raise_Outer_L'],
    right: ['Brow_Raise_Outer_R'],
    center: [],
  },
  4: {
    left: ['Brow_Drop_L'],
    right: ['Brow_Drop_R'],
    center: [],
  },
  5: {
    left: ['Eye_Wide_L'],
    right: ['Eye_Wide_R'],
    center: [],
  },
  6: {
    left: ['Cheek_Raise_L'],
    right: ['Cheek_Raise_R'],
    center: [],
  },
  7: {
    left: ['Eye_Squint_L'],
    right: ['Eye_Squint_R'],
    center: [],
  },
  8: {
    left: ['Mouth_Press_L'],
    right: ['Mouth_Press_R'],
    center: ['Mouth_Close'],
  },
  9: {
    left: ['Nose_Sneer_L'],
    right: ['Nose_Sneer_R'],
    center: [],
  },
  10: {
    left: ['Nose_Sneer_L'],
    right: ['Nose_Sneer_R'],
    center: [],
  },
  11: {
    left: ['Mouth_Up_Upper_L'],
    right: ['Mouth_Up_Upper_R'],
    center: [],
  },
  12: {
    left: ['Mouth_Smile_L'],
    right: ['Mouth_Smile_R'],
    center: [],
  },
  13: {
    left: ['Mouth_Dimple_L'],
    right: ['Mouth_Dimple_R'],
    center: [],
  },
  14: {
    left: ['Mouth_Press_L'],
    right: ['Mouth_Press_R'],
    center: [],
  },
  15: {
    left: ['Mouth_Frown_L'],
    right: ['Mouth_Frown_R'],
    center: [],
  },
  16: {
    left: ['Mouth_Down_Lower_L'],
    right: ['Mouth_Down_Lower_R'],
    center: [],
  },
  17: {
    left: [],
    right: [],
    center: ['Mouth_Shrug_Lower'],
  },
  18: {
    left: [],
    right: [],
    center: ['Mouth_Pucker'],
  },
  19: {
    left: [],
    right: [],
    center: ['Tongue_Out'],
  },
  20: {
    left: ['Mouth_Stretch_L'],
    right: ['Mouth_Stretch_R'],
    center: [],
  },
  22: {
    left: [],
    right: [],
    center: ['Mouth_Funnel'],
  },
  23: {
    left: ['Mouth_Press_L'],
    right: ['Mouth_Press_R'],
    center: [],
  },
  24: {
    left: ['Mouth_Press_L'],
    right: ['Mouth_Press_R'],
    center: [],
  },
  25: {
    left: [],
    right: [],
    center: ['Jaw_Open'],
  },
  26: {
    left: [],
    right: [],
    center: ['Jaw_Open'],
  },
  27: {
    left: [],
    right: [],
    center: ['Jaw_Open'],
  },
  28: {
    left: [],
    right: [],
    center: ['Mouth_Roll_In_Upper', 'Mouth_Roll_In_Lower'],
  },
  29: {
    left: [],
    right: [],
    center: ['Jaw_Forward'],
  },
  30: {
    left: ['Jaw_L'],
    right: [],
    center: [],
  },
  31: {
    left: [],
    right: [],
    center: [],
  },
  32: {
    left: [],
    right: [],
    center: ['Mouth_Roll_In_Lower'],
  },
  34: {
    left: ['Cheek_Puff_L'],
    right: ['Cheek_Puff_R'],
    center: [],
  },
  35: {
    left: [],
    right: ['Jaw_R'],
    center: [],
  },
  36: {
    left: ['Tongue_Bulge_L'],
    right: ['Tongue_Bulge_R'],
    center: [],
  },
  37: {
    left: [],
    right: [],
    center: ['Tongue_Up'],
  },
  38: {
    left: [],
    right: [],
    center: ['Tongue_Down'],
  },
  39: {
    left: ['Tongue_L'],
    right: [],
    center: [],
  },
  40: {
    left: [],
    right: ['Tongue_R'],
    center: [],
  },
  41: {
    left: [],
    right: [],
    center: [],
  },
  42: {
    left: [],
    right: [],
    center: [],
  },
  43: {
    left: ['Eye_Blink_L'],
    right: ['Eye_Blink_R'],
    center: [],
  },
  45: {
    left: ['Eye_Blink_L'],
    right: ['Eye_Blink_R'],
    center: [],
  },
  51: {
    left: ['Head_Turn_L'],
    right: [],
    center: [],
  },
  52: {
    left: [],
    right: ['Head_Turn_R'],
    center: [],
  },
  53: {
    left: [],
    right: [],
    center: ['Head_Turn_Up'],
  },
  54: {
    left: [],
    right: [],
    center: ['Head_Turn_Down'],
  },
  55: {
    left: ['Head_Tilt_L'],
    right: [],
    center: [],
  },
  56: {
    left: [],
    right: ['Head_Tilt_R'],
    center: [],
  },
  61: {
    left: ['Eye_L_Look_L', 'Eye_R_Look_L'],
    right: [],
    center: [],
  },
  62: {
    left: [],
    right: ['Eye_L_Look_R', 'Eye_R_Look_R'],
    center: [],
  },
  63: {
    left: [],
    right: [],
    center: ['Eye_L_Look_Up', 'Eye_R_Look_Up'],
  },
  64: {
    left: [],
    right: [],
    center: ['Eye_L_Look_Down', 'Eye_R_Look_Down'],
  },
  65: {
    left: ['Eye_L_Look_L'],
    right: [],
    center: [],
  },
  66: {
    left: [],
    right: ['Eye_L_Look_R'],
    center: [],
  },
  67: {
    left: [],
    right: [],
    center: ['Eye_L_Look_Up'],
  },
  68: {
    left: [],
    right: [],
    center: ['Eye_L_Look_Down'],
  },
  69: {
    left: ['Eye_R_Look_L'],
    right: [],
    center: [],
  },
  70: {
    left: [],
    right: ['Eye_R_Look_R'],
    center: [],
  },
  71: {
    left: [],
    right: [],
    center: ['Eye_R_Look_Up'],
  },
  72: {
    left: [],
    right: [],
    center: ['Eye_R_Look_Down'],
  },
  73: {
    left: [],
    right: [],
    center: ['Tongue_Narrow'],
  },
  74: {
    left: [],
    right: [],
    center: ['Tongue_Wide'],
  },
  75: {
    left: [],
    right: [],
    center: ['Tongue_Roll'],
  },
  76: {
    left: [],
    right: [],
    center: ['Tongue_Tip_Up'],
  },
  77: {
    left: [],
    right: [],
    center: ['Tongue_Tip_Down'],
  },
  80: {
    left: ['EO Bulge L'],
    right: ['EO Bulge R'],
    center: [],
  },
  81: {
    left: ['EO Depth L'],
    right: ['EO Depth R'],
    center: [],
  },
  82: {
    left: ['EO Inner Depth L'],
    right: ['EO Inner Depth R'],
    center: [],
  },
  83: {
    left: ['EO Inner Height L'],
    right: ['EO Inner Height R'],
    center: [],
  },
  84: {
    left: ['EO Inner Width L'],
    right: ['EO Inner Width R'],
    center: [],
  },
  85: {
    left: ['EO Outer Depth L'],
    right: ['EO Outer Depth R'],
    center: [],
  },
  86: {
    left: ['EO Outer Height L'],
    right: ['EO Outer Height R'],
    center: [],
  },
  87: {
    left: ['EO Outer Width L'],
    right: ['EO Outer Width R'],
    center: [],
  },
  88: {
    left: ['EO Upper Depth L'],
    right: ['EO Upper Depth R'],
    center: [],
  },
  89: {
    left: ['EO Lower Depth L'],
    right: ['EO Lower Depth R'],
    center: [],
  },
  90: {
    left: ['EO Center Upper Depth L'],
    right: ['EO Center Upper Depth R'],
    center: [],
  },
  91: {
    left: ['EO Center Upper Height L'],
    right: ['EO Center Upper Height R'],
    center: [],
  },
  92: {
    left: ['EO Center Lower Depth L'],
    right: ['EO Center Lower Depth R'],
    center: [],
  },
  93: {
    left: ['EO Center Lower Height L'],
    right: ['EO Center Lower Height R'],
    center: [],
  },
  94: {
    left: ['EO Inner Upper Depth L'],
    right: ['EO Inner Upper Depth R'],
    center: [],
  },
  95: {
    left: ['EO Inner Upper Height L'],
    right: ['EO Inner Upper Height R'],
    center: [],
  },
  96: {
    left: ['EO Inner Lower Depth L'],
    right: ['EO Inner Lower Depth R'],
    center: [],
  },
  97: {
    left: ['EO Inner Lower Height L'],
    right: ['EO Inner Lower Height R'],
    center: [],
  },
  98: {
    left: ['EO Outer Upper Depth L'],
    right: ['EO Outer Upper Depth R'],
    center: [],
  },
  99: {
    left: ['EO Outer Upper Height L'],
    right: ['EO Outer Upper Height R'],
    center: [],
  },
  100: {
    left: ['EO Outer Lower Depth L'],
    right: ['EO Outer Lower Depth R'],
    center: [],
  },
  101: {
    left: ['EO Outer Lower Height L'],
    right: ['EO Outer Lower Height R'],
    center: [],
  },
  102: {
    left: ['EO Duct Depth L'],
    right: ['EO Duct Depth R'],
    center: [],
  },
};

// ============================================================================
// AU TO BONES - Maps AU IDs to bone bindings (CC4 head/eye/jaw/tongue)
// ============================================================================

export const BONE_AU_TO_BINDINGS: Record<number, BoneBinding[]> = {
  // Jaw open/close (jaw drop)
  25: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 20 }],
  26: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 30 }],
  27: [{ node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 35 }],

  // Jaw lateral (left/right)
  30: [{ node: 'JAW', channel: 'ry', scale: -1, maxDegrees: 15 }],
  35: [{ node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 15 }],

  // Head yaw (turn left/right)
  // AU 51 = Turn Left: positive ry rotation (scale: 1)
  // AU 52 = Turn Right: negative ry rotation (scale: -1)
  51: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 60 }],
  52: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 60 }],

  // Head pitch (up/down)
  // AU 53 = Head Up: negative rx rotation (scale: -1)
  // AU 54 = Head Down: positive rx rotation (scale: 1)
  53: [{ node: 'HEAD', channel: 'rx', scale: -1, maxDegrees: 30 }],
  54: [{ node: 'HEAD', channel: 'rx', scale: 1, maxDegrees: 30 }],

  // Head roll (tilt)
  55: [{ node: 'HEAD', channel: 'rz', scale: -1, maxDegrees: 25 }],
  56: [{ node: 'HEAD', channel: 'rz', scale: 1, maxDegrees: 25 }],

  // Eyes horizontal (left/right) - CC4 uses rz for yaw
  // AU 61 = Eyes Turn Left = character looks toward THEIR left = viewer's RIGHT
  // AU 62 = Eyes Turn Right = character looks toward THEIR right = viewer's LEFT
  // For CC4 rigs: positive rz = eyes rotate left (look right), negative rz = eyes rotate right (look left)
  61: [
    { node: 'EYE_L', channel: 'rz', scale: 1, maxDegrees: 25, side: 'left' },
    { node: 'EYE_R', channel: 'rz', scale: 1, maxDegrees: 25, side: 'right' },
  ],
  62: [
    { node: 'EYE_L', channel: 'rz', scale: -1, maxDegrees: 25, side: 'left' },
    { node: 'EYE_R', channel: 'rz', scale: -1, maxDegrees: 25, side: 'right' },
  ],

  // Eyes vertical (up/down) - rx
  // AU 63 = Eyes Up = character looks up
  // AU 64 = Eyes Down = character looks down
  // For CC4 rigs: negative rx = eyes rotate up, positive rx = eyes rotate down
  63: [
    { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 20, side: 'left' },
    { node: 'EYE_R', channel: 'rx', scale: -1, maxDegrees: 20, side: 'right' },
  ],
  64: [
    { node: 'EYE_L', channel: 'rx', scale: 1, maxDegrees: 20, side: 'left' },
    { node: 'EYE_R', channel: 'rx', scale: 1, maxDegrees: 20, side: 'right' },
  ],

  // Tongue controls (optional, for rigs that expose them)
  37: [{ node: 'TONGUE', channel: 'rz', scale: 1, maxDegrees: 20 }],
  38: [{ node: 'TONGUE', channel: 'rz', scale: -1, maxDegrees: 20 }],
  39: [{ node: 'TONGUE', channel: 'ry', scale: -1, maxDegrees: 20 }],
  40: [{ node: 'TONGUE', channel: 'ry', scale: 1, maxDegrees: 20 }],
  41: [{ node: 'TONGUE', channel: 'rx', scale: -1, maxDegrees: 20 }],
  42: [{ node: 'TONGUE', channel: 'rx', scale: 1, maxDegrees: 20 }],
};

// ============================================================================
// VISEME KEYS - CC4 viseme morph targets (15)
// ============================================================================

export const VISEME_KEYS: string[] = [
  'EE',
  'Ah',
  'Oh',
  'OO',
  'I',
  'U',
  'W',
  'L',
  'F_V',
  'Th',
  'S_Z',
  'B_M_P',
  'K_G_H_NG',
  'AE',
  'R',
];

/**
 * Jaw opening amounts for each viseme index (0-14).
 * Values are 0-1 representing how much the jaw should open.
 * Used by snippetToClip when autoVisemeJaw is enabled.
 */
export const VISEME_JAW_AMOUNTS: number[] = [
  0.15, // 0: EE
  0.35, // 1: Ah
  0.25, // 2: Oh
  0.70, // 3: OO
  0.55, // 4: I
  0.30, // 5: U
  0.10, // 6: W
  0.20, // 7: L
  0.08, // 8: F_V
  0.12, // 9: Th
  0.18, // 10: S_Z
  0.02, // 11: B_M_P
  0.25, // 12: K_G_H_NG
  0.60, // 13: AE
  0.40, // 14: R
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Check if an AU has both morphs and bones (can blend between them) */
export const isMixedAU = (id: number): boolean => {
  const morphs = AU_TO_MORPHS[id];
  const hasMorphs = !!(morphs?.left?.length || morphs?.right?.length || morphs?.center?.length);
  return !!(hasMorphs && BONE_AU_TO_BINDINGS[id]?.length);
};

/** Check if an AU has separate left/right morphs */
export const hasLeftRightMorphs = (auId: number): boolean => {
  const morphs = AU_TO_MORPHS[auId];
  return !!(morphs?.left?.length && morphs?.right?.length);
};

/** Check if an AU has bilateral bone bindings (L and R nodes) in CC4 preset */
export const hasLeftRightBones = (auId: number): boolean => {
  const bindings = BONE_AU_TO_BINDINGS[auId];
  return checkBindingsForLeftRight(bindings);
};

/** Helper to check if bone bindings have L and R nodes */
export const checkBindingsForLeftRight = (bindings: BoneBinding[] | undefined): boolean => {
  if (!bindings || bindings.length === 0) return false;

  // Check if bindings include both L and R nodes
  const nodes = bindings.map(b => b.node);
  // Match patterns like _L, _R, _L_, _R_, GILL_L, GILL_R, etc.
  const hasLeft = nodes.some(n => /_L$|_L_|GILL_L|_L\d/i.test(n));
  const hasRight = nodes.some(n => /_R$|_R_|GILL_R|_R\d/i.test(n));

  return hasLeft && hasRight;
};

// ============================================================================
// COMPOSITE ROTATIONS - Unified rotation control for bones
// ============================================================================

export const COMPOSITE_ROTATIONS: CompositeRotation[] = [
  {
    node: 'JAW',
    pitch: { aus: [25, 26, 27], axis: 'rz' },  // Jaw drop (opens mouth downward)
    yaw: { aus: [30, 35], axis: 'ry', negative: 30, positive: 35 },  // Jaw lateral (left/right)
    roll: null  // Jaw doesn't have roll
  },
  {
    node: 'HEAD',
    pitch: { aus: [54, 53], axis: 'rx', negative: 54, positive: 53 },  // Head down/up
    yaw: { aus: [51, 52], axis: 'ry', negative: 51, positive: 52 },  // Head turn left/right
    roll: { aus: [55, 56], axis: 'rz', negative: 55, positive: 56 }   // Head tilt left/right
  },
  {
    node: 'EYE_L',
    pitch: { aus: [64, 63], axis: 'rx', negative: 64, positive: 63 },  // Eyes down/up
    yaw: { aus: [61, 62], axis: 'rz', negative: 61, positive: 62 },    // Eyes left/right (rz for CC4)
    roll: null  // Eyes don't have roll
  },
  {
    node: 'EYE_R',
    pitch: { aus: [64, 63], axis: 'rx', negative: 64, positive: 63 },  // Eyes down/up
    yaw: { aus: [61, 62], axis: 'rz', negative: 61, positive: 62 },    // Eyes left/right (rz for CC4)
    roll: null  // Eyes don't have roll
  },
  {
    node: 'TONGUE',
    pitch: { aus: [38, 37], axis: 'rz', negative: 38, positive: 37 },  // Tongue down/up
    yaw: { aus: [39, 40], axis: 'ry', negative: 39, positive: 40 },    // Tongue left/right
    roll: { aus: [41, 42], axis: 'rx', negative: 41, positive: 42 }    // Tongue tilt left/right
  }
];

// ============================================================================
// CONTINUUM PAIRS - Bidirectional AU pair mappings
// ============================================================================

/**
 * Continuum pair mappings - precomputed from COMPOSITE_ROTATIONS
 * Maps AU ID to its continuum partner info for bidirectional axes
 * (e.g., AU 51 "Head Left" is paired with AU 52 "Head Right")
 */
export const CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE';
}> = {
  // Eyes horizontal - both eyes share same AUs (yaw maps to rz via COMPOSITE_ROTATIONS)
  61: { pairId: 62, isNegative: true, axis: 'yaw', node: 'EYE_L' },
  62: { pairId: 61, isNegative: false, axis: 'yaw', node: 'EYE_L' },
  // Eyes vertical (pitch)
  64: { pairId: 63, isNegative: true, axis: 'pitch', node: 'EYE_L' },
  63: { pairId: 64, isNegative: false, axis: 'pitch', node: 'EYE_L' },
  // Head yaw (turn left/right)
  51: { pairId: 52, isNegative: true, axis: 'yaw', node: 'HEAD' },
  52: { pairId: 51, isNegative: false, axis: 'yaw', node: 'HEAD' },
  // Head pitch (up/down)
  54: { pairId: 53, isNegative: true, axis: 'pitch', node: 'HEAD' },
  53: { pairId: 54, isNegative: false, axis: 'pitch', node: 'HEAD' },
  // Head roll (tilt left/right)
  55: { pairId: 56, isNegative: true, axis: 'roll', node: 'HEAD' },
  56: { pairId: 55, isNegative: false, axis: 'roll', node: 'HEAD' },
  // Jaw yaw (left/right)
  30: { pairId: 35, isNegative: true, axis: 'yaw', node: 'JAW' },
  35: { pairId: 30, isNegative: false, axis: 'yaw', node: 'JAW' },
  // Tongue yaw (left/right)
  39: { pairId: 40, isNegative: true, axis: 'yaw', node: 'TONGUE' },
  40: { pairId: 39, isNegative: false, axis: 'yaw', node: 'TONGUE' },
  // Tongue pitch (up/down)
  38: { pairId: 37, isNegative: true, axis: 'pitch', node: 'TONGUE' },
  37: { pairId: 38, isNegative: false, axis: 'pitch', node: 'TONGUE' },
  // Tongue roll (tilt left/right)
  41: { pairId: 42, isNegative: true, axis: 'roll', node: 'TONGUE' },
  42: { pairId: 41, isNegative: false, axis: 'roll', node: 'TONGUE' },
  // Extended tongue morphs (continuum pairs)
  73: { pairId: 74, isNegative: true, axis: 'yaw', node: 'TONGUE' },  // Tongue Narrow/Wide
  74: { pairId: 73, isNegative: false, axis: 'yaw', node: 'TONGUE' },
  76: { pairId: 77, isNegative: false, axis: 'pitch', node: 'TONGUE' }, // Tongue Tip Up/Down
  77: { pairId: 76, isNegative: true, axis: 'pitch', node: 'TONGUE' },
};

/**
 * Human-readable labels for continuum pairs
 * Key format: "negativeAU-positiveAU"
 * Used by UI components (ContinuumSlider, AUSection) to display friendly axis names
 */
export const CONTINUUM_LABELS: Record<string, string> = {
  '61-62': 'Eyes — Horizontal',
  '64-63': 'Eyes — Vertical',
  '51-52': 'Head — Horizontal',
  '54-53': 'Head — Vertical',
  '55-56': 'Head — Tilt',
  '30-35': 'Jaw — Horizontal',
  '38-37': 'Tongue — Vertical',
  '39-40': 'Tongue — Horizontal',
  '41-42': 'Tongue — Tilt',
  '73-74': 'Tongue — Width',
  '76-77': 'Tongue Tip — Vertical',
};

// ============================================================================
// BONE NODE NAMES - CC4-specific skeleton hierarchy
// ============================================================================

/**
 * Bone name prefix for CC4 rigs.
 * Base bone names are stored without this prefix in CC4_BONE_NODES.
 * The engine will prepend this when resolving bones.
 */
export const CC4_BONE_PREFIX = 'CC_Base_';

/**
 * Suffix pattern regex for fuzzy bone matching.
 * Matches numbered suffixes like _01, _038 (common in Sketchfab exports)
 * and .001, .002 (common in Blender exports).
 */
export const CC4_SUFFIX_PATTERN = '_\\d+$|\\.\\d+$';

// Canonical CC4 bone names WITHOUT prefix (engine will prepend CC4_BONE_PREFIX).
// This allows fuzzy matching for models with suffixed bone names.
export const CC4_BONE_NODES = {
  EYE_L: 'L_Eye',
  EYE_R: 'R_Eye',
  HEAD: 'Head',
  NECK: 'NeckTwist01',
  NECK_TWIST: 'NeckTwist02',
  JAW: 'JawRoot',
  TONGUE: 'Tongue01'
} as const;

export const CC4_EYE_MESH_NODES = {
  LEFT: 'CC_Base_Eye',
  RIGHT: 'CC_Base_Eye_1'
} as const;

// ============================================================================
// AU INFO - Metadata for each Action Unit
// ============================================================================

export const AU_INFO: Record<string, AUInfo> = {
  // Forehead / Brow (Upper)
  '1':  { id:'1',  name:'Inner Brow Raiser',  muscularBasis:'frontalis (pars medialis)', links:['https://en.wikipedia.org/wiki/Frontalis_muscle'], faceArea:'Upper', facePart:'Forehead' },
  '2':  { id:'2',  name:'Outer Brow Raiser',  muscularBasis:'frontalis (pars lateralis)', links:['https://en.wikipedia.org/wiki/Frontalis_muscle'], faceArea:'Upper', facePart:'Forehead' },
  '4':  { id:'4',  name:'Brow Lowerer',      muscularBasis:'corrugator/depressor supercilii', links:['https://en.wikipedia.org/wiki/Corrugator_supercilii'], faceArea:'Upper', facePart:'Forehead' },

  // Eyelids / Eyes (Upper)
  '5':  { id:'5',  name:'Upper Lid Raiser',  muscularBasis:'levator palpebrae superioris', links:['https://en.wikipedia.org/wiki/Levator_palpebrae_superioris'], faceArea:'Upper', facePart:'Eyelids' },
  '6':  { id:'6',  name:'Cheek Raiser',      muscularBasis:'orbicularis oculi (pars orbitalis)', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi'], faceArea:'Upper', facePart:'Cheeks' },
  '7':  { id:'7',  name:'Lid Tightener',     muscularBasis:'orbicularis oculi (pars palpebralis)', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi'], faceArea:'Upper', facePart:'Eyelids' },
  '43': { id:'43', name:'Eyes Closed',       muscularBasis:'orbicularis oculi', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi_muscle'], faceArea:'Upper', facePart:'Eyelids' },
  '45': { id:'45', name:'Blink',             muscularBasis:'orbicularis oculi', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi_muscle'], faceArea:'Upper', facePart:'Eyelids' },
  '61': { id:'61', name:'Eyes Turn Left',    faceArea:'Upper', facePart:'Eyes' },
  '62': { id:'62', name:'Eyes Turn Right',   faceArea:'Upper', facePart:'Eyes' },
  '63': { id:'63', name:'Eyes Up',           faceArea:'Upper', facePart:'Eyes' },
  '64': { id:'64', name:'Eyes Down',         faceArea:'Upper', facePart:'Eyes' },
  '65': { id:'65', name:'Left Eye Look Left',  faceArea:'Upper', facePart:'Eyes' },
  '66': { id:'66', name:'Left Eye Look Right', faceArea:'Upper', facePart:'Eyes' },
  '67': { id:'67', name:'Left Eye Look Up',    faceArea:'Upper', facePart:'Eyes' },
  '68': { id:'68', name:'Left Eye Look Down',  faceArea:'Upper', facePart:'Eyes' },
  '69': { id:'69', name:'Right Eye Look Left', faceArea:'Upper', facePart:'Eyes' },
  '70': { id:'70', name:'Right Eye Look Right',faceArea:'Upper', facePart:'Eyes' },
  '71': { id:'71', name:'Right Eye Look Up',   faceArea:'Upper', facePart:'Eyes' },
  '72': { id:'72', name:'Right Eye Look Down', faceArea:'Upper', facePart:'Eyes' },

  // Nose / Cheeks
  '9':  { id:'9',  name:'Nose Wrinkler',     muscularBasis:'levator labii superioris alaeque nasi', links:['https://en.wikipedia.org/wiki/Levator_labii_superioris_alaeque_nasi'], faceArea:'Upper', facePart:'Nose' },
  '34': { id:'34', name:'Cheek Puff',        faceArea:'Lower', facePart:'Cheeks' },

  // Mouth (Lower)
  '8':  { id:'8',  name:'Lips Toward Each Other', muscularBasis:'orbicularis oris', links:['https://en.wikipedia.org/wiki/Orbicularis_oris'], faceArea:'Lower', facePart:'Mouth' },
  '10': { id:'10', name:'Upper Lip Raiser',  muscularBasis:'levator labii superioris', links:['https://en.wikipedia.org/wiki/Levator_labii_superioris'], faceArea:'Lower', facePart:'Mouth' },
  '11': { id:'11', name:'Nasolabial Deepener', muscularBasis:'zygomaticus minor', links:['https://en.wikipedia.org/wiki/Zygomaticus_minor'], faceArea:'Lower', facePart:'Cheeks' },
  '12': { id:'12', name:'Lip Corner Puller', muscularBasis:'zygomaticus major', links:['https://en.wikipedia.org/wiki/Zygomaticus_major'], faceArea:'Lower', facePart:'Mouth' },
  '13': { id:'13', name:'Sharp Lip Puller',  muscularBasis:'levator anguli oris', links:['https://en.wikipedia.org/wiki/Levator_anguli_oris'], faceArea:'Lower', facePart:'Mouth' },
  '14': { id:'14', name:'Dimpler',           muscularBasis:'buccinator', links:['https://en.wikipedia.org/wiki/Buccinator'], faceArea:'Lower', facePart:'Cheeks' },
  '15': { id:'15', name:'Lip Corner Depressor', muscularBasis:'depressor anguli oris', links:['https://en.wikipedia.org/wiki/Depressor_anguli_oris'], faceArea:'Lower', facePart:'Mouth' },
  '16': { id:'16', name:'Lower Lip Depressor', muscularBasis:'depressor labii inferioris', links:['https://en.wikipedia.org/wiki/Depressor_labii_inferioris'], faceArea:'Lower', facePart:'Mouth' },
  '17': { id:'17', name:'Chin Raiser',       muscularBasis:'mentalis', links:['https://en.wikipedia.org/wiki/Mentalis'], faceArea:'Lower', facePart:'Chin' },
  '18': { id:'18', name:'Lip Pucker',        faceArea:'Lower', facePart:'Mouth' },
  '20': { id:'20', name:'Lip Stretcher',     muscularBasis:'risorius + platysma', links:['https://en.wikipedia.org/wiki/Risorius','https://en.wikipedia.org/wiki/Platysma'], faceArea:'Lower', facePart:'Mouth' },
  '22': { id:'22', name:'Lip Funneler',      muscularBasis:'orbicularis oris', links:['https://en.wikipedia.org/wiki/Orbicularis_oris'], faceArea:'Lower', facePart:'Mouth' },
  '23': { id:'23', name:'Lip Tightener',     muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth' },
  '24': { id:'24', name:'Lip Presser',       muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth' },
  '25': { id:'25', name:'Lips Part',         faceArea:'Lower', facePart:'Mouth' },
  '27': { id:'27', name:'Mouth Stretch',     muscularBasis:'pterygoids + digastric', links:['https://en.wikipedia.org/wiki/Pterygoid_bone','https://en.wikipedia.org/wiki/Digastric_muscle'], faceArea:'Lower', facePart:'Mouth' },
  '28': { id:'28', name:'Lip Suck',          muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth' },

  // Tongue (Lower)
  '19': { id:'19', name:'Tongue Show',       faceArea:'Lower', facePart:'Tongue' },
  '36': { id:'36', name:'Tongue Bulge',      faceArea:'Lower', facePart:'Tongue' },
  '37': { id:'37', name:'Tongue Up',         faceArea:'Lower', facePart:'Tongue' },
  '38': { id:'38', name:'Tongue Down',       faceArea:'Lower', facePart:'Tongue' },
  '39': { id:'39', name:'Tongue Left',       faceArea:'Lower', facePart:'Tongue' },
  '40': { id:'40', name:'Tongue Right',      faceArea:'Lower', facePart:'Tongue' },
  '41': { id:'41', name:'Tongue Tilt Left',  faceArea:'Lower', facePart:'Tongue' },
  '42': { id:'42', name:'Tongue Tilt Right', faceArea:'Lower', facePart:'Tongue' },
  // Extended tongue controls (CC4-specific morphs)
  '73': { id:'73', name:'Tongue Narrow',     faceArea:'Lower', facePart:'Tongue' },
  '74': { id:'74', name:'Tongue Wide',       faceArea:'Lower', facePart:'Tongue' },
  '75': { id:'75', name:'Tongue Roll',       faceArea:'Lower', facePart:'Tongue' },
  '76': { id:'76', name:'Tongue Tip Up',     faceArea:'Lower', facePart:'Tongue' },
  '77': { id:'77', name:'Tongue Tip Down',   faceArea:'Lower', facePart:'Tongue' },

  // Jaw (Lower)
  '26': { id:'26', name:'Jaw Drop',          muscularBasis:'masseter (relax temporalis)', links:['https://en.wikipedia.org/wiki/Masseter_muscle'], faceArea:'Lower', facePart:'Jaw' },
  '29': { id:'29', name:'Jaw Thrust',        faceArea:'Lower', facePart:'Jaw' },
  '30': { id:'30', name:'Jaw Left',          faceArea:'Lower', facePart:'Jaw' },
  '31': { id:'31', name:'Jaw Clencher',      muscularBasis:'masseter + temporalis', faceArea:'Lower', facePart:'Jaw' },
  '32': { id:'32', name:'Lip Bite',          muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth' },
  '35': { id:'35', name:'Jaw Right',         faceArea:'Lower', facePart:'Jaw' },

  // Head position (M51-M56 in FACS notation)
  '51': { id:'51', name:'Head Turn Left',    faceArea:'Upper', facePart:'Head' },
  '52': { id:'52', name:'Head Turn Right',   faceArea:'Upper', facePart:'Head' },
  '53': { id:'53', name:'Head Up',           faceArea:'Upper', facePart:'Head' },
  '54': { id:'54', name:'Head Down',         faceArea:'Upper', facePart:'Head' },
  '55': { id:'55', name:'Head Tilt Left',    faceArea:'Upper', facePart:'Head' },
  '56': { id:'56', name:'Head Tilt Right',   faceArea:'Upper', facePart:'Head' },

  // Eye (Upper) - EO morphs applied to CC_Base_Eye meshes
  '80': { id:'80', name:'Eye Bulge',              faceArea:'Upper', facePart:'Eye' },
  '81': { id:'81', name:'Eye Depth',              faceArea:'Upper', facePart:'Eye' },
  '82': { id:'82', name:'Eye Inner Depth',        faceArea:'Upper', facePart:'Eye' },
  '83': { id:'83', name:'Eye Inner Height',       faceArea:'Upper', facePart:'Eye' },
  '84': { id:'84', name:'Eye Inner Width',        faceArea:'Upper', facePart:'Eye' },
  '85': { id:'85', name:'Eye Outer Depth',        faceArea:'Upper', facePart:'Eye' },
  '86': { id:'86', name:'Eye Outer Height',       faceArea:'Upper', facePart:'Eye' },
  '87': { id:'87', name:'Eye Outer Width',        faceArea:'Upper', facePart:'Eye' },
  '88': { id:'88', name:'Eye Upper Depth',        faceArea:'Upper', facePart:'Eye' },
  '89': { id:'89', name:'Eye Lower Depth',        faceArea:'Upper', facePart:'Eye' },
  '90': { id:'90', name:'Eye Center Upper Depth', faceArea:'Upper', facePart:'Eye' },
  '91': { id:'91', name:'Eye Center Upper Height',faceArea:'Upper', facePart:'Eye' },
  '92': { id:'92', name:'Eye Center Lower Depth', faceArea:'Upper', facePart:'Eye' },
  '93': { id:'93', name:'Eye Center Lower Height',faceArea:'Upper', facePart:'Eye' },
  '94': { id:'94', name:'Eye Inner Upper Depth',  faceArea:'Upper', facePart:'Eye' },
  '95': { id:'95', name:'Eye Inner Upper Height', faceArea:'Upper', facePart:'Eye' },
  '96': { id:'96', name:'Eye Inner Lower Depth',  faceArea:'Upper', facePart:'Eye' },
  '97': { id:'97', name:'Eye Inner Lower Height', faceArea:'Upper', facePart:'Eye' },
  '98': { id:'98', name:'Eye Outer Upper Depth',  faceArea:'Upper', facePart:'Eye' },
  '99': { id:'99', name:'Eye Outer Upper Height', faceArea:'Upper', facePart:'Eye' },
  '100': { id:'100', name:'Eye Outer Lower Depth', faceArea:'Upper', facePart:'Eye' },
  '101': { id:'101', name:'Eye Outer Lower Height',faceArea:'Upper', facePart:'Eye' },
  '102': { id:'102', name:'Eye Duct Depth',        faceArea:'Upper', facePart:'Eye' },
};

// ============================================================================
// MIX DEFAULTS - Morph/bone blend weights
// ============================================================================

/** Default mix weights (0 = morph only, 1 = bone only) */
export const AU_MIX_DEFAULTS: Record<number, number> = {
  31: 0.7, 32: 0.7, 33: 0.7, 54: 0.7, 55: 0.7, 56: 0.7,  // head
  61: 0.5, 62: 0.5, 63: 0.5, 64: 0.5,  // eyes
  25: 0.5, 26: 0.5, 27: 0.5,  // jaw open (lips part, jaw drop, mouth stretch)
  30: 0.5, 35: 0.5,  // jaw left/right
};

// ============================================================================
// CC4 MESH CLASSIFICATION
// Types imported from '../mappings/types'
// ============================================================================

/** Exact mesh name -> category mapping from the character GLB */
export const CC4_MESHES: Record<string, MeshInfo> = {
  // Body (6 meshes, 80 morphs each) - default render order 0
  'CC_Base_Body_1': { category: 'body', morphCount: 80 },
  'CC_Base_Body_2': { category: 'body', morphCount: 80 },
  'CC_Base_Body_3': { category: 'body', morphCount: 80 },
  'CC_Base_Body_4': { category: 'body', morphCount: 80 },
  'CC_Base_Body_5': { category: 'body', morphCount: 80 },
  'CC_Base_Body_6': { category: 'body', morphCount: 80 },
  // Eyes (bone-driven, no morphs) - render first (behind everything)
  'CC_Base_Eye': { category: 'eye', morphCount: 0, material: { renderOrder: -10 } },
  'CC_Base_Eye_1': { category: 'eye', morphCount: 0, material: { renderOrder: -10 } },
  'CC_Base_Eye_2': { category: 'eye', morphCount: 0, material: { renderOrder: -10 } },
  'CC_Base_Eye_3': { category: 'eye', morphCount: 0, material: { renderOrder: -10 } },
  'CC_Base_Eye_4': { category: 'eye', morphCount: 0, material: { renderOrder: -10 } },
  // Eye occlusion (94 morphs each) - render on top of eyes with transparency support
  'CC_Base_EyeOcclusion_1': { category: 'eyeOcclusion', morphCount: 94, material: { renderOrder: 2, transparent: true, opacity: 1, depthWrite: true, depthTest: true, blending: 'Normal' } },
  'CC_Base_EyeOcclusion_2': { category: 'eyeOcclusion', morphCount: 94, material: { renderOrder: 2, transparent: true, opacity: 1, depthWrite: true, depthTest: true, blending: 'Normal' } },
  // Tear lines (90 morphs each) - on top of eyes/face
  'CC_Base_TearLine_1': { category: 'tearLine', morphCount: 90, material: { renderOrder: 2 } },
  'CC_Base_TearLine_2': { category: 'tearLine', morphCount: 90, material: { renderOrder: 2 } },
  // Cornea (no morphs) - render first with eyes
  'CC_Base_Cornea': { category: 'cornea', morphCount: 0, material: { renderOrder: -10 } },
  'CC_Base_Cornea_1': { category: 'cornea', morphCount: 0, material: { renderOrder: -10 } },
  // Teeth (no morphs, follow jaw bone) - default render order
  'CC_Base_Teeth_1': { category: 'teeth', morphCount: 0 },
  'CC_Base_Teeth_2': { category: 'teeth', morphCount: 0 },
  // Tongue (23 morphs) - default render order
  'CC_Base_Tongue': { category: 'tongue', morphCount: 23 },
  // Eyebrows (91 morphs each) - above face
  'Male_Bushy_1': { category: 'eyebrow', morphCount: 91, material: { renderOrder: 5 } },
  'Male_Bushy_2': { category: 'eyebrow', morphCount: 91, material: { renderOrder: 5 } },
  // Hair (14 styling morphs each) - render last (on top of everything)
  'Side_part_wavy_1': { category: 'hair', morphCount: 14, material: { renderOrder: 10 } },
  'Side_part_wavy_2': { category: 'hair', morphCount: 14, material: { renderOrder: 10 } },
};

// ============================================================================
// MORPH TO MESH MAPPING
// MorphCategory type imported from '../mappings/types'
// ============================================================================

/** Which mesh each morph category applies to */
export const MORPH_TO_MESH: Record<MorphCategory, string[]> = {
  // Face/AU morphs affect the main face mesh plus brows/occlusion/tearline.
  // Include both CC4 naming variants (with and without _1/_2 suffixes).
  face: [
    'CC_Base_Body',
    'CC_Base_Body_1',
    'Male_Bushy',
    'Male_Bushy_1',
    'Male_Bushy_2',
    'CC_Base_EyeOcclusion',
    'CC_Base_EyeOcclusion_1',
    'CC_Base_EyeOcclusion_2',
    'CC_Base_TearLine',
    'CC_Base_TearLine_1',
    'CC_Base_TearLine_2',
  ],
  viseme: ['CC_Base_Body', 'CC_Base_Body_1'],
  eye: [
    'CC_Base_EyeOcclusion',
    'CC_Base_EyeOcclusion_1',
    'CC_Base_EyeOcclusion_2',
    'CC_Base_TearLine',
    'CC_Base_TearLine_1',
    'CC_Base_TearLine_2',
  ],
  tearLine: ['CC_Base_TearLine', 'CC_Base_TearLine_1', 'CC_Base_TearLine_2'],
  tongue: ['CC_Base_Tongue', 'CC_Base_Tongue_1'],
  hair: ['Side_part_wavy', 'Side_part_wavy_1', 'Side_part_wavy_2'],
};

// ============================================================================
// CC4_PRESET - Main export for Profile
// ============================================================================

export const CC4_PRESET: Profile = {
  name: 'Character Creator 4',
  animalType: 'human',
  // No emoji for humans - uses FaTheaterMasks icon instead
  auToMorphs: AU_TO_MORPHS,
  auToBones: BONE_AU_TO_BINDINGS,
  boneNodes: CC4_BONE_NODES,
  bonePrefix: CC4_BONE_PREFIX,
  suffixPattern: CC4_SUFFIX_PATTERN,
  morphToMesh: MORPH_TO_MESH,
  visemeKeys: VISEME_KEYS,
  visemeJawAmounts: VISEME_JAW_AMOUNTS,
  auMixDefaults: AU_MIX_DEFAULTS,
  auInfo: AU_INFO,
  eyeMeshNodes: CC4_EYE_MESH_NODES,
  continuumPairs: CONTINUUM_PAIRS_MAP,
  continuumLabels: CONTINUUM_LABELS,
  annotationRegions: [
    {
      name: 'full_body',
      objects: ['*'],
      paddingFactor: 2.0,
    },
    {
      name: 'head',
      bones: ['CC_Base_Head', 'CC_Base_JawRoot'],
      paddingFactor: 1.5,
      children: ['face', 'left_eye', 'right_eye', 'mouth'],
      expandAnimation: 'staggered',
      showChildConnections: true,
    },
    {
      name: 'face',
      bones: ['CC_Base_Head'],
      // meshes: populated by user selection in wizard - varies per character
      paddingFactor: 1.3,
      parent: 'head',
    },
    {
      name: 'left_eye',
      bones: ['CC_Base_L_Eye'],
      paddingFactor: 1.2,
      parent: 'head',
    },
    {
      name: 'right_eye',
      bones: ['CC_Base_R_Eye'],
      paddingFactor: 1.2,
      parent: 'head',
    },
    {
      name: 'mouth',
      bones: ['CC_Base_JawRoot'],
      paddingFactor: 1.5,
      parent: 'head',
    },
    {
      name: 'upper_body',
      bones: [
        'CC_Base_Spine02',
        'CC_Base_Head',
        'CC_Base_L_Clavicle',
        'CC_Base_R_Clavicle',
      ],
      paddingFactor: 1.6,
    },
    {
      name: 'back',
      bones: ['CC_Base_Spine01', 'CC_Base_Spine02'],
      paddingFactor: 1.8,
      cameraAngle: 180,
    },
    {
      name: 'left_hand',
      bones: ['CC_Base_L_Hand'],
      paddingFactor: 1.3,
      cameraAngle: 270,
    },
    {
      name: 'right_hand',
      bones: ['CC_Base_R_Hand'],
      paddingFactor: 1.3,
      cameraAngle: 90,
    },
    {
      name: 'left_foot',
      bones: ['CC_Base_L_Foot', 'CC_Base_L_ToeBase'],
      paddingFactor: 2.5,
      cameraAngle: 270,
    },
    {
      name: 'right_foot',
      bones: ['CC_Base_R_Foot', 'CC_Base_R_ToeBase'],
      paddingFactor: 2.5,
      cameraAngle: 90,
    },
  ],
};

export default CC4_PRESET;
