// Mapping-only: ARKit/CC-style blendshape keys and FACS/viseme mappings
// Exports consumed by UI panels and engine (EngineThree). No runtime logic here.

export const AU_TO_MORPHS: Record<number, string[]> = {
  // Brows / Forehead
  1: ['Brow_Raise_Inner_L','Brow_Raise_Inner_R'],
  2: ['Brow_Raise_Outer_L','Brow_Raise_Outer_R'],
  4: ['Brow_Drop_L','Brow_Drop_R'],

  // Eyes / Lids
  5: ['Eye_Wide_L','Eye_Wide_R'],
  6: ['Cheek_Raise_L','Cheek_Raise_R'],
  7: ['Eye_Squint_L','Eye_Squint_R'],
  43: ['Eye_Blink_L','Eye_Blink_R'],

  // Nose / Midface
  9: ['Nose_Sneer_L','Nose_Sneer_R'],
  34: ['Cheek_Puff_L','Cheek_Puff_R'],

  // Mouth / Lips
  8:  ['Mouth_Press_L','Mouth_Press_R','Mouth_Close'],
  10: ['Mouth_Up_Upper_L','Mouth_Up_Upper_R'],
  11: ['Mouth_Dimple_L','Mouth_Dimple_R'],
  12: ['Mouth_Smile_L','Mouth_Smile_R'],
  13: ['Mouth_Stretch_L','Mouth_Stretch_R'],
  14: ['Mouth_Dimple_L','Mouth_Dimple_R'],
  15: ['Mouth_Frown_L','Mouth_Frown_R'],
  16: ['Mouth_Down_Lower_L','Mouth_Down_Lower_R'],
  17: ['Mouth_Shrug_Lower'],
  18: ['Mouth_Pucker'],
  20: ['Mouth_Stretch_L','Mouth_Stretch_R'],
  22: ['Mouth_Funnel'],
  23: ['Mouth_Press_L','Mouth_Press_R'],
  24: ['Mouth_Press_L','Mouth_Press_R'],
  25: ['Jaw_Open'],  // Lips Part - small jaw open with morph
  26: ['Jaw_Open'],  // Jaw Drop - mixed: bone rotation + Jaw_Open morph
  27: ['Jaw_Open'],  // Mouth Stretch - larger jaw open with morph
  28: ['Mouth_Roll_In_Upper','Mouth_Roll_In_Lower'],

  // Tongue
  19: ['Tongue_Out'],
  36: ['Tongue_Bulge_L','Tongue_Bulge_R'],
  37: ['Tongue_Up'],      // Tongue Up - morph + bone rotation
  38: ['Tongue_Down'],    // Tongue Down - morph + bone rotation
  39: ['Tongue_L'],       // Tongue Left - morph + bone rotation
  40: ['Tongue_R'],       // Tongue Right - morph + bone rotation
  41: [],  // Tongue Tilt Left - BONE ONLY
  42: [],  // Tongue Tilt Right - BONE ONLY
  // Extended tongue morphs (CC4-specific)
  73: ['Tongue_Narrow'],
  74: ['Tongue_Wide'],
  75: ['Tongue_Roll'],
  76: ['Tongue_Tip_Up'],
  77: ['Tongue_Tip_Down'],

  // Jaw / Head (convenience)
  29: ['Jaw_Forward'],
  30: ['Jaw_L'],  // Jaw Left - mixed: bone rotation + Jaw_L morph
  35: ['Jaw_R'],  // Jaw Right - mixed: bone rotation + Jaw_R morph
  31: ['Head_Turn_L'],
  32: ['Head_Turn_R'],
  33: ['Head_Turn_Up'],
  54: ['Head_Turn_Down'],
  55: ['Head_Tilt_L'],
  56: ['Head_Tilt_R'],

  // Eye Direction (convenience)
  61: ['Eye_L_Look_L','Eye_R_Look_L'],
  62: ['Eye_L_Look_R','Eye_R_Look_R'],
  63: ['Eye_L_Look_Up','Eye_R_Look_Up'],
  64: ['Eye_L_Look_Down','Eye_R_Look_Down'],
  // Single-eye controls (Left eye)
  65: ['Eye_L_Look_L'],
  66: ['Eye_L_Look_R'],
  67: ['Eye_L_Look_Up'],
  68: ['Eye_L_Look_Down'],
  // Single-eye controls (Right eye)
  69: ['Eye_R_Look_L'],
  70: ['Eye_R_Look_R'],
  71: ['Eye_R_Look_Up'],
  72: ['Eye_R_Look_Down'],

  // Eye Occlusion morphs (CC_Base_EyeOcclusion meshes)
  // These control the shadow/depth around the eyes
  80: ['EO Bulge L', 'EO Bulge R'],
  81: ['EO Depth L', 'EO Depth R'],
  82: ['EO Inner Depth L', 'EO Inner Depth R'],
  83: ['EO Inner Height L', 'EO Inner Height R'],
  84: ['EO Inner Width L', 'EO Inner Width R'],
  85: ['EO Outer Depth L', 'EO Outer Depth R'],
  86: ['EO Outer Height L', 'EO Outer Height R'],
  87: ['EO Outer Width L', 'EO Outer Width R'],
  88: ['EO Upper Depth L', 'EO Upper Depth R'],
  89: ['EO Lower Depth L', 'EO Lower Depth R'],
  90: ['EO Center Upper Depth L', 'EO Center Upper Depth R'],
  91: ['EO Center Upper Height L', 'EO Center Upper Height R'],
  92: ['EO Center Lower Depth L', 'EO Center Lower Depth R'],
  93: ['EO Center Lower Height L', 'EO Center Lower Height R'],
  94: ['EO Inner Upper Depth L', 'EO Inner Upper Depth R'],
  95: ['EO Inner Upper Height L', 'EO Inner Upper Height R'],
  96: ['EO Inner Lower Depth L', 'EO Inner Lower Depth R'],
  97: ['EO Inner Lower Height L', 'EO Inner Lower Height R'],
  98: ['EO Outer Upper Depth L', 'EO Outer Upper Depth R'],
  99: ['EO Outer Upper Height L', 'EO Outer Upper Height R'],
  100: ['EO Outer Lower Depth L', 'EO Outer Lower Depth R'],
  101: ['EO Outer Lower Height L', 'EO Outer Lower Height R'],
  102: ['EO Duct Depth L', 'EO Duct Depth R'],
};

