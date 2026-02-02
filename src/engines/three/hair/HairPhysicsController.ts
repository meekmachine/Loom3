import type { Mesh, Object3D } from 'three';
import type { ClipHandle, ClipOptions, CurvesMap } from '../../../core/types';
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
  idleClipDuration: number;
  impulseClipDuration: number;
};

export interface HairPhysicsHost {
  getMeshByName: (name: string) => Mesh | undefined;
  buildClip?: (clipName: string, curves: CurvesMap, options?: ClipOptions) => ClipHandle | null;
  cleanupSnippet?: (name: string) => void;
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
    idleClipDuration: 10,
    impulseClipDuration: 1.4,
  };
  private readonly idleClipName = 'hair_idle';
  private readonly gravityClipName = 'hair_gravity';
  private readonly impulseClipNames = {
    left: 'hair_impulse_left',
    right: 'hair_impulse_right',
    front: 'hair_impulse_front',
  };
  private idleClipHandle: ClipHandle | null = null;
  private gravityClipHandle: ClipHandle | null = null;
  private idleClipDirty = true;
  private gravityClipDirty = true;
  private impulseClips: { left?: ClipHandle; right?: ClipHandle; front?: ClipHandle } = {};
  private impulseClipDirty = true;
  private impulseEndTimers: Partial<Record<'left' | 'right' | 'front', ReturnType<typeof setTimeout>>> = {};
  private impulseFadeSteps: Partial<Record<'left' | 'right' | 'front', ReturnType<typeof setTimeout>[]>> = {};
  private hasHeadState = false;
  private lastHeadHorizontal = 0;
  private lastHeadVertical = 0;
  private registeredHairObjects = new Map<string, Mesh>();
  private cachedHairMeshNames: string[] | null = null;

  constructor(host: HairPhysicsHost) {
    this.host = host;
  }

  clearRegisteredHairObjects(): void {
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null;
    this.stopIdleClip();
    this.stopGravityClip();
    this.stopImpulseClips();
    this.clearImpulseTimers();
    this.idleClipDirty = true;
    this.gravityClipDirty = true;
    this.impulseClipDirty = true;
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

    this.cachedHairMeshNames = null;
    this.idleClipDirty = true;
    this.gravityClipDirty = true;
    this.impulseClipDirty = true;
    if (this.hairPhysicsEnabled) {
      this.startIdleClip();
      this.startGravityClip();
      this.buildImpulseClips();
    }

    return result;
  }

  autoRegisterHairMesh(mesh: Mesh, category: 'hair' | 'eyebrow'): void {
    this.registeredHairObjects.set(mesh.name, mesh);
    this.cachedHairMeshNames = null;
    this.idleClipDirty = true;
    this.gravityClipDirty = true;
    this.impulseClipDirty = true;
    if (this.hairPhysicsEnabled) {
      this.startIdleClip();
      this.startGravityClip();
      this.buildImpulseClips();
    }
    mesh.renderOrder = category === 'eyebrow' ? 5 : 10;
  }

  getRegisteredHairObjects(): Mesh[] {
    return Array.from(this.registeredHairObjects.values());
  }

  setHairPhysicsEnabled(enabled: boolean): void {
    this.hairPhysicsEnabled = enabled;
    if (!enabled) {
      this.stopIdleClip();
      this.stopGravityClip();
      this.stopImpulseClips();
      this.clearImpulseTimers();
      this.hasHeadState = false;
      return;
    }
    this.idleClipDirty = true;
    this.gravityClipDirty = true;
    this.impulseClipDirty = true;
    this.startIdleClip();
    this.startGravityClip();
    this.buildImpulseClips();
  }

  isHairPhysicsEnabled(): boolean {
    return this.hairPhysicsEnabled;
  }

  setHairPhysicsConfig(config: Partial<HairPhysicsConfig>): void {
    this.hairPhysicsConfig = { ...this.hairPhysicsConfig, ...config };

    const idleChanged = [
      'idleSwayAmount',
      'idleSwaySpeed',
      'windStrength',
      'windDirectionX',
      'windDirectionZ',
      'windTurbulence',
      'windFrequency',
      'idleClipDuration',
    ].some((key) => (config as Record<string, unknown>)[key] !== undefined);

    const impulseChanged = [
      'stiffness',
      'damping',
      'impulseClipDuration',
    ].some((key) => (config as Record<string, unknown>)[key] !== undefined);

    if (idleChanged) {
      this.idleClipDirty = true;
    }
    if (impulseChanged) {
      this.impulseClipDirty = true;
    }

    if (this.hairPhysicsEnabled) {
      if (idleChanged) this.startIdleClip();
      if (impulseChanged) this.buildImpulseClips();
    }
  }

  getHairPhysicsConfig(): HairPhysicsConfig {
    return { ...this.hairPhysicsConfig };
  }

  update(dtSeconds: number): void {
    if (!this.hairPhysicsEnabled) return;
    if (!this.supportsMixerClips()) return;
  }

  onHeadRotationChanged(yaw: number, pitch: number): void {
    if (!this.hairPhysicsEnabled) return;
    if (!this.supportsMixerClips()) return;
    this.updateGravityFromHeadPitch(pitch);
    this.triggerHeadImpulse(yaw, pitch);
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

  private supportsMixerClips(): boolean {
    return typeof this.host.buildClip === 'function';
  }

  private startIdleClip(): void {
    if (!this.hairPhysicsEnabled || !this.supportsMixerClips()) return;

    const cfg = this.hairPhysicsConfig;
    const hasWind = cfg.windStrength > 0;
    const hasIdle = cfg.idleSwayAmount > 0;
    if (!hasWind && !hasIdle) {
      this.stopIdleClip();
      this.idleClipDirty = false;
      return;
    }

    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    if (!this.idleClipDirty && this.idleClipHandle) return;

    this.stopIdleClip();

    const duration = Math.max(0.5, cfg.idleClipDuration);
    const curves = this.buildIdleWindCurves(duration);
    const handle = this.host.buildClip?.(this.idleClipName, curves, {
      loop: true,
      loopMode: 'repeat',
      meshNames: hairMeshNames,
    });

    if (!handle) return;

    handle.setWeight?.(1);
    this.idleClipHandle = handle;
    this.idleClipDirty = false;
  }

  private startGravityClip(): void {
    if (!this.hairPhysicsEnabled || !this.supportsMixerClips()) return;

    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    if (!this.gravityClipDirty && this.gravityClipHandle) return;

    this.stopGravityClip();

    const curves: CurvesMap = {
      // Head up (time=0) -> pull hair back/up a bit via hairline + length reduction
      Hairline_High_ALL: [
        { time: 0, intensity: 0.45 },
        { time: 0.5, intensity: 0 },
        { time: 1, intensity: 0 },
      ],
      Length_Short: [
        { time: 0, intensity: 0.65 },
        { time: 0.5, intensity: 0 },
        { time: 1, intensity: 0 },
      ],
      // Head down (time=1) -> push the long section forward strongly
      L_Hair_Front: [
        { time: 0, intensity: 0 },
        { time: 0.5, intensity: 0 },
        { time: 1, intensity: 1.8 },
      ],
      Fluffy_Bottom_ALL: [
        { time: 0, intensity: 0 },
        { time: 0.5, intensity: 0 },
        { time: 1, intensity: 1.0 },
      ],
    };

    const handle = this.host.buildClip?.(this.gravityClipName, curves, {
      loop: false,
      loopMode: 'once',
      meshNames: hairMeshNames,
    });

    if (!handle) return;

    handle.setWeight?.(1);
    handle.pause();
    handle.setTime?.(0.5);
    this.gravityClipHandle = handle;
    this.gravityClipDirty = false;
  }

  private stopIdleClip(): void {
    if (this.idleClipHandle) {
      const clipName = this.idleClipHandle.clipName;
      this.idleClipHandle.stop();
      this.host.cleanupSnippet?.(clipName);
      this.idleClipHandle = null;
    } else {
      this.host.cleanupSnippet?.(this.idleClipName);
    }
  }

  private stopGravityClip(): void {
    if (this.gravityClipHandle) {
      const clipName = this.gravityClipHandle.clipName;
      this.gravityClipHandle.stop();
      this.host.cleanupSnippet?.(clipName);
      this.gravityClipHandle = null;
    } else {
      this.host.cleanupSnippet?.(this.gravityClipName);
    }
  }

  private buildImpulseClips(): void {
    if (!this.hairPhysicsEnabled || !this.supportsMixerClips()) return;

    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    if (!this.impulseClipDirty && this.impulseClips.left && this.impulseClips.right && this.impulseClips.front) {
      return;
    }

    this.stopImpulseClips();

    const duration = Math.max(0.25, this.hairPhysicsConfig.impulseClipDuration);
    const options: ClipOptions = {
      loop: false,
      loopMode: 'once',
      meshNames: hairMeshNames,
    };

    const leftHandle = this.host.buildClip?.(
      this.impulseClipNames.left,
      this.buildImpulseCurves(duration, 1, 0),
      options
    );
    const rightHandle = this.host.buildClip?.(
      this.impulseClipNames.right,
      this.buildImpulseCurves(duration, -1, 0),
      options
    );
    const frontHandle = this.host.buildClip?.(
      this.impulseClipNames.front,
      this.buildImpulseCurves(duration, 0, 1),
      options
    );

    const primeHandle = (handle: ClipHandle | null | undefined) => {
      if (!handle) return;
      handle.setWeight?.(0);
      handle.pause();
      handle.setTime?.(0);
    };

    primeHandle(leftHandle);
    primeHandle(rightHandle);
    primeHandle(frontHandle);

    this.impulseClips = {
      left: leftHandle ?? undefined,
      right: rightHandle ?? undefined,
      front: frontHandle ?? undefined,
    };
    this.impulseClipDirty = false;
  }

  private stopImpulseClips(): void {
    this.clearImpulseTimers();
    const handles = Object.values(this.impulseClips);
    for (const handle of handles) {
      if (!handle) continue;
      const clipName = handle.clipName;
      handle.stop();
      this.host.cleanupSnippet?.(clipName);
    }
    this.impulseClips = {};
  }

  private clearImpulseTimers(slot?: 'left' | 'right' | 'front'): void {
    const slots: Array<'left' | 'right' | 'front'> = slot ? [slot] : ['left', 'right', 'front'];
    for (const key of slots) {
      const endTimer = this.impulseEndTimers[key];
      if (endTimer) {
        clearTimeout(endTimer);
        delete this.impulseEndTimers[key];
      }
      const steps = this.impulseFadeSteps[key];
      if (steps && steps.length > 0) {
        steps.forEach((t) => clearTimeout(t));
        delete this.impulseFadeSteps[key];
      }
    }
  }

  private triggerHeadImpulse(headYaw: number, headPitch: number): void {
    const cfg = this.hairPhysicsConfig;
    const horizontal = -headYaw * cfg.inertia * cfg.responseScale;
    const vertical = headPitch * cfg.gravity * 0.25 * cfg.responseScale;

    if (!this.hasHeadState) {
      this.hasHeadState = true;
      this.lastHeadHorizontal = horizontal;
      this.lastHeadVertical = vertical;
      return;
    }

    const deltaHorizontal = horizontal - this.lastHeadHorizontal;
    const deltaVertical = vertical - this.lastHeadVertical;
    this.lastHeadHorizontal = horizontal;
    this.lastHeadVertical = vertical;

    const leftWeight = clamp01(deltaHorizontal > 0 ? deltaHorizontal : 0);
    const rightWeight = clamp01(deltaHorizontal < 0 ? -deltaHorizontal : 0);
    const frontWeight = clamp01(deltaVertical > 0 ? deltaVertical : 0);
    const minTrigger = 0.01;

    if (leftWeight <= minTrigger && rightWeight <= minTrigger && frontWeight <= minTrigger) return;

    if (this.impulseClipDirty) {
      this.buildImpulseClips();
    }

    if (leftWeight > minTrigger) this.playImpulseClip('left', leftWeight);
    if (rightWeight > minTrigger) this.playImpulseClip('right', rightWeight);
    if (frontWeight > minTrigger) this.playImpulseClip('front', frontWeight);
  }

  private updateGravityFromHeadPitch(headPitch: number): void {
    if (!this.gravityClipHandle || this.gravityClipDirty) {
      this.startGravityClip();
    }
    if (!this.gravityClipHandle) return;

    const clampedPitch = Math.max(-1, Math.min(1, headPitch));
    const normalized = (clampedPitch + 1) / 2;
    const duration = this.gravityClipHandle.getDuration?.() ?? 1;
    this.gravityClipHandle.setTime?.(normalized * duration);
  }

  private playImpulseClip(slot: 'left' | 'right' | 'front', weight: number): void {
    const handle = this.impulseClips[slot];
    if (!handle) return;
    this.clearImpulseTimers(slot);
    handle.setWeight?.(weight);
    handle.play();
    const durationSec = handle.getDuration?.() ?? this.hairPhysicsConfig.impulseClipDuration;
    const durationMs = Math.max(0, durationSec) * 1000;
    const fadeMs = Math.max(80, Math.min(350, durationMs * 0.2));
    this.impulseEndTimers[slot] = setTimeout(() => {
      this.fadeImpulseClip(slot, weight, fadeMs);
    }, durationMs);
  }

  private fadeImpulseClip(slot: 'left' | 'right' | 'front', startWeight: number, fadeMs: number): void {
    const handle = this.impulseClips[slot];
    if (!handle) return;
    if (fadeMs <= 0) {
      handle.setWeight?.(0);
      handle.pause();
      handle.setTime?.(0);
      return;
    }

    const steps = 6;
    const stepMs = fadeMs / steps;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= steps; i += 1) {
      const timer = setTimeout(() => {
        const nextWeight = startWeight * (1 - i / steps);
        handle.setWeight?.(nextWeight);
        if (i === steps) {
          handle.pause();
          handle.setTime?.(0);
        }
      }, stepMs * i);
      timers.push(timer);
    }

    this.impulseFadeSteps[slot] = timers;
  }

  private buildIdleWindCurves(durationSec: number): CurvesMap {
    const cfg = this.hairPhysicsConfig;
    const curves: CurvesMap = {};
    const sampleCount = Math.max(16, Math.min(120, Math.round(durationSec * 12)));
    const hasWind = cfg.windStrength > 0;
    const hasIdle = cfg.idleSwayAmount > 0;
    const windScale = cfg.windStrength * 0.1;

    const pushPoint = (key: string, time: number, intensity: number) => {
      if (!curves[key]) curves[key] = [];
      curves[key].push({ time, intensity });
    };

    for (let i = 0; i <= sampleCount; i += 1) {
      const t = (durationSec * i) / sampleCount;

      const idleOffset = hasIdle
        ? Math.sin(t * cfg.idleSwaySpeed * Math.PI * 2) * cfg.idleSwayAmount
        : 0;

      let windOffsetX = 0;
      let windOffsetZ = 0;
      if (hasWind) {
        const basePhase = t * cfg.windFrequency * Math.PI * 2;
        const primaryWave = Math.sin(basePhase);
        const secondaryWave = Math.sin(basePhase * 1.7) * 0.3;
        const turbulenceWave = Math.sin(basePhase * 3.3) * cfg.windTurbulence * 0.2;
        const waveStrength = primaryWave + secondaryWave + turbulenceWave;
        windOffsetX = cfg.windDirectionX * waveStrength * windScale;
        windOffsetZ = cfg.windDirectionZ * waveStrength * windScale;
      }

      const combinedX = idleOffset + windOffsetX;
      const combinedZ = windOffsetZ;

      const leftValue = clamp01(combinedX > 0 ? combinedX : 0);
      const rightValue = clamp01(combinedX < 0 ? -combinedX : 0);
      const frontValue = clamp01(combinedZ > 0 ? combinedZ : 0);
      const fluffyRightValue = clamp01(rightValue * 0.7);
      const movementIntensity = Math.abs(combinedX) + Math.abs(combinedZ);
      const fluffyBottomValue = clamp01(movementIntensity * 0.25);

      pushPoint('L_Hair_Left', t, leftValue);
      pushPoint('L_Hair_Right', t, rightValue);
      pushPoint('L_Hair_Front', t, frontValue);
      pushPoint('Fluffy_Right', t, fluffyRightValue);
      pushPoint('Fluffy_Bottom_ALL', t, fluffyBottomValue);
    }

    for (const points of Object.values(curves)) {
      if (points.length > 1) {
        points[points.length - 1].intensity = points[0].intensity;
      }
    }

    return curves;
  }

  private buildImpulseCurves(durationSec: number, horizontal: number, vertical: number): CurvesMap {
    const cfg = this.hairPhysicsConfig;
    const curves: CurvesMap = {};
    const sampleCount = Math.max(12, Math.min(90, Math.round(durationSec * 30)));
    const frequency = Math.max(0.5, cfg.stiffness * 0.2);
    const decay = Math.max(0.1, cfg.damping * 4);
    const omega = Math.PI * 2 * frequency;

    const pushPoint = (key: string, time: number, intensity: number) => {
      if (!curves[key]) curves[key] = [];
      curves[key].push({ time, intensity });
    };

    for (let i = 0; i <= sampleCount; i += 1) {
      const t = (durationSec * i) / sampleCount;
      const wave = Math.cos(omega * t) * Math.exp(-decay * t);
      const horizontalValue = horizontal * wave;
      const verticalValue = vertical * wave;

      const leftValue = clamp01(horizontalValue > 0 ? horizontalValue : 0);
      const rightValue = clamp01(horizontalValue < 0 ? -horizontalValue : 0);
      const frontValue = clamp01(verticalValue > 0 ? verticalValue : 0);
      const fluffyRightValue = clamp01(rightValue * 0.7);
      const movementIntensity = Math.abs(horizontalValue) + Math.abs(verticalValue);
      const fluffyBottomValue = clamp01(movementIntensity * 0.25);

      pushPoint('L_Hair_Left', t, leftValue);
      pushPoint('L_Hair_Right', t, rightValue);
      pushPoint('L_Hair_Front', t, frontValue);
      pushPoint('Fluffy_Right', t, fluffyRightValue);
      pushPoint('Fluffy_Bottom_ALL', t, fluffyBottomValue);
    }

    for (const points of Object.values(curves)) {
      if (points.length > 0) {
        points[points.length - 1].intensity = 0;
      }
    }

    return curves;
  }

}
