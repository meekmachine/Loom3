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
 * Single annotation region definition - maps a name to geometry targets.
 */
export interface AnnotationRegion {
  /** Display name for the annotation */
  name: string;
  /** Bone names to focus on */
  bones?: string[];
  /** Mesh object names to focus on */
  meshes?: string[];
  /** Any object names (bones or meshes). Use ['*'] for all objects */
  objects?: string[];
  /**
   * Camera framing multiplier for this annotation.
   * Smaller values zoom in tighter; larger values leave more space around the target.
   */
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

export type Region = AnnotationRegion;

/**
 * Marker style for annotation visualization
 * - 'html': Simple HTML overlay markers with numbered dots directly over targets
 * - '3d': 3D markers with lines and labels rendered in scene space
 */
export type MarkerStyle = 'html' | '3d';
