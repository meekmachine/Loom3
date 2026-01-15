import type { Object3D, Quaternion } from 'three';

/**
 * Snapshot of a bone node's baseline transform.
 */
export interface NodeBase {
  obj: Object3D;
  basePos: { x: number; y: number; z: number };
  baseQuat: Quaternion;
  baseEuler: { x: number; y: number; z: number; order: string };
}

export type ResolvedBones = Partial<Record<string, NodeBase>>;
