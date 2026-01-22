/**
 * Loom3 Interfaces
 *
 * Framework-agnostic interfaces for 3D character animation.
 * Implement these interfaces to add support for different 3D engines.
 */

export type {
  LoomLarge,
  ReadyPayload,
  LoomLargeConfig,
  Loom3,
  Loom3Config,
} from './LoomLarge';

export type { MeshInfo } from '../mappings/types';

export type { Animation, MixerLoopMode } from './Animation';

export type { HairPhysics, HairPhysicsConfig, HairStrand, HairState } from './HairPhysics';

export type {
  Hair,
  HairPhysicsRuntimeConfig,
  HairObjectRef,
  HairObjectState,
} from './Hair';
