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
}

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
  setHairPhysicsConfig(config: Partial<HairPhysicsRuntimeConfig>): void;

  /**
   * Get current hair physics configuration.
   */
  getHairPhysicsConfig(): HairPhysicsRuntimeConfig;

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
