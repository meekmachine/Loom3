import type { Mesh, Object3D } from 'three';
import { CC4_MESHES } from '../../../presets/cc4';

export type HairPhysicsConfig = {
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
};

type HairWindIdleState = {
  windTime: number;
  idlePhase: number;
  smoothedWindX: number;
  smoothedWindZ: number;
};

export interface HairPhysicsHost {
  transitionMorph: (key: string, value: number, durationMs: number, meshNames?: string[]) => unknown;
  getMeshByName: (name: string) => Mesh | undefined;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

export class HairPhysicsController {
  private host: HairPhysicsHost;
  private hairPhysicsEnabled = false;
  private hairPhysicsConfig: HairPhysicsConfig = {
    stiffness: 7.5,
    damping: 0.18,
    inertia: 3.5,
    gravity: 12,
    responseScale: 2.5,
    idleSwayAmount: 0.12,
    idleSwaySpeed: 1.0,
    windStrength: 0,
    windDirectionX: 1.0,
    windDirectionZ: 0,
    windTurbulence: 0.3,
    windFrequency: 1.4,
  };
  private hairWindIdleState: HairWindIdleState = {
    windTime: 0,
    idlePhase: 0,
    smoothedWindX: 0,
    smoothedWindZ: 0,
  };
  private registeredHairObjects = new Map<string, Mesh>();
  private cachedHairMeshNames: string[] | null = null;

  constructor(host: HairPhysicsHost) {
    this.host = host;
  }

  clearRegisteredHairObjects(): void {
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null;
  }

  registerHairObjects(objects: Object3D[]): Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> {
    this.clearRegisteredHairObjects();

    const result: Array<{ name: string; isMesh: boolean; isEyebrow: boolean }> = [];

    for (const obj of objects) {
      if ((obj as any).isMesh) {
        const mesh = obj as unknown as Mesh;
        this.registeredHairObjects.set(mesh.name, mesh);

        const meshInfo = CC4_MESHES[mesh.name];
        const isEyebrow = meshInfo?.category === 'eyebrow';

        result.push({
          name: mesh.name,
          isMesh: true,
          isEyebrow,
        });
      }
    }

    return result;
  }

  autoRegisterHairMesh(mesh: Mesh, category: 'hair' | 'eyebrow'): void {
    this.registeredHairObjects.set(mesh.name, mesh);
    this.cachedHairMeshNames = null;
    mesh.renderOrder = category === 'eyebrow' ? 5 : 10;
  }

  getRegisteredHairObjects(): Mesh[] {
    return Array.from(this.registeredHairObjects.values());
  }

  setHairPhysicsEnabled(enabled: boolean): void {
    this.hairPhysicsEnabled = enabled;
    if (!enabled) {
      const duration = 200;
      const hairMeshNames = this.getHairMeshNames();
      this.host.transitionMorph('L_Hair_Left', 0, duration, hairMeshNames);
      this.host.transitionMorph('L_Hair_Right', 0, duration, hairMeshNames);
      this.host.transitionMorph('L_Hair_Front', 0, duration, hairMeshNames);
      this.host.transitionMorph('Fluffy_Right', 0, duration, hairMeshNames);
      this.host.transitionMorph('Fluffy_Bottom_ALL', 0, duration, hairMeshNames);
    }
  }

  isHairPhysicsEnabled(): boolean {
    return this.hairPhysicsEnabled;
  }

  setHairPhysicsConfig(config: Partial<HairPhysicsConfig>): void {
    this.hairPhysicsConfig = { ...this.hairPhysicsConfig, ...config };
  }

  getHairPhysicsConfig(): HairPhysicsConfig {
    return { ...this.hairPhysicsConfig };
  }

  update(dtSeconds: number): void {
    this.updateHairWindIdle(dtSeconds);
  }

  onHeadRotationChanged(yaw: number, pitch: number): void {
    this.updateHairForHeadChange(yaw, pitch);
  }

  getHairMorphTargets(meshName?: string): string[] {
    let targetMesh: Mesh | undefined;

    if (meshName) {
      targetMesh = this.registeredHairObjects.get(meshName);
    } else {
      for (const [name, mesh] of this.registeredHairObjects) {
        const info = CC4_MESHES[name];
        if (info?.category === 'hair') {
          targetMesh = mesh;
          break;
        }
      }
    }

    if (!targetMesh) return [];

    const dict = targetMesh.morphTargetDictionary;
    if (!dict) return [];

    return Object.keys(dict);
  }

  setMorphOnMeshes(meshNames: string[], morphKey: string, value: number): void {
    const val = clamp01(value);
    for (const name of meshNames) {
      const mesh = this.registeredHairObjects.get(name) || this.host.getMeshByName(name);
      if (!mesh) continue;

      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (!dict || !infl) continue;

      const idx = dict[morphKey];
      if (idx !== undefined) {
        infl[idx] = val;
      }
    }
  }

