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
  25: [],  // Lips Part - BONE ONLY (apply Jaw_Open morph separately if needed)
  26: [],  // Jaw Drop - BONE ONLY (visemes apply their own morphs, then call this for bone rotation)
  27: [],  // Mouth Stretch - BONE ONLY (apply morphs separately)
  28: ['Mouth_Roll_In_Upper','Mouth_Roll_In_Lower'],

  // Tongue
  19: ['Tongue_Out'],
  36: ['Tongue_Bulge_L','Tongue_Bulge_R'],
  37: [],  // Tongue Up - BONE ONLY
  38: [],  // Tongue Down - BONE ONLY
  39: [],  // Tongue Left - BONE ONLY
  40: [],  // Tongue Right - BONE ONLY

  // Jaw / Head (convenience)
  29: ['Jaw_Forward'],
  30: [],  // Jaw Left - BONE ONLY (apply Jaw_L morph separately if needed)
  35: [],  // Jaw Right - BONE ONLY (apply Jaw_R morph separately if needed)
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
};

// Fallback name variants to handle vendor/export naming drift.
export const MORPH_VARIANTS: Record<string, string[]> = {
  'Mouth_Smile_L': ['mouthSmileLeft','MouthSmileLeft','smileLeft','Smile_L'],
  'Mouth_Smile_R': ['mouthSmileRight','MouthSmileRight','smileRight','Smile_R'],

  'Mouth_Frown_L': ['mouthFrownLeft','MouthFrownLeft','frownLeft'],
  'Mouth_Frown_R': ['mouthFrownRight','MouthFrownRight','frownRight'],

  'Mouth_Press_L': ['mouthPressLeft','MouthPressLeft','Mouth_Tightener_L','lipTightenerLeft'],
  'Mouth_Press_R': ['mouthPressRight','MouthPressRight','Mouth_Tightener_R','lipTightenerRight'],

  'Mouth_Funnel':  ['mouthFunnel','MouthFunneler','LipFunnel','funnel'],
  'Mouth_Pucker':  ['mouthPucker','LipPucker','pucker'],

  'Mouth_Roll_In_Upper': ['mouthRollInUpper','LipRollInUpper'],
  'Mouth_Roll_In_Lower': ['mouthRollInLower','LipRollInLower'],

  'Mouth_Up_Upper_L': ['upperLipUpLeft','UpperLipRaiseLeft'],
  'Mouth_Up_Upper_R': ['upperLipUpRight','UpperLipRaiseRight'],
  'Mouth_Down_Lower_L': ['lowerLipDownLeft','LowerLipDepressLeft'],
  'Mouth_Down_Lower_R': ['lowerLipDownRight','LowerLipDepressRight'],

  'Mouth_Stretch_L': ['mouthStretchLeft','LipStretcherLeft'],
  'Mouth_Stretch_R': ['mouthStretchRight','LipStretcherRight'],

  'Eye_Blink_L': ['eyeBlinkLeft','blinkLeft','Blink_L','BLINK_L','leftBlink'],
  'Eye_Blink_R': ['eyeBlinkRight','blinkRight','Blink_R','BLINK_R','rightBlink'],
  'Eye_Squint_L': ['eyeSquintLeft','squintLeft','Squint_L'],
  'Eye_Squint_R': ['eyeSquintRight','squintRight','Squint_R'],
  'Eye_Wide_L':   ['eyeWideLeft','eyesWideLeft','Wide_L'],
  'Eye_Wide_R':   ['eyeWideRight','eyesWideRight','Wide_R'],

  'Eye_L_Look_L':   ['eyeLeftLookLeft','eyesLeftLookLeft','EyeLeftLookLeft','LeftEyeLookLeft'],
  'Eye_L_Look_R':   ['eyeLeftLookRight','eyesLeftLookRight','EyeLeftLookRight','LeftEyeLookRight'],
  'Eye_L_Look_Up':  ['eyeLeftLookUp','eyesLeftLookUp','EyeLeftLookUp','LeftEyeLookUp'],
  'Eye_L_Look_Down':['eyeLeftLookDown','eyesLeftLookDown','EyeLeftLookDown','LeftEyeLookDown'],
  'Eye_R_Look_L':   ['eyeRightLookLeft','eyesRightLookLeft','EyeRightLookLeft','RightEyeLookLeft'],
  'Eye_R_Look_R':   ['eyeRightLookRight','eyesRightLookRight','EyeRightLookRight','RightEyeLookRight'],
  'Eye_R_Look_Up':  ['eyeRightLookUp','eyesRightLookUp','EyeRightLookUp','RightEyeLookUp'],
  'Eye_R_Look_Down':['eyeRightLookDown','eyesRightLookDown','EyeRightLookDown','RightEyeLookDown'],

  'Brow_Raise_Inner_L': ['innerBrowRaiseLeft','browRaiseInnerLeft'],
  'Brow_Raise_Inner_R': ['innerBrowRaiseRight','browRaiseInnerRight'],
  'Brow_Raise_Outer_L': ['outerBrowRaiseLeft','browRaiseOuterLeft'],
  'Brow_Raise_Outer_R': ['outerBrowRaiseRight','browRaiseOuterRight'],
  'Brow_Drop_L':        ['browLowerLeft','corrugatorLeft'],
  'Brow_Drop_R':        ['browLowerRight','corrugatorRight'],

  'Nose_Sneer_L': ['noseSneerLeft','sneerLeft'],
  'Nose_Sneer_R': ['noseSneerRight','sneerRight'],
  'Cheek_Puff_L': ['cheekPuffLeft','puffLeft'],
  'Cheek_Puff_R': ['cheekPuffRight','puffRight'],

  'Jaw_Open':    ['jawOpen','Mouth_Open','JawOpen','jaw_open'],
  'Mouth_Close': ['mouthClose','MouthClose','mouth_close'],
  'Jaw_Forward': ['jawForward','jawThrust','JawForward'],
  'Jaw_L':       ['jawLeft','jawSideLeft','JawLeft'],
  'Jaw_R':       ['jawRight','jawSideRight','JawRight'],

  'Tongue_Out':  ['tongueOut','tongueShow'],
  'Tongue_Bulge_L': ['tongueBulgeLeft'],
  'Tongue_Bulge_R': ['tongueBulgeRight'],

  'Head_Turn_L':   ['headTurnLeft'],
  'Head_Turn_R':   ['headTurnRight'],
  'Head_Turn_Up':  ['headUp'],
  'Head_Turn_Down':['headDown'],
};

