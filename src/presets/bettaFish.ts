/**
 * Betta Fish Preset - Skeletal Animation Mappings
 *
 * Bone mappings for the betta fish model from Sketchfab.
 * This fish has 53 bones and 1 embedded animation ("Take 01" swimming).
 * No morph targets/blend shapes - all animation is skeletal.
 *
 * Bone structure (inferred from hierarchy):
 * - Armature_rootJoint: Root
 *   - Bone_Armature: Main body root
 *     - Bone.001_Armature: Head/Front body
 *       - Bone.009-017: Likely eyes/gills area (left/right symmetry)
 *     - Bone.002_Armature: Body spine chain
 *       - Bone.003 → 004 → 005: Body to tail
 *         - Bone.018-045: Tail fins (multiple branching chains)
 *     - Bone.046/047: Pectoral fins (left/right)
 *   - Bone.006_Armature: Dorsal fin area
 *     - Bone.007/008: Dorsal fin bones
 */

import type { BoneBinding, AUInfo, CompositeRotation } from '../core/types';
import type { MeshInfo, MeshCategory } from '../mappings/types';
import { checkBindingsForLeftRight } from './cc4';

// ============================================================================
// BONE NAMES - All 53 bones in the fish skeleton
// Note: Bone names in the GLTF use dots (e.g., "Bone.001_Armature")
// ============================================================================

export const BONES = [
  "Armature_rootJoint",
  "Bone_Armature",
  "Bone.001_Armature",
  "Bone.009_Armature",
  "Bone.027_Armature",
  "Bone.029_Armature",
  "Bone.031_Armature",
  "Bone.028_Armature",
  "Bone.030_Armature",
  "Bone.032_Armature",
  "Bone.010_Armature",
  "Bone.012_Armature",
  "Bone.014_Armature",
  "Bone.016_Armature",
  "Bone.011_Armature",
  "Bone.013_Armature",
  "Bone.015_Armature",
  "Bone.017_Armature",
  "Bone.002_Armature",
  "Bone.003_Armature",
  "Bone.004_Armature",
  "Bone.005_Armature",
  "Bone.020_Armature",
  "Bone.025_Armature",
  "Bone.026_Armature",
  "Bone.039_Armature",
  "Bone.040_Armature",
  "Bone.041_Armature",
  "Bone.042_Armature",
  "Bone.043_Armature",
  "Bone.044_Armature",
  "Bone.045_Armature",
  "Bone.019_Armature",
  "Bone.023_Armature",
  "Bone.024_Armature",
  "Bone.034_Armature",
  "Bone.036_Armature",
  "Bone.038_Armature",
  "Bone.018_Armature",
  "Bone.021_Armature",
  "Bone.022_Armature",
  "Bone.033_Armature",
  "Bone.035_Armature",
  "Bone.037_Armature",
  "Bone.046_Armature",
  "Bone.048_Armature",
  "Bone.050_Armature",
  "Bone.047_Armature",
  "Bone.049_Armature",
  "Bone.051_Armature",
  "Bone.006_Armature",
  "Bone.007_Armature",
  "Bone.008_Armature"
] as const;

// ============================================================================
// BONE NAME CONFIGURATION
// Uses prefix/suffix system: 'Bone.' + baseNumber + '_Armature' = 'Bone.001_Armature'
// ============================================================================

export const BONE_PREFIX = 'Bone.';
export const BONE_SUFFIX = '_Armature';

// ============================================================================
// SEMANTIC BONE MAPPINGS - Human-readable names for key bones
// Uses base names that get combined with prefix/suffix
// Exception: ROOT, BODY_ROOT, and EYE nodes use full names (don't follow pattern)
// ============================================================================