export const VISEME_KEYS: string[] = [
  'EE','Er','IH','Ah','Oh','W_OO','S_Z','Ch_J','F_V','TH','T_L_D_N','B_M_P','K_G_H_NG','AE','R'
];

// Bone bindings for rigs that rotate eyeballs via armature rather than morphs.
// Mapping-only: the engine resolves placeholder node names (EYE_L/EYE_R/etc.) to real nodes using candidates.
export type BoneBinding = {
  node: 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE' | string;
  channel: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz';  // rotations in radians, translations in model units
  scale: -1 | 1;
  maxDegrees?: number;  // for rotation channels
  maxUnits?: number;    // for translation channels
};

export const BONE_AU_TO_BINDINGS: Record<number, BoneBinding[]> = {
  // Head turn and tilt - use HEAD bone only (NECK should not rotate with head)
  // Three.js Y rotation: positive = counter-clockwise from above = head turns LEFT (character POV)
  31: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },   // Head turn left
  ],
  32: [
    { node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 },  // Head turn right
  ],
  33: [
    { node: 'HEAD', channel: 'rx', scale: -1, maxDegrees: 20 },  // Head up
  ],
  54: [
    { node: 'HEAD', channel: 'rx', scale: 1, maxDegrees: 20 },   // Head down
  ],
  55: [
    { node: 'HEAD', channel: 'rz', scale: -1, maxDegrees: 15 },  // Head tilt left
  ],
  56: [
    { node: 'HEAD', channel: 'rz', scale: 1, maxDegrees: 15 },   // Head tilt right
  ],
  // Eyes horizontal (yaw) - CC4 rigs use rz for horizontal eye rotation
  61: [
    { node: 'EYE_L', channel: 'rz', scale: 1, maxDegrees: 32 },   // Eyes look left
    { node: 'EYE_R', channel: 'rz', scale: 1, maxDegrees: 32 },
  ],
  62: [
    { node: 'EYE_L', channel: 'rz', scale: -1, maxDegrees: 32 },  // Eyes look right
    { node: 'EYE_R', channel: 'rz', scale: -1, maxDegrees: 32 },
  ],
  63: [
    { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 32 },
    { node: 'EYE_R', channel: 'rx', scale: -1, maxDegrees: 32 },
  ],
  64: [
    { node: 'EYE_L', channel: 'rx', scale: 1, maxDegrees: 32 },
    { node: 'EYE_R', channel: 'rx', scale: 1, maxDegrees: 32 },
  ],
  // Single-eye (Left) — horizontal (rz for CC4) and vertical (rx)
  65: [ { node: 'EYE_L', channel: 'rz', scale: -1, maxDegrees: 15 } ],
  66: [ { node: 'EYE_L', channel: 'rz', scale:  1, maxDegrees: 15 } ],
  67: [ { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 12 } ],
  68: [ { node: 'EYE_L', channel: 'rx', scale:  1, maxDegrees: 12 } ],
  // Single-eye (Right) — horizontal (rz for CC4) and vertical (rx)
  69: [ { node: 'EYE_R', channel: 'rz', scale: -1, maxDegrees: 15 } ],
  70: [ { node: 'EYE_R', channel: 'rz', scale:  1, maxDegrees: 15 } ],
  71: [ { node: 'EYE_R', channel: 'rx', scale: -1, maxDegrees: 12 } ],
  72: [ { node: 'EYE_R', channel: 'rx', scale:  1, maxDegrees: 12 } ],

  // Jaw
  25: [ // Lips Part — small jaw open
    { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 5.84 },  // 73% of 8
  ],
  26: [
    { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 28 },  // 73% of 20
  ],
  27: [ // Mouth Stretch — larger jaw open
    { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 32 }, // 73% of 25
  ],
  29: [
    { node: 'JAW', channel: 'tz', scale: -1, maxUnits: 0.02 },  // Negative for forward thrust
  ],
  30: [ // Jaw Left
    { node: 'JAW', channel: 'ry', scale: -1, maxDegrees: 5 },
  ],
  35: [ // Jaw Right
    { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 5 },
  ],

  // Tongue
  19: [
    { node: 'TONGUE', channel: 'tz', scale: -1, maxUnits: 0.008 },
  ],
  37: [ // Tongue Up
    { node: 'TONGUE', channel: 'rz', scale: -1, maxDegrees: 45 },
  ],
  38: [ // Tongue Down
    { node: 'TONGUE', channel: 'rz', scale: 1, maxDegrees: 45 },
  ],
  39: [ // Tongue Left
    { node: 'TONGUE', channel: 'ry', scale: -1, maxDegrees: 10 },
  ],
  40: [ // Tongue Right
    { node: 'TONGUE', channel: 'ry', scale: 1, maxDegrees: 10 },
  ],
  41: [ // Tongue Tilt Left
    { node: 'TONGUE', channel: 'rx', scale: -1, maxDegrees: 20 },
  ],
  42: [ // Tongue Tilt Right
    { node: 'TONGUE', channel: 'rx', scale: 1, maxDegrees: 20 },
  ],
};