// Back-compat for older code paths
export const ALIASES: Record<string, string[]> = MORPH_VARIANTS;

export const VISEME_KEYS: string[] = [
  'EE','Er','IH','Ah','Oh','W_OO','S_Z','Ch_J','F_V','TH','T_L_D_N','B_M_P','K_G_H_NG','AE','R'
];

// Useful direct-control morph key sets
export const EYELID_KEYS: string[] = [
  'Eye_Blink_L','Eye_Blink_R','Eye_Squint_L','Eye_Squint_R','Eye_Wide_L','Eye_Wide_R'
];

export const EYE_LOOK_KEYS: string[] = [
  'Eye_L_Look_L','Eye_L_Look_R','Eye_L_Look_Up','Eye_L_Look_Down',
  'Eye_R_Look_L','Eye_R_Look_R','Eye_R_Look_Up','Eye_R_Look_Down'
];

/** Individual-eye combined axes */
export const EYE_L_COMBINED_AXES = {
  horizontal: { left: 65, right: 66 },
  vertical:   { up: 67,  down: 68 },
};
export const EYE_R_COMBINED_AXES = {
  horizontal: { left: 69, right: 70 },
  vertical:   { up: 71,  down: 72 },
};

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
  31: [
    { node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 },  // Head turn left
  ],
  32: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },   // Head turn right
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
  61: [
    { node: 'EYE_L', channel: 'ry', scale: -1, maxDegrees: 25 },
    { node: 'EYE_R', channel: 'ry', scale: -1, maxDegrees: 25 },
  ],
  62: [
    { node: 'EYE_L', channel: 'ry', scale: 1, maxDegrees: 25 },
    { node: 'EYE_R', channel: 'ry', scale: 1, maxDegrees: 25 },
  ],
  63: [
    { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 20 },
    { node: 'EYE_R', channel: 'rx', scale: -1, maxDegrees: 20 },
  ],
  64: [
    { node: 'EYE_L', channel: 'rx', scale: 1, maxDegrees: 20 },
    { node: 'EYE_R', channel: 'rx', scale: 1, maxDegrees: 20 },
  ],
  // Single-eye (Left) — horizontal (ry) and vertical (rx)
  65: [ { node: 'EYE_L', channel: 'ry', scale: -1, maxDegrees: 15 } ],
  66: [ { node: 'EYE_L', channel: 'ry', scale:  1, maxDegrees: 15 } ],
  67: [ { node: 'EYE_L', channel: 'rx', scale: -1, maxDegrees: 12 } ],
  68: [ { node: 'EYE_L', channel: 'rx', scale:  1, maxDegrees: 12 } ],
  // Single-eye (Right)
  69: [ { node: 'EYE_R', channel: 'ry', scale: -1, maxDegrees: 15 } ],
  70: [ { node: 'EYE_R', channel: 'ry', scale:  1, maxDegrees: 15 } ],
  71: [ { node: 'EYE_R', channel: 'rx', scale: -1, maxDegrees: 12 } ],
  72: [ { node: 'EYE_R', channel: 'rx', scale:  1, maxDegrees: 12 } ],

  // Jaw
  25: [ // Lips Part — small jaw open
    { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 5.84 },  // 73% of 8
  ],
  26: [
    { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 14.6 },  // 73% of 20
  ],
  27: [ // Mouth Stretch — larger jaw open
    { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 18.25 }, // 73% of 25
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
    { node: 'TONGUE', channel: 'rx', scale: -1, maxDegrees: 15 },
  ],
  38: [ // Tongue Down
    { node: 'TONGUE', channel: 'rx', scale: 1, maxDegrees: 15 },
  ],
  39: [ // Tongue Left
    { node: 'TONGUE', channel: 'ry', scale: -1, maxDegrees: 10 },
  ],
  40: [ // Tongue Right
    { node: 'TONGUE', channel: 'ry', scale: 1, maxDegrees: 10 },
  ],
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
    yaw: { aus: [61, 62], axis: 'ry', negative: 61, positive: 62 },    // Eyes left/right
    roll: null  // Eyes don't have roll
  },
  {
    node: 'EYE_R',
    pitch: { aus: [64, 63], axis: 'rx', negative: 64, positive: 63 },  // Eyes down/up
    yaw: { aus: [61, 62], axis: 'ry', negative: 61, positive: 62 },    // Eyes left/right
    roll: null  // Eyes don't have roll
  },
  {
    node: 'TONGUE',
    pitch: { aus: [38, 37], axis: 'rx', negative: 38, positive: 37 },  // Tongue down/up
    yaw: { aus: [39, 40], axis: 'ry', negative: 39, positive: 40 },    // Tongue left/right
    roll: null  // Tongue doesn't have roll
  }
];

