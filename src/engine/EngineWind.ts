import * as THREE from 'three';

/**
 * EngineWind - Wind physics simulation for character hair
 *
 * Applies procedural wind forces to hair bones using:
 * - Perlin-like noise for natural wind variation
 * - Spring dynamics for realistic movement
 * - Configurable wind direction, strength, and turbulence
 */

// Hair bone naming patterns to search for
const HAIR_BONE_PATTERNS = [
  /hair/i,
  /strand/i,
  /lock/i,
  /ponytail/i,
  /braid/i,
  /bangs/i,
  /fringe/i,
  /scalp/i,
  // Character Creator specific patterns
  /CC_Base_Hair/i,
  /CC_Game_Hair/i,
  /_Hair\d+/i,  // e.g., Bone_Hair1, Joint_Hair2
  /Hair_\d+/i,  // e.g., Hair_01, Hair_02
  /HairBone/i,
  /Bone.*Hair/i,
  // Specific hair morph/bone names
  /Side_part_wavy/i,
];

interface HairBone {
  bone: THREE.Bone;
  baseRotation: THREE.Quaternion;
  currentRotation: THREE.Quaternion;
  velocity: THREE.Vector3;
  /** Distance from root - used for cascading motion */
  depth: number;
  /** Parent hair bone index (if any) */
  parentIndex: number | null;
}

interface HairMesh {
  mesh: THREE.Mesh | THREE.SkinnedMesh;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Quaternion;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
}

interface WindConfig {
  /** Enable/disable wind simulation */
  enabled: boolean;
  /** Base wind strength (0-1) */
  strength: number;
  /** Wind direction (normalized) */
  direction: THREE.Vector3;
  /** Frequency of wind gusts (Hz) */
  frequency: number;
  /** Turbulence amount (0-1) - random variation */
  turbulence: number;
  /** Spring stiffness - how quickly hair returns to rest */
  springStiffness: number;
  /** Damping factor - reduces oscillation */
  damping: number;
}

export class EngineWind {
  private hairBones: HairBone[] = [];
  private hairMeshes: HairMesh[] = [];
  private time: number = 0;
  private config: WindConfig = {
    enabled: true,
    strength: 0.3,
    direction: new THREE.Vector3(1, 0, 0.3).normalize(),
    frequency: 0.5,
    turbulence: 0.4,
    springStiffness: 8.0,
    damping: 0.85,
  };

  // Noise offsets for Perlin-like variation
  private noiseOffset1 = Math.random() * 1000;
  private noiseOffset2 = Math.random() * 1000;
  private noiseOffset3 = Math.random() * 1000;

  constructor(model?: THREE.Object3D) {
    if (model) {
      this.discoverHairBones(model);
      this.discoverHairMeshes(model);
    }
  }