/** AUs that have both morphs and bones - can blend between them */
export const MIXED_AUS = new Set(
  Object.keys(AU_TO_MORPHS)
    .map(Number)
    .filter(id => AU_TO_MORPHS[id]?.length && BONE_AU_TO_BINDINGS[id]?.length)
);

/** Check if an AU has separate left/right morphs */
export const hasLeftRightMorphs = (auId: number): boolean => {
  const keys = AU_TO_MORPHS[auId] || [];
  return keys.some(k => /_L$|_R$|Left$|Right$/.test(k));
};

/**
 * COMPOSITE_ROTATIONS - Defines unified rotation axes for bones that need
 * pitch/yaw/roll tracked together to prevent overwriting.
 *
 * Each composite bone tracks its complete 3D rotation state. When an AU is set,
 * only its specific axis is updated, then the complete rotation is applied.
 */
export interface RotationAxis {
  aus: number[];       // AUs that affect this axis
  axis: 'rx' | 'ry' | 'rz';  // Physical rotation axis
  negative?: number;   // AU for negative direction (if continuum)
  positive?: number;   // AU for positive direction (if continuum)
}

export interface CompositeRotation {
  node: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE';
  pitch: RotationAxis | null;  // Up/down rotation (typically rx or rz)
  yaw: RotationAxis | null;    // Left/right rotation (typically ry)
  roll: RotationAxis | null;   // Tilt rotation (typically rz)
}

