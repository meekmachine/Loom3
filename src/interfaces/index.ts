/**
 * Loom3 Interfaces
 *
 * Framework-agnostic interfaces for 3D character animation.
 * Implement these interfaces to add support for different 3D engines.
 */

export type {
  Loom3,
  LoomMesh,
  LoomVector3,
  LoomEuler,
  LoomQuaternion,
  LoomObject3D,
  ReadyPayload,
  Loom3Config,
} from './Loom3';

export type { MeshInfo } from '../mappings/types';

export type { Animation } from './Animation';

export type { HairPhysics, HairPhysicsConfig, HairStrand, HairState } from './HairPhysics';
