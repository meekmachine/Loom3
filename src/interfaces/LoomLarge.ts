/**
 * LoomLarge Engine Interface
 *
 * Defines the contract for 3D character animation engines.
 * Uses Three.js types directly - no framework abstraction overhead.
 */

import type { Mesh, Object3D } from 'three';
import type {
  Profile,
  MeshInfo,
  PoseApplyOptions,
  PoseApplyResult,
  PoseCaptureOptions,
  PoseSnapshot,
} from '../mappings/types';
import type { PresetType } from '../presets';
import type { Animation } from './Animation';
import type { Hair } from './Hair';

/**
 * Payload for initializing the engine with a loaded model
 */
export interface ReadyPayload {
  meshes: Mesh[];
  model: Object3D;
}

/**
 * Configuration options for the Loom3 engine
 */
export interface LoomLargeConfig {
  /** AU to morph target mappings (partial extensions merged into the preset). */
  profile?: Partial<Profile>;
  /** Preset type to resolve if profile is not provided. */
  presetType?: PresetType | string;
}

// MeshInfo is imported from mappings/types.ts
export type { MeshInfo } from '../mappings/types';

/**
 * Loom3 Engine Interface
 *
 * The main interface for controlling 3D character facial animation.
 * Supports Action Units (AUs), morph targets, visemes, and bone control.
 */
export interface LoomLarge extends Animation, Hair {
  // ============================================================================
  // INITIALIZATION & LIFECYCLE
  // ============================================================================

  /**
   * Initialize the engine with a loaded model.
   * Call this after loading your 3D model.
   */
  onReady(payload: ReadyPayload): void;

  /**
   * Update animation state. Call each frame with delta time in seconds.
   * If using start(), this is called automatically.
   */
  update(deltaSeconds: number): void;

  /**
   * Start the internal animation loop (RAF-based).
   * Automatically calls update() each frame with delta time.
   */
  start(): void;

  /**
   * Stop the internal animation loop.
   */
  stop(): void;

  /**
   * Dispose engine resources and cleanup.
   * Stops the animation loop and clears all transitions.
   */
  dispose(): void;

  // ============================================================================
  // MESH CONTROL
  // ============================================================================

  /**
   * Get list of all meshes in the model
   */
  getMeshList(): MeshInfo[];

  /**
   * Set mesh visibility
   */
  setMeshVisible(meshName: string, visible: boolean): void;

  /**
   * Highlight a mesh with an emissive glow effect
   * @param meshName - Name of the mesh to highlight (null to clear all highlights)
   * @param color - Highlight color (default: cyan)
   * @param intensity - Emissive intensity (default: 0.5)
   */
  highlightMesh(meshName: string | null, color?: number, intensity?: number): void;

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Update AU mappings configuration
   */
  setProfile(profile: Profile): void;

  /**
   * Get current AU mappings configuration
   */
  getProfile(): Profile;

  // ============================================================================
  // POSE CONTROL
  // ============================================================================

  /**
   * Capture the current evaluated skeleton/expression state as a pose snapshot.
   * Captured FACS AU values are accompanied by the resolved bone/morph state.
   */
  capturePose(options?: PoseCaptureOptions): PoseSnapshot;

  /**
   * Apply a saved pose snapshot to the current model.
   */
  applyPose(pose: PoseSnapshot, options?: PoseApplyOptions): PoseApplyResult;

  /**
   * Get the GLB/rest pose captured when the model became ready.
   */
  getImportedRestPose(): PoseSnapshot | null;

  /**
   * Reset the current character to the GLB/rest pose.
   */
  resetToImportedRestPose(options?: PoseApplyOptions): PoseApplyResult;

  /**
   * Set the user-authored base pose used by resetToBasePose().
   */
  setBasePose(pose: PoseSnapshot | null): PoseSnapshot | null;

  /**
   * Set a base expression from FACS AU values and capture the resolved parts
   * into the base pose.
   */
  setBaseExpression(aus: Record<string | number, number>, options?: PoseCaptureOptions): PoseSnapshot | null;

  /**
   * Get the user-authored base pose, falling back to null when none is set.
   */
  getBasePose(): PoseSnapshot | null;

  /**
   * Reset to the user-authored base pose, or the imported rest pose if unset.
   */
  resetToBasePose(options?: PoseApplyOptions): PoseApplyResult;

}

// Backward-compatible aliases (deprecated).
export type Loom3 = LoomLarge;
export type Loom3Config = LoomLargeConfig;