export const COMPOSITE_ROTATIONS: CompositeRotation[] = [
  {
    node: 'JAW',
    pitch: { aus: [25, 26, 27], axis: 'rz' },  // Jaw drop (opens mouth downward)
    yaw: { aus: [30, 35], axis: 'ry', negative: 30, positive: 35 },  // Jaw lateral (left/right)
    roll: null  // Jaw doesn't have roll
  },
  {
    node: 'HEAD',
    pitch: { aus: [54, 33], axis: 'rx', negative: 54, positive: 33 },  // Head down/up
    yaw: { aus: [31, 32], axis: 'ry', negative: 31, positive: 32 },  // Head turn left/right
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

/**
 * Eye axis configuration for CC4 rigs.
 * CC4 eyes rotate around Z for horizontal (yaw) movement, not Y.
 */
export const EYE_AXIS = {
  yaw: 'rz' as const,
  pitch: 'rx' as const,
} as const;

// Candidate node names to resolve placeholders per-side on common CC/GLB exports.
// Canonical CC4 bone + mesh names. Since we only target CC4 rigs now, the mapping is explicit.
export const CC4_BONE_NODES = {
  EYE_L: 'CC_Base_L_Eye',
  EYE_R: 'CC_Base_R_Eye',
  HEAD: 'CC_Base_Head',
  NECK: 'CC_Base_NeckTwist01',
  NECK_TWIST: 'CC_Base_NeckTwist02',
  JAW: 'CC_Base_JawRoot',
  TONGUE: 'CC_Base_Tongue01'
} as const;

export const CC4_EYE_MESH_NODES = {
  LEFT: 'CC_Base_Eye',
  RIGHT: 'CC_Base_Eye_1'
} as const;

// --- Metadata (subset) ---

export interface AUInfo {
  id: string;
  name: string;
  muscularBasis?: string;
  links?: string[];
  faceArea?: 'Upper' | 'Lower'; // macro region
  facePart?: 'Forehead' | 'Brow' | 'Eyelids' | 'Eyes' | 'EyeOcclusion' | 'Nose' | 'Cheeks' | 'Mouth' | 'Chin' | 'Jaw' | 'Head' | 'Tongue' | 'Other';
  faceSection?: string; // back-compat (mirror of facePart)
}

export const AU_INFO: Record<string, AUInfo> = {
  // Forehead / Brow (Upper)
  '1':  { id:'1',  name:'Inner Brow Raiser',  muscularBasis:'frontalis (pars medialis)', links:['https://en.wikipedia.org/wiki/Frontalis_muscle'], faceArea:'Upper', facePart:'Forehead', faceSection:'Forehead' },
  '2':  { id:'2',  name:'Outer Brow Raiser',  muscularBasis:'frontalis (pars lateralis)', links:['https://en.wikipedia.org/wiki/Frontalis_muscle'], faceArea:'Upper', facePart:'Forehead', faceSection:'Forehead' },
  '4':  { id:'4',  name:'Brow Lowerer',      muscularBasis:'corrugator/depressor supercilii', links:['https://en.wikipedia.org/wiki/Corrugator_supercilii'], faceArea:'Upper', facePart:'Brow', faceSection:'Brow' },

  // Eyelids / Eyes (Upper)
  '5':  { id:'5',  name:'Upper Lid Raiser',  muscularBasis:'levator palpebrae superioris', links:['https://en.wikipedia.org/wiki/Levator_palpebrae_superioris'], faceArea:'Upper', facePart:'Eyelids', faceSection:'Eyelids' },
  '6':  { id:'6',  name:'Cheek Raiser',      muscularBasis:'orbicularis oculi (pars orbitalis)', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi'], faceArea:'Upper', facePart:'Cheeks', faceSection:'Cheeks' },
  '7':  { id:'7',  name:'Lid Tightener',     muscularBasis:'orbicularis oculi (pars palpebralis)', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi'], faceArea:'Upper', facePart:'Eyelids', faceSection:'Eyelids' },
  '43': { id:'43', name:'Eyes Closed',       muscularBasis:'orbicularis oculi', links:['https://en.wikipedia.org/wiki/Orbicularis_oculi_muscle'], faceArea:'Upper', facePart:'Eyelids', faceSection:'Eyelids' },
  '61': { id:'61', name:'Eyes Turn Left',    faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes' },
  '62': { id:'62', name:'Eyes Turn Right',   faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes' },
  '63': { id:'63', name:'Eyes Up',           faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes' },
  '64': { id:'64', name:'Eyes Down',         faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes' },

  // Nose / Cheeks
  '9':  { id:'9',  name:'Nose Wrinkler',     muscularBasis:'levator labii superioris alaeque nasi', links:['https://en.wikipedia.org/wiki/Levator_labii_superioris_alaeque_nasi'], faceArea:'Upper', facePart:'Nose', faceSection:'Nose' },
  '34': { id:'34', name:'Cheek Puff',        faceArea:'Lower', facePart:'Cheeks', faceSection:'Cheeks' },

  // Mouth (Lower)
  '8':  { id:'8',  name:'Lips Toward Each Other', muscularBasis:'orbicularis oris', links:['https://en.wikipedia.org/wiki/Orbicularis_oris'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '10': { id:'10', name:'Upper Lip Raiser',  muscularBasis:'levator labii superioris', links:['https://en.wikipedia.org/wiki/Levator_labii_superioris'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '11': { id:'11', name:'Nasolabial Deepener', muscularBasis:'zygomaticus minor', links:['https://en.wikipedia.org/wiki/Zygomaticus_minor'], faceArea:'Lower', facePart:'Cheeks', faceSection:'Cheeks' },
  '12': { id:'12', name:'Lip Corner Puller', muscularBasis:'zygomaticus major', links:['https://en.wikipedia.org/wiki/Zygomaticus_major'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '13': { id:'13', name:'Sharp Lip Puller',  muscularBasis:'levator anguli oris', links:['https://en.wikipedia.org/wiki/Levator_anguli_oris'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '14': { id:'14', name:'Dimpler',           muscularBasis:'buccinator', links:['https://en.wikipedia.org/wiki/Buccinator'], faceArea:'Lower', facePart:'Cheeks', faceSection:'Cheeks' },
  '15': { id:'15', name:'Lip Corner Depressor', muscularBasis:'depressor anguli oris', links:['https://en.wikipedia.org/wiki/Depressor_anguli_oris'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '16': { id:'16', name:'Lower Lip Depressor', muscularBasis:'depressor labii inferioris', links:['https://en.wikipedia.org/wiki/Depressor_labii_inferioris'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '17': { id:'17', name:'Chin Raiser',       muscularBasis:'mentalis', links:['https://en.wikipedia.org/wiki/Mentalis'], faceArea:'Lower', facePart:'Chin', faceSection:'Chin' },
  '18': { id:'18', name:'Lip Pucker',        faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '20': { id:'20', name:'Lip Stretcher',     muscularBasis:'risorius + platysma', links:['https://en.wikipedia.org/wiki/Risorius','https://en.wikipedia.org/wiki/Platysma'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '22': { id:'22', name:'Lip Funneler',      muscularBasis:'orbicularis oris', links:['https://en.wikipedia.org/wiki/Orbicularis_oris'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '23': { id:'23', name:'Lip Tightener',     muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '24': { id:'24', name:'Lip Presser',       muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '25': { id:'25', name:'Lips Part',         faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '27': { id:'27', name:'Mouth Stretch',     muscularBasis:'pterygoids + digastric', links:['https://en.wikipedia.org/wiki/Pterygoid_bone','https://en.wikipedia.org/wiki/Digastric_muscle'], faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },
  '28': { id:'28', name:'Lip Suck',          muscularBasis:'orbicularis oris', faceArea:'Lower', facePart:'Mouth', faceSection:'Mouth' },

  // Tongue (Lower)
  '19': { id:'19', name:'Tongue Show',       faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '36': { id:'36', name:'Tongue Bulge',      faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '37': { id:'37', name:'Tongue Up',         faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '38': { id:'38', name:'Tongue Down',       faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '39': { id:'39', name:'Tongue Left',       faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '40': { id:'40', name:'Tongue Right',      faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '41': { id:'41', name:'Tongue Tilt Left',  faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '42': { id:'42', name:'Tongue Tilt Right', faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  // Extended tongue controls (CC4-specific morphs)
  '73': { id:'73', name:'Tongue Narrow',     faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '74': { id:'74', name:'Tongue Wide',       faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '75': { id:'75', name:'Tongue Roll',       faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '76': { id:'76', name:'Tongue Tip Up',     faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },
  '77': { id:'77', name:'Tongue Tip Down',   faceArea:'Lower', facePart:'Tongue', faceSection:'Tongue' },

  // Jaw (Lower)
  '26': { id:'26', name:'Jaw Drop',          muscularBasis:'masseter (relax temporalis)', links:['https://en.wikipedia.org/wiki/Masseter_muscle'], faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },
  '29': { id:'29', name:'Jaw Thrust',        faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },
  '30': { id:'30', name:'Jaw Left',          faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },
  '35': { id:'35', name:'Jaw Right',         faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },

  // Head (Upper, convenience)
  '31': { id:'31', name:'Head Turn Left',    faceArea:'Upper', facePart:'Head', faceSection:'Head' },
  '32': { id:'32', name:'Head Turn Right',   faceArea:'Upper', facePart:'Head', faceSection:'Head' },
  '33': { id:'33', name:'Head Up',           faceArea:'Upper', facePart:'Head', faceSection:'Head' },
  '54': { id:'54', name:'Head Down',         faceArea:'Upper', facePart:'Head', faceSection:'Head' },
  '55': { id:'55', name:'Head Tilt Left',    faceArea:'Upper', facePart:'Head', faceSection:'Head' },
  '56': { id:'56', name:'Head Tilt Right',   faceArea:'Upper', facePart:'Head', faceSection:'Head' },

  // Eye Occlusion (Upper) - controls shadow/depth around the eyes
  '80': { id:'80', name:'Eye Bulge',              faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '81': { id:'81', name:'Eye Depth',              faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '82': { id:'82', name:'Eye Inner Depth',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '83': { id:'83', name:'Eye Inner Height',       faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '84': { id:'84', name:'Eye Inner Width',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '85': { id:'85', name:'Eye Outer Depth',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '86': { id:'86', name:'Eye Outer Height',       faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '87': { id:'87', name:'Eye Outer Width',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '88': { id:'88', name:'Eye Upper Depth',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '89': { id:'89', name:'Eye Lower Depth',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '90': { id:'90', name:'Eye Center Upper Depth', faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '91': { id:'91', name:'Eye Center Upper Height',faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '92': { id:'92', name:'Eye Center Lower Depth', faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '93': { id:'93', name:'Eye Center Lower Height',faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '94': { id:'94', name:'Eye Inner Upper Depth',  faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '95': { id:'95', name:'Eye Inner Upper Height', faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '96': { id:'96', name:'Eye Inner Lower Depth',  faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '97': { id:'97', name:'Eye Inner Lower Height', faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '98': { id:'98', name:'Eye Outer Upper Depth',  faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '99': { id:'99', name:'Eye Outer Upper Height', faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '100': { id:'100', name:'Eye Outer Lower Depth', faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '101': { id:'101', name:'Eye Outer Lower Height',faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
  '102': { id:'102', name:'Eye Duct Depth',        faceArea:'Upper', facePart:'EyeOcclusion', faceSection:'EyeOcclusion' },
};

/** Default mix weights (0 = morph only, 1 = bone only) */
export const AU_MIX_DEFAULTS: Record<number, number> = {
  31: 0.7, 32: 0.7, 33: 0.7, 54: 0.7, 55: 0.7, 56: 0.7,  // head
  61: 0.5, 62: 0.5, 63: 0.5, 64: 0.5,  // eyes
  25: 0.5, 26: 0.5, 27: 0.5,  // jaw open (lips part, jaw drop, mouth stretch)
  30: 0.5, 35: 0.5,  // jaw left/right
};

// ============================================================================
// CC4 MESH CLASSIFICATION
// Exact mesh names from CHARACTER_GEOMETRY_REFERENCE.md
// ============================================================================

export type MeshCategory = 'body' | 'eye' | 'eyeOcclusion' | 'tearLine' | 'teeth' | 'tongue' | 'hair' | 'eyebrow' | 'cornea' | 'eyelash';

/** Exact mesh name -> category mapping from the character GLB */
export const CC4_MESHES: Record<string, { category: MeshCategory; morphCount: number }> = {
  // Body (6 meshes, 80 morphs each)
  'CC_Base_Body_1': { category: 'body', morphCount: 80 },
  'CC_Base_Body_2': { category: 'body', morphCount: 80 },
  'CC_Base_Body_3': { category: 'body', morphCount: 80 },
  'CC_Base_Body_4': { category: 'body', morphCount: 80 },
  'CC_Base_Body_5': { category: 'body', morphCount: 80 },
  'CC_Base_Body_6': { category: 'body', morphCount: 80 },
  // Eyes (bone-driven, no morphs)
  'CC_Base_Eye': { category: 'eye', morphCount: 0 },
  'CC_Base_Eye_1': { category: 'eye', morphCount: 0 },
  // Eye occlusion (94 morphs each)
  'CC_Base_EyeOcclusion_1': { category: 'eyeOcclusion', morphCount: 94 },
  'CC_Base_EyeOcclusion_2': { category: 'eyeOcclusion', morphCount: 94 },
  // Tear lines (90 morphs each)
  'CC_Base_TearLine_1': { category: 'tearLine', morphCount: 90 },
  'CC_Base_TearLine_2': { category: 'tearLine', morphCount: 90 },
  // Cornea (no morphs)
  'CC_Base_Cornea': { category: 'cornea', morphCount: 0 },
  'CC_Base_Cornea_1': { category: 'cornea', morphCount: 0 },
  // Teeth (no morphs, follow jaw bone)
  'CC_Base_Teeth_1': { category: 'teeth', morphCount: 0 },
  'CC_Base_Teeth_2': { category: 'teeth', morphCount: 0 },
  // Tongue (23 morphs)
  'CC_Base_Tongue': { category: 'tongue', morphCount: 23 },
  // Eyebrows (91 morphs each)
  'Male_Bushy_1': { category: 'eyebrow', morphCount: 91 },
  'Male_Bushy_2': { category: 'eyebrow', morphCount: 91 },
  // Hair (14 styling morphs each)
  'Side_part_wavy_1': { category: 'hair', morphCount: 14 },
  'Side_part_wavy_2': { category: 'hair', morphCount: 14 },
};

/**
 * Continuum pair mappings - precomputed from COMPOSITE_ROTATIONS
 * Maps AU ID to its continuum partner info for bidirectional axes
 * (e.g., AU 31 "Head Left" is paired with AU 32 "Head Right")
 */
export const CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE';
}> = {
  // Eyes horizontal (yaw) - both eyes share same AUs
  61: { pairId: 62, isNegative: true, axis: 'yaw', node: 'EYE_L' },
  62: { pairId: 61, isNegative: false, axis: 'yaw', node: 'EYE_L' },
  // Eyes vertical (pitch)
  64: { pairId: 63, isNegative: true, axis: 'pitch', node: 'EYE_L' },
  63: { pairId: 64, isNegative: false, axis: 'pitch', node: 'EYE_L' },
  // Head yaw (turn left/right)
  31: { pairId: 32, isNegative: true, axis: 'yaw', node: 'HEAD' },
  32: { pairId: 31, isNegative: false, axis: 'yaw', node: 'HEAD' },
  // Head pitch (up/down)
  54: { pairId: 33, isNegative: true, axis: 'pitch', node: 'HEAD' },
  33: { pairId: 54, isNegative: false, axis: 'pitch', node: 'HEAD' },
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

// ============================================================================
// CC4 MORPH TARGETS
// Complete list of morph targets from jonathan.glb, organized by category.
// Face morphs only need to be applied to CC_Base_Body_1 (the face mesh).
// ============================================================================

export type MorphCategory = 'face' | 'viseme' | 'eyeOcclusion' | 'tearLine' | 'tongue' | 'hair';

/** All morph targets organized by which mesh they apply to */
export const CC4_MORPHS = {
  // Face mesh (CC_Base_Body_1) - 80 morphs
  face: [
    // Brows
    'Brow_Drop_L', 'Brow_Drop_R',
    'Brow_Raise_Inner_L', 'Brow_Raise_Inner_R',
    'Brow_Raise_Outer_L', 'Brow_Raise_Outer_R',
    // Eyes
    'Eye_Blink_L', 'Eye_Blink_R',
    'Eye_L_Look_Down', 'Eye_L_Look_L', 'Eye_L_Look_R', 'Eye_L_Look_Up',
    'Eye_R_Look_Down', 'Eye_R_Look_L', 'Eye_R_Look_R', 'Eye_R_Look_Up',
    'Eye_Squint_L', 'Eye_Squint_R',
    'Eye_Wide_L', 'Eye_Wide_R',
    // Cheeks
    'Cheek_Puff_L', 'Cheek_Puff_R',
    'Cheek_Raise_L', 'Cheek_Raise_R',
    // Nose
    'Nose_Sneer_L', 'Nose_Sneer_R',
    // Jaw
    'Jaw_Forward', 'Jaw_L', 'Jaw_Open', 'Jaw_R',
    // Mouth
    'Mouth_Close',
    'Mouth_Dimple_L', 'Mouth_Dimple_R',
    'Mouth_Down_Lower_L', 'Mouth_Down_Lower_R',
    'Mouth_Frown_L', 'Mouth_Frown_R',
    'Mouth_Funnel',
    'Mouth_L', 'Mouth_R',
    'Mouth_Press_L', 'Mouth_Press_R',
    'Mouth_Pucker',
    'Mouth_Roll_In_Lower', 'Mouth_Roll_In_Upper',
    'Mouth_Shrug_Lower', 'Mouth_Shrug_Upper',
    'Mouth_Smile_L', 'Mouth_Smile_R',
    'Mouth_Stretch_L', 'Mouth_Stretch_R',
    'Mouth_Up_Upper_L', 'Mouth_Up_Upper_R',
    // Head
    'Head_Backward', 'Head_Forward',
    'Head_L', 'Head_R',
    'Head_Tilt_L', 'Head_Tilt_R',
    'Head_Turn_Down', 'Head_Turn_L', 'Head_Turn_R', 'Head_Turn_Up',
  ],

  // Visemes (also on face mesh)
  viseme: [
    'AE', 'Ah', 'B_M_P', 'Ch_J', 'EE', 'Er', 'F_V', 'IH',
    'K_G_H_NG', 'Oh', 'R', 'S_Z', 'TH', 'T_L_D_N', 'W_OO',
  ],

  // Eye Occlusion morphs (CC_Base_EyeOcclusion_1, CC_Base_EyeOcclusion_2)
  eyeOcclusion: [
    'EO Bulge L', 'EO Bulge R',
    'EO Center Lower Depth L', 'EO Center Lower Depth R',
    'EO Center Lower Height L', 'EO Center Lower Height R',
    'EO Center Upper Depth L', 'EO Center Upper Depth R',
    'EO Center Upper Height L', 'EO Center Upper Height R',
    'EO Depth L', 'EO Depth R',
    'EO Duct Depth L', 'EO Duct Depth R',
    'EO Inner Depth L', 'EO Inner Depth R',
    'EO Inner Height L', 'EO Inner Height R',
    'EO Inner Lower Depth L', 'EO Inner Lower Depth R',
    'EO Inner Lower Height L', 'EO Inner Lower Height R',
    'EO Inner Upper Depth L', 'EO Inner Upper Depth R',
    'EO Inner Upper Height L', 'EO Inner Upper Height R',
    'EO Inner Width L', 'EO Inner Width R',
    'EO Lower Depth L', 'EO Lower Depth R',
    'EO Outer Depth L', 'EO Outer Depth R',
    'EO Outer Height L', 'EO Outer Height R',
    'EO Outer Lower Depth L', 'EO Outer Lower Depth R',
    'EO Outer Lower Height L', 'EO Outer Lower Height R',
    'EO Outer Upper Depth L', 'EO Outer Upper Depth R',
    'EO Outer Upper Height L', 'EO Outer Upper Height R',
    'EO Outer Width L', 'EO Outer Width R',
    'EO Upper Depth L', 'EO Upper Depth R',
  ],

  // Tear Line morphs (CC_Base_TearLine_1, CC_Base_TearLine_2)
  tearLine: [
    'TL Center Lower Depth L', 'TL Center Lower Depth R',
    'TL Center Lower Height L', 'TL Center Lower Height R',
    'TL Center Upper Depth L', 'TL Center Upper Depth R',
    'TL Center Upper Height L', 'TL Center Upper Height R',
    'TL Depth L', 'TL Depth R',
    'TL Duct Depth L', 'TL Duct Depth R',
    'TL Inner Depth L', 'TL Inner Depth R',
    'TL Inner Height L', 'TL Inner Height R',
    'TL Inner Lower Depth L', 'TL Inner Lower Depth R',
    'TL Inner Lower Height L', 'TL Inner Lower Height R',
    'TL Inner Upper Depth L', 'TL Inner Upper Depth R',
    'TL Inner Upper Height L', 'TL Inner Upper Height R',
    'TL Inner Width L', 'TL Inner Width R',
    'TL Lower Depth L', 'TL Lower Depth R',
    'TL Outer Depth L', 'TL Outer Depth R',
    'TL Outer Height L', 'TL Outer Height R',
    'TL Outer Lower Depth L', 'TL Outer Lower Depth R',
    'TL Outer Lower Height L', 'TL Outer Lower Height R',
    'TL Outer Upper Depth L', 'TL Outer Upper Depth R',
    'TL Outer Upper Height L', 'TL Outer Upper Height R',
    'TL Outer Width L', 'TL Outer Width R',
    'TL Upper Depth L', 'TL Upper Depth R',
  ],

  // Tongue morphs (CC_Base_Tongue)
  tongue: [
    'Tongue_Bulge_L', 'Tongue_Bulge_R',
    'Tongue_Down', 'Tongue_L', 'Tongue_R', 'Tongue_Up',
    'Tongue_Narrow', 'Tongue_Wide',
    'Tongue_Out', 'Tongue_Roll',
    'Tongue_Tip_Down', 'Tongue_Tip_Up',
  ],

  // Hair morphs (Side_part_wavy_1, Side_part_wavy_2)
  hair: [
    'Fluffy_Bottom_ALL', 'Fluffy_Right',
    'Hairline_High_ALL', 'Hairline_High_M', 'Hairline_High_R',
    'Hairline_Low_ALL', 'Hairline_Low_M', 'Hairline_Low_R',
    'Hairline_Out_All',
    'L_Hair_Front', 'L_Hair_Left', 'L_Hair_Right',
    'Length_Long', 'Length_Short',
  ],
} as const;

/** Which mesh each morph category applies to */
export const MORPH_TO_MESH: Record<MorphCategory, string[]> = {
  // Face/AU morphs affect the main face mesh and both eyebrow meshes.
  face: ['CC_Base_Body_1', 'Male_Bushy_1', 'Male_Bushy_2'],
  viseme: ['CC_Base_Body_1'],
  eyeOcclusion: ['CC_Base_EyeOcclusion_1', 'CC_Base_EyeOcclusion_2'],
  tearLine: ['CC_Base_TearLine_1', 'CC_Base_TearLine_2'],
  tongue: ['CC_Base_Tongue'],
  hair: ['Side_part_wavy_1', 'Side_part_wavy_2'],
};