  applyHairStateToObject(objectName: string, state: {
    color?: { baseColor: string; emissive: string; emissiveIntensity: number };
    outline?: { show: boolean; color: string; opacity: number };
    visible?: boolean;
    scale?: { x: number; y: number; z: number };
    position?: { x: number; y: number; z: number };
    isEyebrow?: boolean;
  }): void {
    const mesh = this.registeredHairObjects.get(objectName);
    if (!mesh) return;

    const obj = mesh as any;

    if (state.visible !== undefined) {
      obj.visible = state.visible;
    }

    if (state.scale) {
      obj.scale.set(state.scale.x, state.scale.y, state.scale.z);
    }

    if (state.position) {
      obj.position.set(state.position.x, state.position.y, state.position.z);
    }

    if (state.color && obj.material) {
      const mat = obj.material;
      if (mat.color) {
        mat.color.set(state.color.baseColor);
      }
      if (mat.emissive !== undefined) {
        mat.emissive.set(state.color.emissive);
        mat.emissiveIntensity = state.color.emissiveIntensity;
      }
      mat.needsUpdate = true;
    }
  }

  private getHairMeshNames(): string[] {
    if (this.cachedHairMeshNames) return this.cachedHairMeshNames;

    const names: string[] = [];
    this.registeredHairObjects.forEach((mesh, name) => {
      const info = CC4_MESHES[name];
      if (info?.category === 'hair') {
        names.push(name);
      } else if (info?.category !== 'eyebrow') {
        const dict = mesh.morphTargetDictionary;
        if (dict && ('L_Hair_Left' in dict || 'L_Hair_Right' in dict || 'L_Hair_Front' in dict)) {
          names.push(name);
        }
      }
    });
    this.cachedHairMeshNames = names;
    return names;
  }

  private updateHairWindIdle(dt: number): void {
    if (!this.hairPhysicsEnabled) return;
    if (this.registeredHairObjects.size === 0) return;

    const cfg = this.hairPhysicsConfig;
    const st = this.hairWindIdleState;

    const hasWind = cfg.windStrength > 0;
    const hasIdle = cfg.idleSwayAmount > 0;
    if (!hasWind && !hasIdle) return;

    st.idlePhase += dt * cfg.idleSwaySpeed;
    st.windTime += dt;

    let windOffset = 0;
    if (hasWind) {
      const primaryWave = Math.sin(st.windTime * cfg.windFrequency);
      const secondaryWave = Math.sin(st.windTime * cfg.windFrequency * 1.7) * 0.3;
      const waveStrength = primaryWave + secondaryWave;

      const targetWind = cfg.windDirectionX * waveStrength * cfg.windStrength * 0.1;
      const smoothFactor = 1 - Math.exp(-dt * 8);
      st.smoothedWindX += (targetWind - st.smoothedWindX) * smoothFactor;
      windOffset = st.smoothedWindX;
    }

    let idleOffset = 0;
    if (hasIdle) {
      idleOffset = Math.sin(st.idlePhase * Math.PI * 2) * cfg.idleSwayAmount;
    }

    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    const duration = 50;

    const combinedOffset = idleOffset + windOffset;
    const leftValue = clamp01(combinedOffset > 0 ? combinedOffset : 0);
    const rightValue = clamp01(combinedOffset < 0 ? -combinedOffset : 0);
    const fluffyRightValue = clamp01(rightValue * 0.7);
    const fluffyBottomValue = clamp01(Math.abs(combinedOffset) * 0.25);

    if (Math.abs(combinedOffset) > 0.001) {
      this.host.transitionMorph('L_Hair_Left', leftValue, duration, hairMeshNames);
      this.host.transitionMorph('L_Hair_Right', rightValue, duration, hairMeshNames);
      this.host.transitionMorph('Fluffy_Right', fluffyRightValue, duration, hairMeshNames);
      this.host.transitionMorph('Fluffy_Bottom_ALL', fluffyBottomValue, duration, hairMeshNames);
    }
  }

  private updateHairForHeadChange(headYaw: number, headPitch: number): void {
    if (this.registeredHairObjects.size === 0) return;

    const cfg = this.hairPhysicsConfig;
    const horizontal = -headYaw * cfg.inertia * cfg.responseScale;
    const vertical = headPitch * cfg.gravity * 0.1 * cfg.responseScale;

    const leftValue = clamp01(horizontal > 0 ? horizontal : 0);
    const rightValue = clamp01(horizontal < 0 ? -horizontal : 0);
    const frontValue = clamp01(vertical * 0.5);
    const fluffyRightValue = clamp01(rightValue * 0.7);
    const movementIntensity = Math.abs(horizontal) + Math.abs(vertical);
    const fluffyBottomValue = clamp01(movementIntensity * 0.25);

    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    const duration = 150;
    this.host.transitionMorph('L_Hair_Left', leftValue, duration, hairMeshNames);
    this.host.transitionMorph('L_Hair_Right', rightValue, duration, hairMeshNames);
    this.host.transitionMorph('L_Hair_Front', frontValue, duration, hairMeshNames);
    this.host.transitionMorph('Fluffy_Right', fluffyRightValue, duration, hairMeshNames);
    this.host.transitionMorph('Fluffy_Bottom_ALL', fluffyBottomValue, duration, hairMeshNames);
  }
}
