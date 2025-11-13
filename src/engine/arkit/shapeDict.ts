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
  25: ['Jaw_Open','Mouth_Close'],
  26: ['Jaw_Open'],
  27: ['Jaw_Open'],
  28: ['Mouth_Roll_In_Upper','Mouth_Roll_In_Lower'],

  // Tongue
  19: ['Tongue_Out'],
  36: ['Tongue_Bulge_L','Tongue_Bulge_R'],

  // Jaw / Head (convenience)
  29: ['Jaw_Forward'],
  30: ['Jaw_L','Jaw_R'],
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
    { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 8 },
  ],
  26: [
    { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 20 },
  ],
  27: [ // Mouth Stretch — larger jaw open
    { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 25 },
  ],
  29: [
    { node: 'JAW', channel: 'tz', scale: 1, maxUnits: 0.01 },
  ],
  30: [
    { node: 'JAW', channel: 'tx', scale: 1, maxUnits: 0.006 },
  ],

  // Tongue
  19: [
    { node: 'TONGUE', channel: 'tz', scale: 1, maxUnits: 0.008 },
  ],
};

// Candidate node names to resolve placeholders per-side on common CC/GLB exports.
export const EYE_BONE_CANDIDATES_LEFT:  string[] = [
  'Eye_L','LeftEye','CC_Base_Eye_L','CC_Base_L_Eye','L_Eye','EyeLeft','LeftEyeBall'
];
export const EYE_BONE_CANDIDATES_RIGHT: string[] = [
  'Eye_R','RightEye','CC_Base_Eye_R','CC_Base_R_Eye','R_Eye','EyeRight','RightEyeBall'
];

export const HEAD_BONE_CANDIDATES:  string[] = ['Head','CC_Base_Head','Head_001','HeadBone','HeadCtrl'];
export const NECK_BONE_CANDIDATES:  string[] = ['Neck','CC_Base_Neck','Neck1','Neck_01','NeckTwist','CC_Base_NeckTwist01','CC_Base_NeckTwist02'];
export const JAW_BONE_CANDIDATES:   string[] = ['Jaw','CC_Base_Jaw','Mandible','LowerJaw','JawRoot','CC_Base_JawRoot','CC_Base_UpperJaw'];
export const TONGUE_BONE_CANDIDATES:string[] = ['Tongue','CC_Base_Tongue','Tongue_Base','Tongue01','Tongue_Tip'];

// For rigs that expose eyes/head as meshes (not bones)
export const EYE_MESH_CANDIDATES_LEFT:  string[] = ['CC_Base_Eye','CC_Base_Eye_L','L_EyeMesh'];
export const EYE_MESH_CANDIDATES_RIGHT: string[] = ['CC_Base_Eye_1','CC_Base_Eye_R','R_EyeMesh'];
export const HEAD_CTRL_CANDIDATES:      string[] = ['Head','CC_Base_Head','HeadCtrl','HeadNode'];

// --- Metadata (subset) ---

export interface AUInfo {
  id: string;
  name: string;
  muscularBasis?: string;
  links?: string[];
  faceArea?: 'Upper' | 'Lower'; // macro region
  facePart?: 'Forehead' | 'Brow' | 'Eyelids' | 'Eyes' | 'Nose' | 'Cheeks' | 'Mouth' | 'Chin' | 'Jaw' | 'Head' | 'Tongue' | 'Other';
  faceSection?: string; // back-compat (mirror of facePart)
  /** If this AU is part of a bidirectional continuum, specify the opposite AU ID */
  continuumPair?: string;
  /** Direction in the continuum: 'negative' or 'positive' */
  continuumDirection?: 'negative' | 'positive';
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
  '61': { id:'61', name:'Eyes Turn Left',    faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes', continuumPair:'62', continuumDirection:'negative' },
  '62': { id:'62', name:'Eyes Turn Right',   faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes', continuumPair:'61', continuumDirection:'positive' },
  '63': { id:'63', name:'Eyes Up',           faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes', continuumPair:'64', continuumDirection:'positive' },
  '64': { id:'64', name:'Eyes Down',         faceArea:'Upper', facePart:'Eyes', faceSection:'Eyes', continuumPair:'63', continuumDirection:'negative' },

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

  // Jaw (Lower)
  '26': { id:'26', name:'Jaw Drop',          muscularBasis:'masseter (relax temporalis)', links:['https://en.wikipedia.org/wiki/Masseter_muscle'], faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },
  '29': { id:'29', name:'Jaw Thrust',        faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },
  '30': { id:'30', name:'Jaw Sideways',      faceArea:'Lower', facePart:'Jaw', faceSection:'Jaw' },

  // Head (Upper, convenience)
  '31': { id:'31', name:'Head Turn Left',    faceArea:'Upper', facePart:'Head', faceSection:'Head', continuumPair:'32', continuumDirection:'negative' },
  '32': { id:'32', name:'Head Turn Right',   faceArea:'Upper', facePart:'Head', faceSection:'Head', continuumPair:'31', continuumDirection:'positive' },
  '33': { id:'33', name:'Head Up',           faceArea:'Upper', facePart:'Head', faceSection:'Head', continuumPair:'54', continuumDirection:'positive' },
  '54': { id:'54', name:'Head Down',         faceArea:'Upper', facePart:'Head', faceSection:'Head', continuumPair:'33', continuumDirection:'negative' },
  '55': { id:'55', name:'Head Tilt Left',    faceArea:'Upper', facePart:'Head', faceSection:'Head', continuumPair:'56', continuumDirection:'negative' },
  '56': { id:'56', name:'Head Tilt Right',   faceArea:'Upper', facePart:'Head', faceSection:'Head', continuumPair:'55', continuumDirection:'positive' },
};

// --- Engine metadata helpers ---

/**
 * Defines which AU ids are bone-driven rather than morph-only.
 * This informs the engine to apply rotations/translations via skeleton bones.
 */
export const BONE_DRIVEN_AUS = new Set([
  31, 32, 33, 54, 55, 56, // head turn/tilt (left, right, up, down, tilt left, tilt right)
  61, 62, 63, 64, // eyes (left, right, up, down)
  25, 26, 27, 29, 30 // jaw (lips part, jaw drop, mouth stretch, jaw forward, jaw sideways)
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