/**
 * Map AU ID to which composite rotation it belongs to, and which axis.
 * This allows quick lookup when setAU is called.
 */
export const AU_TO_COMPOSITE_MAP = new Map<number, {
  nodes: ('JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE')[];
  axis: 'pitch' | 'yaw' | 'roll';
}>();

// Build the reverse mapping
COMPOSITE_ROTATIONS.forEach(comp => {
  (['pitch', 'yaw', 'roll'] as const).forEach(axisName => {
    const axis = comp[axisName];
    if (axis) {
      axis.aus.forEach(auId => {
        const existing = AU_TO_COMPOSITE_MAP.get(auId);
        if (existing) {
          existing.nodes.push(comp.node);
        } else {
          AU_TO_COMPOSITE_MAP.set(auId, { nodes: [comp.node], axis: axisName });
        }
      });
    }
  });
});

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
  facePart?: 'Forehead' | 'Brow' | 'Eyelids' | 'Eyes' | 'Nose' | 'Cheeks' | 'Mouth' | 'Chin' | 'Jaw' | 'Head' | 'Tongue' | 'Other';
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
};

// --- Engine metadata helpers ---

/**
 * Defines which AU ids are bone-driven rather than morph-only.
 * This informs the engine to apply rotations/translations via skeleton bones.
 */
