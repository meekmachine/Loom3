/**
 * Hair Customization Types
 *
 * Defines the data structures for character hair and eyebrow customization.
 * Part of the latticework agency architecture.
 */

import * as THREE from 'three';

/**
 * Hair/Eyebrow color configuration
 */
export type HairColor = {
  name: string;
  baseColor: string;           // Hex color for base hair color
  emissive: string;            // Emissive glow color
  emissiveIntensity: number;   // Glow intensity (0-1)
};

/**
 * Pre-defined hair color presets
 */
export const HAIR_COLOR_PRESETS: Record<string, HairColor> = {
  natural_black: {
    name: 'Natural Black',
    baseColor: '#1a1a1a',
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  natural_brown: {
    name: 'Natural Brown',
    baseColor: '#4a3728',
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  natural_blonde: {
    name: 'Natural Blonde',
    baseColor: '#e6c78a',
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  natural_red: {
    name: 'Natural Red',
    baseColor: '#8b3a3a',
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  natural_gray: {
    name: 'Natural Gray',
    baseColor: '#9e9e9e',
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  natural_white: {
    name: 'Natural White',
    baseColor: '#f5f5f5',
    emissive: '#000000',
    emissiveIntensity: 0,
  },
  // Fun colors with emissive glow
  neon_blue: {
    name: 'Neon Blue',
    baseColor: '#00ffff',
    emissive: '#0000ff',
    emissiveIntensity: 0.8,
  },
  neon_pink: {
    name: 'Neon Pink',
    baseColor: '#ff00ff',
    emissive: '#ff1493',
    emissiveIntensity: 0.8,
  },
  neon_green: {
    name: 'Neon Green',
    baseColor: '#00ff00',
    emissive: '#00ff00',
    emissiveIntensity: 0.8,
  },
  electric_purple: {
    name: 'Electric Purple',
    baseColor: '#9d00ff',
    emissive: '#9d00ff',
    emissiveIntensity: 0.6,
  },
  fire_orange: {
    name: 'Fire Orange',
    baseColor: '#ff6600',
    emissive: '#ff3300',
    emissiveIntensity: 0.7,
  },
};

/**
 * Hair style configuration
 */
export type HairStyle = {
  name: string;
  visible: boolean;       // Is this hair style visible?
  scale?: number;         // Scale multiplier (1.0 = normal)
  position?: [number, number, number]; // Position offset [x, y, z]
};

/**
 * Complete hair state
 */
export type HairState = {
  hairColor: HairColor;        // Color for hair parts
  eyebrowColor: HairColor;     // Color for eyebrow parts
  showOutline: boolean;
  outlineColor: string;
  outlineOpacity: number;

  // Individual hair/eyebrow parts
  parts: {
    [key: string]: HairStyle; // key = object name (e.g., "Male_Bushy")
  };
};

/**
 * Default hair state
 */
export const DEFAULT_HAIR_STATE: HairState = {
  hairColor: HAIR_COLOR_PRESETS.natural_brown,
  eyebrowColor: HAIR_COLOR_PRESETS.natural_brown,
  showOutline: false,
  outlineColor: '#00ff00',
  outlineOpacity: 1.0,
  parts: {},
};

/**
 * Hair object reference (Three.js objects)
 */
export type HairObjectRef = {
  name: string;
  object: THREE.Object3D;
  mesh?: THREE.Mesh;
  originalMaterial?: THREE.Material | THREE.Material[];
  wireframe?: THREE.LineSegments;
  isEyebrow: boolean;  // true if this is an eyebrow, false if hair
};

/**
 * Events that can be sent to the hair machine
 */
export type HairEvent =
  | { type: 'SET_HAIR_COLOR'; color: HairColor }
  | { type: 'SET_EYEBROW_COLOR'; color: HairColor }
  | { type: 'SET_HAIR_BASE_COLOR'; baseColor: string }
  | { type: 'SET_EYEBROW_BASE_COLOR'; baseColor: string }
  | { type: 'SET_HAIR_GLOW'; emissive: string; intensity: number }
  | { type: 'SET_EYEBROW_GLOW'; emissive: string; intensity: number }
  | { type: 'SET_OUTLINE'; show: boolean; color?: string; opacity?: number }
  | { type: 'SET_PART_VISIBILITY'; partName: string; visible: boolean }
  | { type: 'SET_PART_SCALE'; partName: string; scale: number }
  | { type: 'SET_PART_POSITION'; partName: string; position: [number, number, number] }
  | { type: 'RESET_TO_DEFAULT' };

/**
 * Context for the hair state machine
 */
export type HairContext = {
  state: HairState;
  objects: HairObjectRef[];
};