  /**
   * Scan the model hierarchy for hair bones
   */
  discoverHairBones(model: THREE.Object3D) {
    const allBones: THREE.Bone[] = [];
    const hairBones: THREE.Bone[] = [];

    // Find all bones in the model
    model.traverse((obj) => {
      if (obj instanceof THREE.Bone) {
        allBones.push(obj);

        // Check if bone name matches hair patterns
        const isHairBone = HAIR_BONE_PATTERNS.some(pattern => pattern.test(obj.name));

        if (isHairBone) {
          hairBones.push(obj);
        }
      }
    });

    // Also check for bones in skinned meshes that match hair patterns
    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) {
        const isHairMesh = HAIR_BONE_PATTERNS.some(pattern => pattern.test(obj.name));
        if (isHairMesh && obj.skeleton && obj.skeleton.bones) {
          console.log(`[EngineWind] Found hair mesh "${obj.name}" with ${obj.skeleton.bones.length} bones in skeleton`);
          // Only add bones that match hair patterns (not the entire skeleton)
          for (const bone of obj.skeleton.bones) {
            const isBoneHair = HAIR_BONE_PATTERNS.some(pattern => pattern.test(bone.name));
            if (isBoneHair && !hairBones.includes(bone)) {
              console.log(`[EngineWind]   → Adding hair bone from skeleton: ${bone.name}`);
              hairBones.push(bone);
            }
          }
        }
      }
    });

    // Debug: Log all bones found
    console.log(`[EngineWind] Total bones in model: ${allBones.length}`);
    console.log(`[EngineWind] All bone names:`, allBones.map(b => b.name).join(', '));

    // Build hair bone hierarchy with depth information
    this.hairBones = hairBones.map((bone, idx) => {
      const depth = this.calculateBoneDepth(bone);
      const parentIndex = this.findParentHairBoneIndex(bone, hairBones);

      return {
        bone,
        baseRotation: bone.quaternion.clone(),
        currentRotation: bone.quaternion.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        depth,
        parentIndex,
      };
    });

    if (this.hairBones.length > 0) {
      console.log(`[EngineWind] ✓ Discovered ${this.hairBones.length} hair bones:`,
        this.hairBones.map(hb => hb.bone.name));
    } else {
      console.log(`[EngineWind] ✗ No hair bones detected. Searched for patterns:`,
        HAIR_BONE_PATTERNS.map(p => p.source));
    }
  }

  /**
   * Scan the model hierarchy for hair meshes
   */
  discoverHairMeshes(model: THREE.Object3D) {
    const allMeshes: Array<THREE.Mesh | THREE.SkinnedMesh> = [];
    const hairMeshes: Array<THREE.Mesh | THREE.SkinnedMesh> = [];

    // Find all meshes in the model
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
        allMeshes.push(obj);

        // Check if mesh name matches hair patterns
        const isHairMesh = HAIR_BONE_PATTERNS.some(pattern => pattern.test(obj.name));

        if (isHairMesh) {
          console.log(`[EngineWind] MATCHED hair mesh: "${obj.name}" (SkinnedMesh: ${obj instanceof THREE.SkinnedMesh})`);
          hairMeshes.push(obj);
        }
      }
    });

    // Debug: Log all meshes found
    console.log(`[EngineWind] Total meshes in model: ${allMeshes.length}`);
    console.log(`[EngineWind] All mesh names:`, allMeshes.map(m => m.name).join(', '));

    // Build hair mesh list with base transforms
    this.hairMeshes = hairMeshes.map((mesh) => {
      return {
        mesh,
        basePosition: mesh.position.clone(),
        baseRotation: mesh.quaternion.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
      };
    });

    if (this.hairMeshes.length > 0) {
      console.log(`[EngineWind] ✓ Discovered ${this.hairMeshes.length} hair meshes:`,
        this.hairMeshes.map(hm => hm.mesh.name));
    } else {
      console.log(`[EngineWind] ✗ No hair meshes detected.`);
    }
  }

  /**
   * Calculate bone depth from root (for cascading motion)
   */
  private calculateBoneDepth(bone: THREE.Bone): number {
    let depth = 0;
    let current: THREE.Object3D | null = bone.parent;

    while (current && current instanceof THREE.Bone) {
      depth++;
      current = current.parent;
    }

    return depth;
  }

  /**
   * Find parent hair bone index in our hair bones array
   */
  private findParentHairBoneIndex(bone: THREE.Bone, allHairBones: THREE.Bone[]): number | null {
    if (!bone.parent || !(bone.parent instanceof THREE.Bone)) {
      return null;
    }

    const parentIndex = allHairBones.findIndex(b => b === bone.parent);
    return parentIndex >= 0 ? parentIndex : null;
  }

  /**
   * Simple noise function (simplified Perlin noise)
   */
  private noise(x: number, y: number, z: number): number {
    // Simple hash-based noise
    const hash = (n: number) => {
      const h = Math.sin(n * 12.9898 + n * 78.233) * 43758.5453;
      return h - Math.floor(h);
    };

    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const intZ = Math.floor(z);

    const fracX = x - intX;
    const fracY = y - intY;
    const fracZ = z - intZ;

    // Smooth interpolation
    const u = fracX * fracX * (3 - 2 * fracX);
    const v = fracY * fracY * (3 - 2 * fracY);
    const w = fracZ * fracZ * (3 - 2 * fracZ);

    // Sample corners and interpolate
    const a = hash(intX + intY * 57 + intZ * 113);
    const b = hash(intX + 1 + intY * 57 + intZ * 113);
    const c = hash(intX + (intY + 1) * 57 + intZ * 113);
    const d = hash(intX + 1 + (intY + 1) * 57 + intZ * 113);

    const e = hash(intX + intY * 57 + (intZ + 1) * 113);
    const f = hash(intX + 1 + intY * 57 + (intZ + 1) * 113);
    const g = hash(intX + (intY + 1) * 57 + (intZ + 1) * 113);
    const h = hash(intX + 1 + (intY + 1) * 57 + (intZ + 1) * 113);

    const x1 = a + (b - a) * u;
    const x2 = c + (d - c) * u;
    const y1 = x1 + (x2 - x1) * v;

    const x3 = e + (f - e) * u;
    const x4 = g + (h - g) * u;
    const y2 = x3 + (x4 - x3) * v;

    return y1 + (y2 - y1) * w;
  }

  /**
   * Calculate wind force at current time with turbulence
   */
  private calculateWindForce(): THREE.Vector3 {
    if (!this.config.enabled) {
      return new THREE.Vector3(0, 0, 0);
    }

    const { strength, direction, frequency, turbulence } = this.config;

    // Base wind wave (sinusoidal)
    const wave = Math.sin(this.time * frequency * 2 * Math.PI);

    // Add noise-based turbulence
    const turbX = this.noise(
      this.time * frequency + this.noiseOffset1,
      0,
      0
    ) * 2 - 1;

    const turbY = this.noise(
      0,
      this.time * frequency + this.noiseOffset2,
      0
    ) * 2 - 1;

    const turbZ = this.noise(
      0,
      0,
      this.time * frequency + this.noiseOffset3
    ) * 2 - 1;

    // Combine base wave with turbulence
    const baseForce = wave * (1 - turbulence) + turbX * turbulence;

    const windForce = new THREE.Vector3(
      direction.x * baseForce + turbX * turbulence * 0.3,
      direction.y * baseForce + turbY * turbulence * 0.3,
      direction.z * baseForce + turbZ * turbulence * 0.3,
    );

    windForce.multiplyScalar(strength);

    return windForce;
  }

  /**
   * Update wind physics simulation
   */
  update(deltaSeconds: number) {
    if (!this.config.enabled || (this.hairBones.length === 0 && this.hairMeshes.length === 0)) {
      return;
    }

    this.time += deltaSeconds;

    const windForce = this.calculateWindForce();
    const { springStiffness, damping } = this.config;

    // Update hair bones
    if (this.hairBones.length > 0) {
      this.updateHairBones(deltaSeconds, windForce, springStiffness, damping);
    }

    // Update hair meshes
    if (this.hairMeshes.length > 0) {
      this.updateHairMeshes(deltaSeconds, windForce, springStiffness, damping);
    }
  }

  /**
   * Update hair bones with wind physics
   */
  private updateHairBones(
    deltaSeconds: number,
    windForce: THREE.Vector3,
    springStiffness: number,
    damping: number
  ) {
    // Temp vectors to avoid allocations
    const springForce = new THREE.Vector3();
    const totalForce = new THREE.Vector3();
    const rotationAxis = new THREE.Vector3();
    const deltaRotation = new THREE.Quaternion();

    for (let i = 0; i < this.hairBones.length; i++) {
      const hairBone = this.hairBones[i];

      // Apply wind force with depth-based falloff (roots move less than tips)
      const depthFactor = Math.min(1, hairBone.depth * 0.3 + 0.2);
      const boneWindForce = windForce.clone().multiplyScalar(depthFactor);

      // Spring force pulls back to base rotation
      // Convert quaternion difference to angular displacement
      const currentEuler = new THREE.Euler().setFromQuaternion(hairBone.currentRotation);
      const baseEuler = new THREE.Euler().setFromQuaternion(hairBone.baseRotation);

      springForce.set(
        baseEuler.x - currentEuler.x,
        baseEuler.y - currentEuler.y,
        baseEuler.z - currentEuler.z,
      ).multiplyScalar(springStiffness);

      // Total force = wind + spring
      totalForce.copy(boneWindForce).add(springForce);

      // Apply damping to velocity
      hairBone.velocity.multiplyScalar(damping);

      // Integrate force into velocity
      hairBone.velocity.addScaledVector(totalForce, deltaSeconds);

      // Limit velocity to prevent instability
      const maxVelocity = 10.0;
      if (hairBone.velocity.length() > maxVelocity) {
        hairBone.velocity.normalize().multiplyScalar(maxVelocity);
      }

      // Convert angular velocity to quaternion rotation
      const angularDisplacement = hairBone.velocity.clone().multiplyScalar(deltaSeconds);
      const angle = angularDisplacement.length();

      if (angle > 0.0001) {
        rotationAxis.copy(angularDisplacement).normalize();
        deltaRotation.setFromAxisAngle(rotationAxis, angle);

        // Apply rotation: current = delta * current
        hairBone.currentRotation.premultiply(deltaRotation);
        hairBone.currentRotation.normalize();

        // Apply to actual bone
        hairBone.bone.quaternion.copy(hairBone.currentRotation);
      }
    }
  }

  /**
   * Update hair meshes with wind physics
   */
  private updateHairMeshes(
    deltaSeconds: number,
    windForce: THREE.Vector3,
    springStiffness: number,
    damping: number
  ) {
    const springForce = new THREE.Vector3();
    const totalForce = new THREE.Vector3();
    const torque = new THREE.Vector3();
    const rotationAxis = new THREE.Vector3();
    const deltaRotation = new THREE.Quaternion();

    for (const hairMesh of this.hairMeshes) {
      // Apply wind force with slight randomization per mesh
      const meshWindForce = windForce.clone().multiplyScalar(0.8 + Math.random() * 0.4);

      // Spring force for rotation (return to base orientation)
      const currentEuler = new THREE.Euler().setFromQuaternion(hairMesh.mesh.quaternion);
      const baseEuler = new THREE.Euler().setFromQuaternion(hairMesh.baseRotation);

      springForce.set(
        baseEuler.x - currentEuler.x,
        baseEuler.y - currentEuler.y,
        baseEuler.z - currentEuler.z,
      ).multiplyScalar(springStiffness);

      // Total angular force
      torque.copy(meshWindForce).add(springForce);

      // Apply damping
      hairMesh.angularVelocity.multiplyScalar(damping);

      // Integrate force into angular velocity
      hairMesh.angularVelocity.addScaledVector(torque, deltaSeconds);

      // Limit angular velocity
      const maxAngularVel = 5.0;
      if (hairMesh.angularVelocity.length() > maxAngularVel) {
        hairMesh.angularVelocity.normalize().multiplyScalar(maxAngularVel);
      }

      // Apply rotation
      const angularDisplacement = hairMesh.angularVelocity.clone().multiplyScalar(deltaSeconds);
      const angle = angularDisplacement.length();

      if (angle > 0.0001) {
        rotationAxis.copy(angularDisplacement).normalize();
        deltaRotation.setFromAxisAngle(rotationAxis, angle);
        hairMesh.mesh.quaternion.premultiply(deltaRotation);
        hairMesh.mesh.quaternion.normalize();
      }

      // Also apply slight position offset for sway effect
      hairMesh.velocity.multiplyScalar(damping);
      hairMesh.velocity.addScaledVector(meshWindForce, deltaSeconds * 0.1);

      const positionOffset = hairMesh.velocity.clone().multiplyScalar(deltaSeconds);
      hairMesh.mesh.position.copy(hairMesh.basePosition).add(positionOffset);
    }
  }

  /**
   * Reset all hair bones and meshes to their base transforms
   */
  reset() {
    for (const hairBone of this.hairBones) {
      hairBone.currentRotation.copy(hairBone.baseRotation);
      hairBone.velocity.set(0, 0, 0);
      hairBone.bone.quaternion.copy(hairBone.baseRotation);
    }

    for (const hairMesh of this.hairMeshes) {
      hairMesh.mesh.position.copy(hairMesh.basePosition);
      hairMesh.mesh.quaternion.copy(hairMesh.baseRotation);
      hairMesh.velocity.set(0, 0, 0);
      hairMesh.angularVelocity.set(0, 0, 0);
    }

    this.time = 0;
  }

  // Configuration getters/setters

  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  getEnabled(): boolean {
    return this.config.enabled;
  }

  setStrength(strength: number) {
    this.config.strength = Math.max(0, Math.min(1, strength));
  }

  getStrength(): number {
    return this.config.strength;
  }

  setDirection(x: number, y: number, z: number) {
    this.config.direction.set(x, y, z).normalize();
  }

  getDirection(): THREE.Vector3 {
    return this.config.direction.clone();
  }

  setFrequency(frequency: number) {
    this.config.frequency = Math.max(0.01, frequency);
  }

  getFrequency(): number {
    return this.config.frequency;
  }

  setTurbulence(turbulence: number) {
    this.config.turbulence = Math.max(0, Math.min(1, turbulence));
  }

  getTurbulence(): number {
    return this.config.turbulence;
  }

  setSpringStiffness(stiffness: number) {
    this.config.springStiffness = Math.max(0, stiffness);
  }

  getSpringStiffness(): number {
    return this.config.springStiffness;
  }

  setDamping(damping: number) {
    this.config.damping = Math.max(0, Math.min(1, damping));
  }

  getDamping(): number {
    return this.config.damping;
  }

  /**
   * Get info about discovered hair bones and meshes
   */
  getHairBoneCount(): number {
    return this.hairBones.length + this.hairMeshes.length;
  }

  getHairBoneNames(): string[] {
    const boneNames = this.hairBones.map(hb => hb.bone.name);
    const meshNames = this.hairMeshes.map(hm => `${hm.mesh.name} (mesh)`);
    return [...boneNames, ...meshNames];
  }

  getHairMeshCount(): number {
    return this.hairMeshes.length;
  }

  getHairMeshNames(): string[] {
    return this.hairMeshes.map(hm => hm.mesh.name);
  }

  /**
   * Debug: Get current wind force
   */
  getDebugWindForce(): THREE.Vector3 {
    return this.calculateWindForce();
  }
}