export const BONE_NODES = {
  // Root bones (special - don't use prefix/suffix)
  ROOT: 'Armature_rootJoint',
  BODY_ROOT: 'Bone_Armature',

  // Head and body (use base names)
  HEAD: '001',
  BODY_FRONT: '002',
  BODY_MID: '003',
  BODY_BACK: '004',
  TAIL_BASE: '005',

  // Gills - bilateral (even = left, odd = right)
  GILL_L: '046',
  GILL_L_MID: '048',
  GILL_L_TIP: '050',
  GILL_R: '047',
  GILL_R_MID: '049',
  GILL_R_TIP: '051',

  // Dorsal fin (top fin)
  DORSAL_ROOT: '006',
  DORSAL_L: '007',
  DORSAL_R: '008',

  // Ventral fins (belly fins)
  VENTRAL_L: '018',
  VENTRAL_L_MID: '021',
  VENTRAL_L_TIP: '022',
  VENTRAL_R: '033',
  VENTRAL_R_MID: '035',
  VENTRAL_R_TIP: '037',

  // Pectoral fins - left side chain
  PECTORAL_L_ROOT: '009',
  PECTORAL_L_CHAIN1: '027',
  PECTORAL_L_CHAIN1_MID: '029',
  PECTORAL_L_CHAIN1_TIP: '031',
  PECTORAL_L_CHAIN2: '028',
  PECTORAL_L_CHAIN2_MID: '030',
  PECTORAL_L_CHAIN2_TIP: '032',

  // Pectoral fins - right side chain
  PECTORAL_R_ROOT: '010',
  PECTORAL_R_CHAIN1: '012',
  PECTORAL_R_CHAIN1_A: '014',
  PECTORAL_R_CHAIN1_B: '016',
  PECTORAL_R_ROOT2: '011',
  PECTORAL_R_CHAIN2: '013',
  PECTORAL_R_CHAIN2_A: '015',
  PECTORAL_R_CHAIN2_B: '017',

  // Eyes (special - mesh name, not bone)
  EYE_L: 'EYES_0',
  EYE_R: 'EYES_0',

  // Main tail fins
  TAIL_TOP: '020',
  TAIL_TOP_MID: '025',
  TAIL_TOP_TIP: '026',
  TAIL_MID: '039',
  TAIL_MID_A: '040',
  TAIL_MID_A_TIP: '041',
  TAIL_MID_B: '042',
  TAIL_MID_B_TIP: '043',
  TAIL_MID_C: '044',
  TAIL_MID_C_TIP: '045',

  // Side tail chains
  TAIL_SIDE_L: '019',
  TAIL_SIDE_L_MID: '023',
  TAIL_SIDE_L_TIP: '024',
  TAIL_SIDE_R: '034',
  TAIL_SIDE_R_MID: '036',
  TAIL_SIDE_R_TIP: '038',
} as const;

// ============================================================================
// AU ID CONSTANTS - Fish "Action Units" (analogous to FACS AUs for humans)
// These use plain numbers like CC4 preset - no special fish-specific types
// ============================================================================

// Body orientation (AU 2-7)
// 2 = Turn Left, 3 = Turn Right
// 4 = Pitch Up, 5 = Pitch Down
// 6 = Roll Left, 7 = Roll Right

// Tail movements (AU 12-15)
// 12 = Tail Sweep Left, 13 = Tail Sweep Right
// 14 = Tail Fin Spread, 15 = Tail Fin Close

// Pectoral fins (AU 20-27)
// 20 = Pectoral L Up, 21 = Pectoral L Down
// 22 = Pectoral R Up, 23 = Pectoral R Down
// 24 = Pectoral L Forward, 25 = Pectoral L Back
// 26 = Pectoral R Forward, 27 = Pectoral R Back

// Ventral fins (AU 30-33)
// 30 = Ventral L Up, 31 = Ventral L Down
// 32 = Ventral R Up, 33 = Ventral R Down

// Head (AU 51-54, matching FACS standard)
// 51 = Head Turn Left, 52 = Head Turn Right
// 53 = Head Up, 54 = Head Down
// (AU 55/56 Head Tilt removed - fish don't have this motion)

// Gills (AU 45-46) - separate L/R, single AU per side (0=closed, 1=flared)
// 45 = Gill L, 46 = Gill R

// Eye rotation (AU 61-64, like human FACS)
// 61 = Eyes Left, 62 = Eyes Right
// 63 = Eyes Up, 64 = Eyes Down

// ============================================================================
// BONE BINDINGS - Map AU IDs to bone rotations
// ============================================================================