export const BONE_DRIVEN_AUS = new Set([
  31, 32, 33, 54, 55, 56, // head turn/tilt (left, right, up, down, tilt left, tilt right)
  61, 62, 63, 64, // eyes (left, right, up, down)
  25, 26, 27, 29, 30, 35, // jaw (lips part, jaw drop, mouth stretch, jaw forward, jaw left, jaw right)
  19, 37, 38, 39, 40 // tongue (show, up, down, left, right)
]);

/**
 * Axis configuration for CC-based rigs.
 * Adjusts which local rotation axis drives yaw/pitch of the eyes.
 */
export const EYE_AXIS = {
  yaw: 'rz' as 'ry' | 'rz',   // use 'rz' for CC rigs where eyeballs rotate around Z
  pitch: 'rx' as 'rx' | 'ry' | 'rz'
};

/**
 * Combined AUs for continuous bidirectional eye control.
 */
export const EYE_COMBINED_AXES = {
  horizontal: { left: 61, right: 62 },
  vertical: { up: 63, down: 64 },
};

/**
 * Combined AUs for continuous bidirectional head control.
 */
export const HEAD_COMBINED_AXES = {
  horizontal: { left: 31, right: 32 },
  vertical: { up: 33, down: 54 },
};

/**
 * Head roll (tilt) — single continuum mapping (Left↔Right tilt).
 */
export const HEAD_TILT_AXIS = { left: 55, right: 56 };

/**
 * Jaw horizontal — single continuum mapping (Left↔Right).
 */
export const JAW_HORIZONTAL_AXIS = { left: 30, right: 35 };

/**
 * Tongue combined axes for continuous bidirectional control.
 */
export const TONGUE_COMBINED_AXES = {
  horizontal: { left: 39, right: 40 },
  vertical: { down: 38, up: 37 },
};

/**
 * All continuum pairs for bidirectional sliders.
 * Each pair specifies the negative (left/down) and positive (right/up) AU IDs.
 */
export const CONTINUUM_PAIRS: Array<{ negative: number; positive: number; showBlend: boolean }> = [
  // Eyes
  { negative: 61, positive: 62, showBlend: true },  // Eyes Left ↔ Right
  { negative: 64, positive: 63, showBlend: true },  // Eyes Down ↔ Up

  // Head
  { negative: 31, positive: 32, showBlend: true },  // Head Turn Left ↔ Right
  { negative: 54, positive: 33, showBlend: true },  // Head Down ↔ Up
  { negative: 55, positive: 56, showBlend: true },  // Head Tilt Left ↔ Right

  // Jaw
  { negative: 30, positive: 35, showBlend: true },  // Jaw Left ↔ Right

  // Tongue
  { negative: 38, positive: 37, showBlend: true },  // Tongue Down ↔ Up
  { negative: 39, positive: 40, showBlend: true },  // Tongue Left ↔ Right
];

/**
 * Set of all AU IDs that are part of continuum pairs.
 * Used to filter them out from individual AU sliders.
 */
export const CONTINUUM_AU_IDS = new Set(
  CONTINUUM_PAIRS.flatMap(pair => [pair.negative, pair.positive])
);

/**
 * Which AUs have both morphs and bones (so they can blend between them).
 * Now includes all head turn/tilt AUs so they appear with ratio sliders in the UI.
 */
export const MIXED_AUS = new Set([31, 32, 33, 54, 55, 56, 61, 62, 63, 64, 26]);

/**
 * Automatically computed mixed AUs — any AU that has both morphs and bone bindings.
 */
