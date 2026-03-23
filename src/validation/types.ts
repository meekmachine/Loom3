export interface ValidationMorphMesh {
  name: string;
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}

export interface ValidationSkeleton {
  bones: Array<{ name: string }>;
}
