import type { Profile } from '../mappings/types';
import type { PresetType } from '../presets';

// ============ LINE STYLING ============

/** Line stroke style */
export type LineStyle = 'solid' | 'dashed' | 'dotted';

/** Line curve type */
export type LineCurve = 'straight' | 'bezier' | 'arc';

/** Named direction presets for line orientation */
export type NamedDirection = 'radial' | 'camera' | 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward';

/** Line configuration for markers */
export interface LineConfig {
  /** Stroke style. Default: 'solid' */
  style?: LineStyle;
  /** Curve type. Default: 'straight' */
  curve?: LineCurve;
  /** Show arrow head at end. Default: false */
  arrowHead?: boolean;
  /** Line thickness (affects dash size). Default: 2 */
  thickness?: number;
  /** Line length override (model units) */
  length?: number;
}

// ============ PER-MARKER STYLE OVERRIDES ============

/** Style overrides that can be applied per-region */
export interface MarkerStyleOverrides {
  /** Override marker sphere color (hex) */
  markerColor?: number;
  /** Override marker sphere radius (model units) */
  markerRadius?: number;
  /** Override line color (hex) */
  lineColor?: number;
  /** Override label text color (CSS) */
  labelColor?: string;
  /** Override label background (CSS) */
  labelBackground?: string;
  /** Override label font size (pixels) */
  labelFontSize?: number;
  /** Override overall marker opacity (0-1) */
  opacity?: number;
  /** Custom line direction: named preset or explicit vector */
  lineDirection?: NamedDirection | { x: number; y: number; z: number };
  /** Line styling options */
  line?: LineConfig;
}

// ============ EXPANDING ANCHORS ============

/** Animation style for expanding/collapsing child markers */
export type ExpandAnimation = 'outward' | 'staggered';

/** Expanded region state */
export interface ExpandedRegionState {
  regionName: string;
  isExpanded: boolean;
  children: string[];
}

// ============ FALLBACK MARKERS ============

/** Fallback behavior configuration */
export interface FallbackConfig {
  /** Name of the fallback marker to show when all group markers are occluded */
  fallbackMarker?: string;
  /** Behavior when clicking fallback: 'fit-all' tries to fit all in frame, 'rotate' rotates camera */
  clickBehavior?: 'fit-all' | 'rotate';
}

/** Marker group for fallback behavior */
export interface MarkerGroup {
  /** Unique group identifier */
  groupId: string;
  /** Region names in this group */
  regions: string[];
  /** Fallback configuration */
  fallback?: FallbackConfig;
}

// ============ REGION DEFINITION ============

/**
 * Single region definition - maps a name to geometry targets
 */
export interface Region {
  /** Display name for the annotation */
  name: string;
  /** Bone names to focus on */
  bones?: string[];
  /** Mesh object names to focus on */
  meshes?: string[];
  /** Any object names (bones or meshes). Use ['*'] for all objects */
  objects?: string[];
  /** Override default padding factor for this annotation */
  paddingFactor?: number;
  /**
   * Camera angle in degrees around the Y axis (horizontal orbit).
   * 0 = front (default), 90 = right side, 180 = back, 270 = left side
   */
  cameraAngle?: number;
  /** Fine-tune camera position offset */
  cameraOffset?: {
    x?: number;
    y?: number;
    z?: number;
  };

  // === EXPANDING ANCHORS ===
  /** Parent region name - children animate outward from parent when expanded */
  parent?: string;
  /** Child region names - shown when this region is expanded */
  children?: string[];
  /** Animation style for expand/collapse. Default: 'outward' */
  expandAnimation?: ExpandAnimation;
  /** Show connecting lines to children when expanded. Default: true */
  showChildConnections?: boolean;

  // === STYLE OVERRIDES ===
  /** Per-marker style overrides */
  style?: MarkerStyleOverrides;

  // === FALLBACK GROUPS ===
  /** Marker group ID for fallback behavior */
  groupId?: string;
  /** If true, this marker acts as a fallback for its group */
  isFallback?: boolean;

  // === CUSTOM POSITION ===
  /** Custom position override (user-adjusted). If set, overrides calculated position. */
  customPosition?: { x: number; y: number; z: number };
}

/**
 * Marker style for annotation visualization
 * - 'html': Simple HTML overlay markers with numbered dots directly over targets
 * - '3d': 3D markers with lines and labels rendered in scene space
 */
export type MarkerStyle = 'html' | '3d';

/**
 * Per-character configuration for camera + animation
 */
export interface CharacterConfig {
  /** Unique identifier for the character */
  characterId: string;
  /** Display name */
  characterName: string;
  /** Path to GLB file (relative to public folder) */
  modelPath: string;
  /** Which region to focus on load */
  defaultRegion?: string;
  /** List of available regions */
  regions: Region[];
  /** Marker visualization style. Default: '3d' */
  markerStyle?: MarkerStyle;
  /** Play intro animation on load (orbit around model, then zoom to torso). Default: false */
  playIntroOnLoad?: boolean;
  /** Model position offset to apply on load (e.g., to raise fish above ground) */
  modelOffset?: { x?: number; y?: number; z?: number };
  /** Model rotation in degrees to apply on load (e.g., to fix models exported with wrong orientation) */
  modelRotation?: { x?: number; y?: number; z?: number };
  /** Ensure model's lowest point clears the ground by this amount (world units) */
  modelGroundClearance?: number;
  /** Preset type for animation mapping. Default: 'cc4' */
  auPresetType?: PresetType;
  /** Optional: profile overrides applied on top of the preset */
  profile?: Partial<Profile>;

  // === BONE RESOLUTION ===
  /** Prefix to prepend to bone names (e.g., 'Bone.' for fish) */
  bonePrefix?: string;
  /** Suffix to append to bone names (e.g., '_Armature' for fish) */
  boneSuffix?: string;
  /** Semantic bone name mapping (e.g., 'HEAD' → '001') */
  boneNodes?: Record<string, string>;

  // === MARKER CUSTOMIZATION ===
  /** Marker groups for fallback behavior */
  markerGroups?: MarkerGroup[];
  /** Global line styling defaults */
  lineDefaults?: LineConfig;
  /** Global marker style defaults (overridden by per-region style) */
  markerDefaults?: Partial<MarkerStyleOverrides>;
}

/**
 * Registry of all available characters
 */
export interface CharacterRegistry {
  characters: CharacterConfig[];
  defaultCharacter?: string;
}