export const AUTO_MIXED_AUS = new Set(
  Object.keys(AU_TO_MORPHS)
    .map(Number)
    .filter((id) => AU_TO_MORPHS[id]?.length && BONE_AU_TO_BINDINGS[id]?.length)
);

/**
 * Default mix weights (0 = morph only, 1 = bone only)
 */
export const AU_MIX_DEFAULTS: Record<number, number> = {
  31: 0.7,
  32: 0.7,
  33: 0.7,
  54: 0.7,
  61: 0.5,
  62: 0.5,
  63: 0.5,
  64: 0.5,
  26: 0.8,
};

/**
 * Hair and Eyebrow Object Detection Patterns
 *
 * Patterns used to automatically detect and classify hair/eyebrow objects in loaded 3D models.
 * All pattern matching is case-insensitive.
 */

/**
 * Patterns that identify eyebrow objects
 */
export const EYEBROW_PATTERNS = [
  'eyebrow',
  'brow',
  'male_bushy',
] as const;

/**
 * Exact name matches for eyebrow objects
 */
export const EYEBROW_EXACT_MATCHES = [
  'male_bushy',
] as const;

/**
 * Patterns that identify hair objects (excluding eyebrows)
 */
export const HAIR_PATTERNS = [
  'hair',
  'bushy',      // Only if not already classified as eyebrow
  'side_part',
  'sidepart',
] as const;

/**
 * Exact name matches for hair objects
 */
export const HAIR_EXACT_MATCHES = [
  'side_part_wavy',
] as const;

/**
 * Hair Object Type Definitions
 * Maps common hair object names to their type (hair or eyebrow)
 */
export type HairObjectType = 'hair' | 'eyebrow';

export const HAIR_OBJECT_REGISTRY: Record<string, HairObjectType> = {
  // Common hair object names from Character Creator
  'CC_Base_Hair': 'hair',
  'Hair': 'hair',
  'Ponytail': 'hair',
  'Braid': 'hair',
  'Bangs': 'hair',
  'Sideburns': 'hair',
  'Male_Bushy': 'eyebrow',
  'Side_part_wavy': 'hair',

  // Eyebrow variations
  'Eyebrow_L': 'eyebrow',
  'Eyebrow_R': 'eyebrow',
  'Brow_L': 'eyebrow',
  'Brow_R': 'eyebrow',
  'LeftEyebrow': 'eyebrow',
  'RightEyebrow': 'eyebrow',
} as const;

/**
 * Helper function to check if an AU has separate left/right morphs
 * @param auId - The AU ID to check
 * @returns true if the AU has both _L and _R morph variants
 */
export function hasLeftRightMorphs(auId: number): boolean {
  const morphs = AU_TO_MORPHS[auId] || [];
  const hasLeft = morphs.some(k => /_L$|Left$/.test(k));
  const hasRight = morphs.some(k => /_R$|Right$/.test(k));
  return hasLeft && hasRight;
}

/**
 * Helper function to determine if an object is hair or eyebrow
 * Uses patterns and exact matches defined above
 */
export function classifyHairObject(name: string): HairObjectType | null {
  const nameLower = name.toLowerCase();

  // Check exact registry first (case-insensitive)
  for (const [key, type] of Object.entries(HAIR_OBJECT_REGISTRY)) {
    if (key.toLowerCase() === nameLower) {
      return type;
    }
  }

  // Check eyebrow patterns
  for (const pattern of EYEBROW_PATTERNS) {
    if (nameLower.includes(pattern.toLowerCase())) {
      return 'eyebrow';
    }
  }

  // Check eyebrow exact matches
  for (const exact of EYEBROW_EXACT_MATCHES) {
    if (nameLower === exact.toLowerCase()) {
      return 'eyebrow';
    }
  }

  // Check hair patterns
  for (const pattern of HAIR_PATTERNS) {
    if (nameLower.includes(pattern.toLowerCase())) {
      return 'hair';
    }
  }

  // Check hair exact matches
  for (const exact of HAIR_EXACT_MATCHES) {
    if (nameLower === exact.toLowerCase()) {
      return 'hair';
    }
  }

  return null;
}
