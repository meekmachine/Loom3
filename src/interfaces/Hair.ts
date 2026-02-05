/**
 * Hair Interface
 *
 * Groups hair registration, styling, and physics methods.
 */

import type { Mesh, Object3D } from 'three';

export interface HairObjectRef {
  name: string;
  isMesh: boolean;
  isEyebrow: boolean;
}

export interface HairPhysicsDirectionConfig {
  yawSign: 1 | -1;
  pitchSign: 1 | -1;
}

export interface HairMorphTargetsConfig {
  swayLeft: string;
  swayRight: string;
  swayFront: string;
  fluffRight: string;
  fluffBottom: string;
  headUp: Record<string, number>;
  headDown: Record<string, number>;
}

export interface HairPhysicsRuntimeConfig {
  stiffness: number;
  damping: number;
  inertia: number;
  gravity: number;
  responseScale: number;
  idleSwayAmount: number;
  idleSwaySpeed: number;
  windStrength: number;
  windDirectionX: number;
  windDirectionZ: number;
  windTurbulence: number;
  windFrequency: number;
  idleClipDuration: number;
  impulseClipDuration: number;
  direction: HairPhysicsDirectionConfig;
  morphTargets: HairMorphTargetsConfig;
}

export type HairPhysicsRuntimeConfigUpdate = Partial<HairPhysicsRuntimeConfig> & {
  direction?: Partial<HairPhysicsDirectionConfig>;
  morphTargets?: Partial<HairMorphTargetsConfig>;
};

export interface HairObjectState {
  color?: { baseColor: string; emissive: string; emissiveIntensity: number };
  outline?: { show: boolean; color: string; opacity: number };
  visible?: boolean;
  scale?: { x: number; y: number; z: number };
  position?: { x: number; y: number; z: number };
  isEyebrow?: boolean;
}

export interface Hair {
  /**
   * Register hair objects from a scene.
   * Returns engine-agnostic references for UI and service layers.
   */
  registerHairObjects(objects: Object3D[]): HairObjectRef[];

  /**
   * Get hair objects registered in the engine.
   */
  getRegisteredHairObjects(): Mesh[];

  /**
   * Enable or disable hair physics simulation.
   */
  setHairPhysicsEnabled(enabled: boolean): void;

  /**
   * Check if hair physics is enabled.
   */
  isHairPhysicsEnabled(): boolean;

  /**
   * Update hair physics configuration.
   */
  setHairPhysicsConfig(config: HairPhysicsRuntimeConfigUpdate): void;

  /**
   * Get current hair physics configuration.
   */
  getHairPhysicsConfig(): HairPhysicsRuntimeConfig;

  /**
   * Validate hair morph target mappings against registered hair meshes.
   * Returns a list of missing morph keys (if any).
   */
  validateHairMorphTargets(): string[];

  /**
   * Get head rotation values used for hair physics (range -1 to 1).
   */
  getHeadRotation(): { yaw: number; pitch: number; roll: number };

  /**
   * Manually tick hair physics (optional).
   */
  updateHairPhysics(dt: number): void;

  /**
   * Get available hair morph targets for a mesh.
   */
  getHairMorphTargets(meshName?: string): string[];

  /**
   * Set morph targets on specific meshes.
   */
  setMorphOnMeshes(meshNames: string[], morphKey: string, value: number): void;

  /**
   * Apply hair/eyebrow styling state to a mesh.
   */
  applyHairStateToObject(objectName: string, state: HairObjectState): void;
}