export const BONE_BINDINGS: Record<number, BoneBinding[]> = {
  // ========== BODY ORIENTATION (AU 2-7) ==========
  // AU 2: Turn Left
  2: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: 1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: 1, maxDegrees: 5 },
  ],
  // AU 3: Turn Right
  3: [
    { node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: -1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: -1, maxDegrees: 5 },
  ],
  // AU 4: Pitch Up
  4: [
    { node: 'HEAD', channel: 'rx', scale: -1, maxDegrees: 20 },
    { node: 'BODY_FRONT', channel: 'rx', scale: -1, maxDegrees: 5 },
  ],
  // AU 5: Pitch Down
  5: [
    { node: 'HEAD', channel: 'rx', scale: 1, maxDegrees: 20 },
    { node: 'BODY_FRONT', channel: 'rx', scale: 1, maxDegrees: 5 },
  ],
  // AU 6: Roll Left
  6: [
    { node: 'BODY_ROOT', channel: 'rz', scale: -1, maxDegrees: 25 },
  ],
  // AU 7: Roll Right
  7: [
    { node: 'BODY_ROOT', channel: 'rz', scale: 1, maxDegrees: 25 },
  ],

  // ========== TAIL (AU 12-15) ==========
  // Tail sweep uses rz (roll axis) to sweep left/right in fish's local space
  // AU 12: Tail Sweep Left
  12: [
    { node: 'BODY_BACK', channel: 'rz', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_BASE', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'TAIL_TOP', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'TAIL_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],
  // AU 13: Tail Sweep Right
  13: [
    { node: 'BODY_BACK', channel: 'rz', scale: -1, maxDegrees: 15 },
    { node: 'TAIL_BASE', channel: 'rz', scale: -1, maxDegrees: 30 },
    { node: 'TAIL_TOP', channel: 'rz', scale: -1, maxDegrees: 20 },
    { node: 'TAIL_MID', channel: 'rz', scale: -1, maxDegrees: 20 },
  ],
  // Tail fin spread/close (fan motion)
  // AU 14: Tail Fin Spread
  14: [
    { node: 'TAIL_TOP', channel: 'rx', scale: -1, maxDegrees: 20 },
    { node: 'TAIL_SIDE_L', channel: 'rx', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_SIDE_R', channel: 'rx', scale: -1, maxDegrees: 15 },
  ],
  // AU 15: Tail Fin Close
  15: [
    { node: 'TAIL_TOP', channel: 'rx', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_SIDE_L', channel: 'rx', scale: -1, maxDegrees: 12 },
    { node: 'TAIL_SIDE_R', channel: 'rx', scale: 1, maxDegrees: 12 },
  ],

  // ========== PECTORAL FINS (AU 20-27, front/head fins) ==========
  // These are the decorative fins attached to the head (bones 009-017)
  // AU 20: Pectoral L Up
  20: [
    { node: 'PECTORAL_L_ROOT', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'PECTORAL_L_CHAIN1', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'PECTORAL_L_CHAIN2', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],
  // AU 21: Pectoral L Down
  21: [
    { node: 'PECTORAL_L_ROOT', channel: 'rz', scale: -1, maxDegrees: 40 },
    { node: 'PECTORAL_L_CHAIN1', channel: 'rz', scale: -1, maxDegrees: 20 },
    { node: 'PECTORAL_L_CHAIN2', channel: 'rz', scale: -1, maxDegrees: 20 },
  ],
  // AU 22: Pectoral R Up
  22: [
    { node: 'PECTORAL_R_ROOT', channel: 'rz', scale: -1, maxDegrees: 40 },
    { node: 'PECTORAL_R_CHAIN1', channel: 'rz', scale: -1, maxDegrees: 20 },
    { node: 'PECTORAL_R_ROOT2', channel: 'rz', scale: -1, maxDegrees: 40 },
  ],
  // AU 23: Pectoral R Down
  23: [
    { node: 'PECTORAL_R_ROOT', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'PECTORAL_R_CHAIN1', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'PECTORAL_R_ROOT2', channel: 'rz', scale: 1, maxDegrees: 40 },
  ],
  // AU 24: Pectoral L Forward
  24: [
    { node: 'PECTORAL_L_ROOT', channel: 'ry', scale: 1, maxDegrees: 30 },
  ],
  // AU 25: Pectoral L Back
  25: [
    { node: 'PECTORAL_L_ROOT', channel: 'ry', scale: -1, maxDegrees: 30 },
  ],
  // AU 26: Pectoral R Forward
  26: [
    { node: 'PECTORAL_R_ROOT', channel: 'ry', scale: -1, maxDegrees: 30 },
  ],
  // AU 27: Pectoral R Back
  27: [
    { node: 'PECTORAL_R_ROOT', channel: 'ry', scale: 1, maxDegrees: 30 },
  ],

  // ========== VENTRAL FINS (AU 30-33, belly fins) ==========
  // AU 30: Ventral L Up
  30: [
    { node: 'VENTRAL_L', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'VENTRAL_L_MID', channel: 'rz', scale: 1, maxDegrees: 15 },
  ],
  // AU 31: Ventral L Down
  31: [
    { node: 'VENTRAL_L', channel: 'rz', scale: -1, maxDegrees: 30 },
    { node: 'VENTRAL_L_MID', channel: 'rz', scale: -1, maxDegrees: 15 },
  ],
  // AU 32: Ventral R Up
  32: [
    { node: 'VENTRAL_R', channel: 'rz', scale: -1, maxDegrees: 30 },
    { node: 'VENTRAL_R_MID', channel: 'rz', scale: -1, maxDegrees: 15 },
  ],
  // AU 33: Ventral R Down
  33: [
    { node: 'VENTRAL_R', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'VENTRAL_R_MID', channel: 'rz', scale: 1, maxDegrees: 15 },
  ],

  // ========== GILLS (AU 45-46, separate L/R - 0=closed, 1=flared) ==========
  // AU 45: Gill L
  45: [
    { node: 'GILL_L', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'GILL_L_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],
  // AU 46: Gill R
  46: [
    { node: 'GILL_R', channel: 'rz', scale: -1, maxDegrees: 40 },
    { node: 'GILL_R_MID', channel: 'rz', scale: -1, maxDegrees: 20 },
  ],

  // ========== HEAD (AU 51-56, matching FACS standard) ==========
  // AU 51: Head Turn Left
  51: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: 1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: 1, maxDegrees: 5 },
  ],
  // AU 52: Head Turn Right
  52: [
    { node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: -1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: -1, maxDegrees: 5 },
  ],
  // AU 53: Head Up
  53: [
    { node: 'DORSAL_ROOT', channel: 'rx', scale: -1, maxDegrees: 25 },
    { node: 'DORSAL_L', channel: 'rx', scale: -1, maxDegrees: 15 },
    { node: 'DORSAL_R', channel: 'rx', scale: -1, maxDegrees: 15 },
  ],
  // AU 54: Head Down
  54: [
    { node: 'DORSAL_ROOT', channel: 'rx', scale: 1, maxDegrees: 25 },
    { node: 'DORSAL_L', channel: 'rx', scale: 1, maxDegrees: 15 },
    { node: 'DORSAL_R', channel: 'rx', scale: 1, maxDegrees: 15 },
  ],
  // Note: AU 55/56 (Head Tilt) removed - fish don't have this motion

  // ========== EYES (AU 61-64, rotate the EYES_0 mesh) ==========
  // Fish has a single combined eyes mesh - both eyes rotate together
  // AU 61: Eyes Left
  61: [
    { node: 'EYE_L', channel: 'ry', scale: 1, maxDegrees: 25 },  // Look left (yaw)
  ],
  // AU 62: Eyes Right
  62: [
    { node: 'EYE_L', channel: 'ry', scale: -1, maxDegrees: 25 }, // Look right (yaw)
  ],
  // AU 63: Eyes Up
  63: [
    { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 20 }, // Look up (pitch)
  ],
  // AU 64: Eyes Down
  64: [
    { node: 'EYE_L', channel: 'rx', scale: 1, maxDegrees: 20 },  // Look down (pitch)
  ],
};

// ============================================================================
// FISH AU INFO - Metadata for each action (compatible with loomlarge AUInfo)
// facePart is used to group controls in the UI
// ============================================================================

export const AU_INFO: Record<string, AUInfo> = {
  // Body Orientation
  '2': { id: '2', name: 'Turn Left', facePart: 'Body Orientation', muscularBasis: 'Myomere muscles', links: ['https://en.wikipedia.org/wiki/Myomere'] },
  '3': { id: '3', name: 'Turn Right', facePart: 'Body Orientation', muscularBasis: 'Myomere muscles', links: ['https://en.wikipedia.org/wiki/Myomere'] },
  '4': { id: '4', name: 'Pitch Up', facePart: 'Body Orientation', muscularBasis: 'Epaxial muscles', links: ['https://en.wikipedia.org/wiki/Epaxial_muscles'] },
  '5': { id: '5', name: 'Pitch Down', facePart: 'Body Orientation', muscularBasis: 'Hypaxial muscles', links: ['https://en.wikipedia.org/wiki/Hypaxial_muscles'] },
  '6': { id: '6', name: 'Roll Left', facePart: 'Body Orientation', muscularBasis: 'Lateral body muscles', links: ['https://en.wikipedia.org/wiki/Fish_locomotion'] },
  '7': { id: '7', name: 'Roll Right', facePart: 'Body Orientation', muscularBasis: 'Lateral body muscles', links: ['https://en.wikipedia.org/wiki/Fish_locomotion'] },

  // Tail (Caudal fin)
  '12': { id: '12', name: 'Tail Sweep Left', facePart: 'Caudal Fin', muscularBasis: 'Caudal fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },
  '13': { id: '13', name: 'Tail Sweep Right', facePart: 'Caudal Fin', muscularBasis: 'Caudal fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },
  '14': { id: '14', name: 'Tail Fin Spread', facePart: 'Caudal Fin', muscularBasis: 'Fin ray muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },
  '15': { id: '15', name: 'Tail Fin Close', facePart: 'Caudal Fin', muscularBasis: 'Fin ray muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Caudal_fin'] },

  // Pectoral Fins (side fins for steering and braking)
  '20': { id: '20', name: 'Pectoral L Up', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '21': { id: '21', name: 'Pectoral L Down', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '22': { id: '22', name: 'Pectoral R Up', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '23': { id: '23', name: 'Pectoral R Down', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '24': { id: '24', name: 'Pectoral L Forward', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '25': { id: '25', name: 'Pectoral L Back', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '26': { id: '26', name: 'Pectoral R Forward', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },
  '27': { id: '27', name: 'Pectoral R Back', facePart: 'Pectoral Fins', muscularBasis: 'Pectoral fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pectoral_fins'] },

  // Ventral/Pelvic Fins (belly fins for stability)
  '30': { id: '30', name: 'Ventral L Up', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },
  '31': { id: '31', name: 'Ventral L Down', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },
  '32': { id: '32', name: 'Ventral R Up', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },
  '33': { id: '33', name: 'Ventral R Down', facePart: 'Pelvic Fins', muscularBasis: 'Pelvic fin muscles', links: ['https://en.wikipedia.org/wiki/Fish_fin#Pelvic_fins'] },

  // Gills (separate L/R - single AU per side, 0=closed, 1=flared)
  '45': { id: '45', name: 'Gill L', facePart: 'Gills', muscularBasis: 'Opercular muscles', links: ['https://en.wikipedia.org/wiki/Operculum_(fish)'] },
  '46': { id: '46', name: 'Gill R', facePart: 'Gills', muscularBasis: 'Opercular muscles', links: ['https://en.wikipedia.org/wiki/Operculum_(fish)'] },

  // Head (AU 51-56, matching FACS standard)
  '51': { id: '51', name: 'Head Turn Left', facePart: 'Head', muscularBasis: 'Cranial muscles', links: ['https://en.wikipedia.org/wiki/Fish_anatomy#Head'] },
  '52': { id: '52', name: 'Head Turn Right', facePart: 'Head', muscularBasis: 'Cranial muscles', links: ['https://en.wikipedia.org/wiki/Fish_anatomy#Head'] },
  '53': { id: '53', name: 'Head Up', facePart: 'Head', muscularBasis: 'Cranial muscles', links: ['https://en.wikipedia.org/wiki/Fish_anatomy#Head'] },
  '54': { id: '54', name: 'Head Down', facePart: 'Head', muscularBasis: 'Cranial muscles', links: ['https://en.wikipedia.org/wiki/Fish_anatomy#Head'] },
  // Note: AU 55/56 (Head Tilt) removed - fish don't have this motion

  // Eye movement (similar to human AU 61-64)
  '61': { id: '61', name: 'Eyes Left', facePart: 'Eyes', muscularBasis: 'Extraocular muscles', links: ['https://en.wikipedia.org/wiki/Extraocular_muscles'] },
  '62': { id: '62', name: 'Eyes Right', facePart: 'Eyes', muscularBasis: 'Extraocular muscles', links: ['https://en.wikipedia.org/wiki/Extraocular_muscles'] },
  '63': { id: '63', name: 'Eyes Up', facePart: 'Eyes', muscularBasis: 'Superior rectus', links: ['https://en.wikipedia.org/wiki/Superior_rectus_muscle'] },
  '64': { id: '64', name: 'Eyes Down', facePart: 'Eyes', muscularBasis: 'Inferior rectus', links: ['https://en.wikipedia.org/wiki/Inferior_rectus_muscle'] },
};

// ============================================================================
// CONTINUUM PAIRS - Define which AUs form bidirectional pairs for sliders
// ============================================================================

/**
 * Continuum pairs - maps AU ID to its partner for bidirectional sliders
 * Format matches loomlarge's CONTINUUM_PAIRS_MAP (animal-agnostic)
 */
export const CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: string;
}> = {
  // Body Orientation (AU 2-7)
  2: { pairId: 3, isNegative: true, axis: 'yaw', node: 'HEAD' },    // Turn Left ↔ Turn Right
  3: { pairId: 2, isNegative: false, axis: 'yaw', node: 'HEAD' },
  5: { pairId: 4, isNegative: true, axis: 'pitch', node: 'HEAD' },  // Pitch Down ↔ Pitch Up
  4: { pairId: 5, isNegative: false, axis: 'pitch', node: 'HEAD' },
  6: { pairId: 7, isNegative: true, axis: 'roll', node: 'BODY_ROOT' },  // Roll Left ↔ Roll Right
  7: { pairId: 6, isNegative: false, axis: 'roll', node: 'BODY_ROOT' },

  // Tail (AU 12-15)
  12: { pairId: 13, isNegative: true, axis: 'roll', node: 'TAIL_BASE' },  // Tail Sweep Left ↔ Right
  13: { pairId: 12, isNegative: false, axis: 'roll', node: 'TAIL_BASE' },
  15: { pairId: 14, isNegative: true, axis: 'pitch', node: 'TAIL_TOP' },  // Tail Fin Close ↔ Spread
  14: { pairId: 15, isNegative: false, axis: 'pitch', node: 'TAIL_TOP' },

  // Pectoral Fins (AU 20-27)
  21: { pairId: 20, isNegative: true, axis: 'roll', node: 'PECTORAL_L_ROOT' },  // Pectoral L Down ↔ Up
  20: { pairId: 21, isNegative: false, axis: 'roll', node: 'PECTORAL_L_ROOT' },
  25: { pairId: 24, isNegative: true, axis: 'yaw', node: 'PECTORAL_L_ROOT' },   // Pectoral L Back ↔ Forward
  24: { pairId: 25, isNegative: false, axis: 'yaw', node: 'PECTORAL_L_ROOT' },
  23: { pairId: 22, isNegative: true, axis: 'roll', node: 'PECTORAL_R_ROOT' },  // Pectoral R Down ↔ Up
  22: { pairId: 23, isNegative: false, axis: 'roll', node: 'PECTORAL_R_ROOT' },
  27: { pairId: 26, isNegative: true, axis: 'yaw', node: 'PECTORAL_R_ROOT' },   // Pectoral R Back ↔ Forward
  26: { pairId: 27, isNegative: false, axis: 'yaw', node: 'PECTORAL_R_ROOT' },

  // Ventral Fins (AU 30-33)
  31: { pairId: 30, isNegative: true, axis: 'roll', node: 'VENTRAL_L' },  // Ventral L Down ↔ Up
  30: { pairId: 31, isNegative: false, axis: 'roll', node: 'VENTRAL_L' },
  33: { pairId: 32, isNegative: true, axis: 'roll', node: 'VENTRAL_R' },  // Ventral R Down ↔ Up
  32: { pairId: 33, isNegative: false, axis: 'roll', node: 'VENTRAL_R' },

  // Head (AU 51-56, matching FACS standard)
  51: { pairId: 52, isNegative: true, axis: 'yaw', node: 'HEAD' },   // Head Turn Left ↔ Right
  52: { pairId: 51, isNegative: false, axis: 'yaw', node: 'HEAD' },
  54: { pairId: 53, isNegative: true, axis: 'pitch', node: 'DORSAL_ROOT' },  // Head Down ↔ Up
  53: { pairId: 54, isNegative: false, axis: 'pitch', node: 'DORSAL_ROOT' },
  // Note: AU 55/56 (Head Tilt) removed - fish don't have this motion

  // Gills (AU 45-46) are NOT in continuum - they're single AUs (0=closed, 1=flared)
  // Each side is independent, not paired opposites

  // Eye movement (AU 61-64)
  61: { pairId: 62, isNegative: true, axis: 'yaw', node: 'HEAD' },   // Eyes Left ↔ Right
  62: { pairId: 61, isNegative: false, axis: 'yaw', node: 'HEAD' },
  64: { pairId: 63, isNegative: true, axis: 'pitch', node: 'HEAD' }, // Eyes Down ↔ Up
  63: { pairId: 64, isNegative: false, axis: 'pitch', node: 'HEAD' },
};

/**
 * Build continuum label from AU names.
 * Finds common prefix between AU names and extracts the differing part.
 * E.g. "Head Turn Left" + "Head Turn Right" → "Head Turn — Left ↔ Right"
 */
function buildContinuumLabel(negativeAU: AUInfo, positiveAU: AUInfo): string {
  const negName = negativeAU.name;
  const posName = positiveAU.name;

  // Find common prefix (word-level)
  const negWords = negName.split(' ');
  const posWords = posName.split(' ');

  let commonPrefixWords: string[] = [];
  for (let i = 0; i < Math.min(negWords.length, posWords.length); i++) {
    if (negWords[i] === posWords[i]) {
      commonPrefixWords.push(negWords[i]);
    } else {
      break;
    }
  }

  const prefix = commonPrefixWords.join(' ');
  const negSuffix = negWords.slice(commonPrefixWords.length).join(' ');
  const posSuffix = posWords.slice(commonPrefixWords.length).join(' ');

  if (prefix && negSuffix && posSuffix) {
    return `${prefix} — ${negSuffix} ↔ ${posSuffix}`;
  }

  // Fallback: just combine the names
  return `${negName} ↔ ${posName}`;
}

/**
 * Get continuum label for a pair, derived from AU_INFO.
 * No need for a separate CONTINUUM_LABELS object.
 */
export function getContinuumLabelForPair(negativeId: number, positiveId: number): string {
  const negAU = AU_INFO[String(negativeId)];
  const posAU = AU_INFO[String(positiveId)];

  if (!negAU || !posAU) {
    return `AU ${negativeId} ↔ AU ${positiveId}`;
  }

  return buildContinuumLabel(negAU, posAU);
}

/**
 * Build all continuum labels from AU_INFO and CONTINUUM_PAIRS_MAP.
 * This replaces the need for a manually-maintained CONTINUUM_LABELS object.
 */
export function buildContinuumLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  const seen = new Set<string>();

  for (const [auIdStr, info] of Object.entries(CONTINUUM_PAIRS_MAP)) {
    if (info.isNegative) {
      const negId = Number(auIdStr);
      const posId = info.pairId;
      const key = `${negId}-${posId}`;

      if (!seen.has(key)) {
        seen.add(key);
        labels[key] = getContinuumLabelForPair(negId, posId);
      }
    }
  }

  return labels;
}

// Build labels dynamically from AU_INFO (no separate CONTINUUM_LABELS needed)
export const CONTINUUM_LABELS = buildContinuumLabels();

// ============================================================================
// COMPOSITE ROTATIONS - Defines how AUs map to bone rotation axes
// This is required for the engine to properly apply bone rotations
// Uses plain AU ID numbers (animal-agnostic, like CC4 preset)
// ============================================================================

export const COMPOSITE_ROTATIONS: CompositeRotation[] = [
  // ========== HEAD & BODY - Combined entry per node (like CC4) ==========
  // AU 51/52 = Head Turn Left/Right (yaw)
  // AU 53/54 = Head Up/Down (pitch) - note: pitch on HEAD is from body AUs 4/5
  // No head tilt for fish - removed AU 55/56
  {
    node: 'HEAD',
    pitch: { aus: [4, 5], axis: 'rx', negative: 5, positive: 4 },    // Body Pitch Up/Down
    yaw: { aus: [51, 52], axis: 'ry', negative: 51, positive: 52 },  // Head Turn Left/Right
    roll: null,
  },
  {
    node: 'BODY_FRONT',
    pitch: { aus: [4, 5], axis: 'rx', negative: 5, positive: 4 },    // Body Pitch Up/Down
    yaw: { aus: [51, 52], axis: 'ry', negative: 51, positive: 52 },  // Head Turn Left/Right
    roll: null,
  },
  {
    node: 'BODY_MID',
    pitch: null,
    yaw: { aus: [51, 52], axis: 'ry', negative: 51, positive: 52 },  // Head Turn Left/Right
    roll: null,
  },
  {
    node: 'BODY_ROOT',
    pitch: null,
    yaw: null,
    roll: { aus: [6, 7], axis: 'rz', negative: 6, positive: 7 },  // Body Roll Left/Right
  },

  // ========== TAIL (AU 12-15) ==========
  // Tail sweep uses rz (roll axis) to sweep left/right in fish's local space
  {
    node: 'TAIL_BASE',
    pitch: null,
    yaw: null,
    roll: { aus: [12, 13], axis: 'rz', negative: 13, positive: 12 },  // Tail Sweep Left/Right
  },
  {
    node: 'BODY_BACK',
    pitch: null,
    yaw: null,
    roll: { aus: [12, 13], axis: 'rz', negative: 13, positive: 12 },
  },
  {
    node: 'TAIL_TOP',
    pitch: { aus: [14, 15], axis: 'rx', negative: 15, positive: 14 },  // Tail Fin Spread/Close
    yaw: null,
    roll: { aus: [12, 13], axis: 'rz', negative: 13, positive: 12 },
  },
  {
    node: 'TAIL_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [12, 13], axis: 'rz', negative: 13, positive: 12 },
  },
  // Side tail fins for spread/close
  {
    node: 'TAIL_SIDE_L',
    pitch: { aus: [14, 15], axis: 'rx', negative: 15, positive: 14 },
    yaw: null,
    roll: null,
  },
  {
    node: 'TAIL_SIDE_R',
    pitch: { aus: [14, 15], axis: 'rx', negative: 15, positive: 14 },
    yaw: null,
    roll: null,
  },

  // ========== PECTORAL FINS (AU 20-27, head-attached decorative fins) ==========
  {
    node: 'PECTORAL_L_ROOT',
    pitch: null,
    yaw: { aus: [24, 25], axis: 'ry', negative: 25, positive: 24 },  // Pectoral L Forward/Back
    roll: { aus: [20, 21], axis: 'rz', negative: 21, positive: 20 },  // Pectoral L Up/Down
  },
  {
    node: 'PECTORAL_L_CHAIN1',
    pitch: null,
    yaw: null,
    roll: { aus: [20, 21], axis: 'rz', negative: 21, positive: 20 },
  },
  {
    node: 'PECTORAL_L_CHAIN2',
    pitch: null,
    yaw: null,
    roll: { aus: [20, 21], axis: 'rz', negative: 21, positive: 20 },
  },
  {
    node: 'PECTORAL_R_ROOT',
    pitch: null,
    yaw: { aus: [26, 27], axis: 'ry', negative: 27, positive: 26 },  // Pectoral R Forward/Back
    roll: { aus: [22, 23], axis: 'rz', negative: 23, positive: 22 },  // Pectoral R Up/Down
  },
  {
    node: 'PECTORAL_R_ROOT2',
    pitch: null,
    yaw: null,
    roll: { aus: [22, 23], axis: 'rz', negative: 23, positive: 22 },
  },
  {
    node: 'PECTORAL_R_CHAIN1',
    pitch: null,
    yaw: null,
    roll: { aus: [22, 23], axis: 'rz', negative: 23, positive: 22 },
  },

  // ========== VENTRAL FINS (AU 30-33, belly fins) ==========
  {
    node: 'VENTRAL_L',
    pitch: null,
    yaw: null,
    roll: { aus: [30, 31], axis: 'rz', negative: 31, positive: 30 },  // Ventral L Up/Down
  },
  {
    node: 'VENTRAL_L_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [30, 31], axis: 'rz', negative: 31, positive: 30 },
  },
  {
    node: 'VENTRAL_R',
    pitch: null,
    yaw: null,
    roll: { aus: [32, 33], axis: 'rz', negative: 33, positive: 32 },  // Ventral R Up/Down
  },
  {
    node: 'VENTRAL_R_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [32, 33], axis: 'rz', negative: 33, positive: 32 },
  },

  // ========== DORSAL FIN (AU 53/54 - Head Up/Down via dorsal bones) ==========
  // In this fish model, the dorsal bones control the head's vertical movement
  // No head tilt for fish - AU 55/56 removed
  {
    node: 'DORSAL_ROOT',
    pitch: { aus: [53, 54], axis: 'rx', negative: 54, positive: 53 },  // Head Up/Down
    yaw: null,
    roll: null,
  },
  {
    node: 'DORSAL_L',
    pitch: { aus: [53, 54], axis: 'rx', negative: 54, positive: 53 },
    yaw: null,
    roll: null,
  },
  {
    node: 'DORSAL_R',
    pitch: { aus: [53, 54], axis: 'rx', negative: 54, positive: 53 },
    yaw: null,
    roll: null,
  },

  // ========== GILLS (AU 45-46, separate L/R - single AU per side, not continuum) ==========
  // AU 45 controls left side only, AU 46 controls right side only
  // These are intensity-only AUs (0=closed, 1=flared) - no negative partner
  {
    node: 'GILL_L',
    pitch: null,
    yaw: null,
    roll: { aus: [45], axis: 'rz', negative: undefined, positive: 45 },  // Gill L
  },
  {
    node: 'GILL_L_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [45], axis: 'rz', negative: undefined, positive: 45 },
  },
  {
    node: 'GILL_R',
    pitch: null,
    yaw: null,
    roll: { aus: [46], axis: 'rz', negative: undefined, positive: 46 },  // Gill R
  },
  {
    node: 'GILL_R_MID',
    pitch: null,
    yaw: null,
    roll: { aus: [46], axis: 'rz', negative: undefined, positive: 46 },
  },

  // ========== EYES (AU 61-64) ==========
  // Single EYES_0 mesh rotates both fish eyes together
  {
    node: 'EYE_L',
    pitch: { aus: [63, 64], axis: 'rx', negative: 64, positive: 63 },  // Eyes Up/Down
    yaw: { aus: [61, 62], axis: 'ry', negative: 62, positive: 61 },    // Eyes Left/Right
    roll: null,
  },
];


// ============================================================================
// EYE MESH NODES - Fallback for eye rotation when no bone exists
// Fish has a single combined EYES_0 mesh for both eyes
// ============================================================================

export const EYE_MESH_NODES = {
  LEFT: 'EYES_0',
  RIGHT: 'EYES_0',  // Same mesh, both eyes rotate together
} as const;

// ============================================================================
// MESH SETTINGS - Material settings for fish meshes (depthWrite, blending, etc.)
// ============================================================================

export const MESHES: Record<string, MeshInfo> = {
  // Body mesh - main fish body with proper depth and blending
  'BODY_0': {
    category: 'body' as MeshCategory,
    morphCount: 0,  // Fish model has no morphs
    material: {
      depthWrite: true,
      depthTest: true,
      blending: 'Normal',
    },
  },
  // Eyes mesh - render behind body with proper transparency support
  'EYES_0': {
    category: 'eye' as MeshCategory,
    morphCount: 0,
    material: {
      renderOrder: -10,  // Render early (behind body)
      depthWrite: true,
      depthTest: true,
      blending: 'Normal',
    },
  },
};

// ============================================================================
// PRESET EXPORT
// ============================================================================

export const BETTA_FISH_PRESET = {
  name: 'Betta Fish',
  animalType: 'fish',
  emoji: '🐟',
  bones: BONES,
  boneNodes: BONE_NODES,
  boneBindings: BONE_BINDINGS,
  actionInfo: AU_INFO,
  eyeMeshNodes: EYE_MESH_NODES,
  // No morph targets in this model
  auToMorphs: {} as Record<number, import('../mappings/types').MorphTargetsBySide>,
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],
};

// Engine-compatible config format for Loom3
export const AU_MAPPING_CONFIG = {
  name: 'Betta Fish',
  animalType: 'fish',
  emoji: '🐟',
  auToBones: BONE_BINDINGS,
  boneNodes: BONE_NODES,
  // Prefix/suffix for bone resolution: 'Bone.' + '001' + '_Armature' = 'Bone.001_Armature'
  bonePrefix: BONE_PREFIX,
  boneSuffix: BONE_SUFFIX,
  // Suffix pattern for fuzzy matching (Sketchfab/Blender exports)
  suffixPattern: '_\\d+$|\\.\\d+$',
  auToMorphs: {} as Record<number, import('../mappings/types').MorphTargetsBySide>,
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],
  auInfo: AU_INFO,
  compositeRotations: COMPOSITE_ROTATIONS,
  eyeMeshNodes: EYE_MESH_NODES,
  meshes: MESHES,
  auMixDefaults: {} as Record<number, number>,  // No mixed AUs (morph+bone) in this model
  continuumPairs: CONTINUUM_PAIRS_MAP,
  continuumLabels: CONTINUUM_LABELS,
};

/**
 * Check if an AU has bilateral bone bindings (L and R nodes)
 * Used to determine if a balance slider should be shown
 */
export const hasLeftRightBones = (auId: number): boolean => {
  const bindings = BONE_BINDINGS[auId];
  return checkBindingsForLeftRight(bindings);
};

export default BETTA_FISH_PRESET;

// ============================================================================
// LEGACY ALIASES - For backwards compatibility with existing code
// ============================================================================

export const ACTION_INFO = AU_INFO;
export const FISH_BONES = BONES;
export const FISH_BONE_NODES = BONE_NODES;
export const FISH_BONE_BINDINGS = BONE_BINDINGS;
export const FISH_AU_INFO = AU_INFO;
export const FISH_ACTION_INFO = ACTION_INFO;
export const FISH_CONTINUUM_PAIRS_MAP = CONTINUUM_PAIRS_MAP;
export const FISH_CONTINUUM_LABELS = CONTINUUM_LABELS;
export const FISH_COMPOSITE_ROTATIONS = COMPOSITE_ROTATIONS;
export const FISH_EYE_MESH_NODES = EYE_MESH_NODES;
export const FISH_MESHES = MESHES;
export const FISH_AU_MAPPING_CONFIG = AU_MAPPING_CONFIG;
export const fishHasLeftRightBones = hasLeftRightBones;
