/**
 * Hair Service
 *
 * Service layer for managing hair customization.
 * Bridges the XState machine with EngineThree for rendering updates.
 * Part of the latticework agency architecture.
 *
 * NOTE: This service is engine-agnostic - it does not import Three.js.
 * All rendering operations are delegated to EngineThree.
 */

import { createActor } from 'xstate';
import { hairMachine } from './hairMachine';
import { HairObjectRef, HairEvent, HairState } from './types';
import type { EngineThree } from '../../engine/EngineThree';

export class HairService {
  private actor: ReturnType<typeof createActor<typeof hairMachine>>;
  private objects: HairObjectRef[] = [];
  private subscribers: Set<(state: HairState) => void> = new Set();
  private engine: EngineThree | null = null;

  constructor(engine?: EngineThree) {
    this.actor = createActor(hairMachine);
    this.engine = engine || null;

    // Subscribe to state changes
    this.actor.subscribe((snapshot) => {
      const state = snapshot.context.state;

      // Apply changes via engine
      this.applyStateToScene(state);

      // Notify subscribers
      this.subscribers.forEach((callback) => callback(state));
    });

    this.actor.start();
  }

  /**
   * Register hair/eyebrow objects from the scene
   * Delegates all Three.js operations to EngineThree
   */
  registerObjects(objects: any[]) {
    if (!this.engine) {
      console.warn('[HairService] No engine available for registration');
      return;
    }

    // Delegate registration to engine - returns engine-agnostic metadata
    this.objects = this.engine.registerHairObjects(objects);

    // Reset to default state
    this.actor.send({ type: 'RESET_TO_DEFAULT' } as HairEvent);

    // Apply initial state
    this.applyStateToScene(this.getState());
  }

  /**
   * Send an event to the state machine
   */
  send(event: HairEvent) {
    this.actor.send(event);
  }

  /**
   * Get current hair state
   */
  getState(): HairState {
    return this.actor.getSnapshot().context.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: HairState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Apply the current state to the scene via EngineThree
   * No direct Three.js manipulation - all operations delegated to engine
   */
  private applyStateToScene(state: HairState) {
    if (!this.engine) return;

    this.objects.forEach((objRef) => {
      const { name, isEyebrow, isMesh } = objRef;

      // Only apply to meshes
      if (!isMesh) return;

      // Select color based on object type
      const color = isEyebrow ? state.eyebrowColor : state.hairColor;

      // Get part-specific state
      const partState = state.parts[name];

      // Build state object for engine
      const objectState = {
        color: {
          baseColor: color.baseColor,
          emissive: color.emissive,
          emissiveIntensity: color.emissiveIntensity,
        },
        outline: {
          show: state.showOutline,
          color: state.outlineColor,
          opacity: state.outlineOpacity,
        },
        visible: partState?.visible ?? true,  // Default to visible if no part state
        scale: partState?.scale,
        position: partState?.position,
        isEyebrow: isEyebrow,
      };

      // Delegate all rendering to engine
      this.engine.applyHairStateToObject(name, objectState);
    });
  }

  /**
   * Cleanup
   */
  dispose() {
    this.actor.stop();
    this.subscribers.clear();

    // Engine handles all Three.js cleanup
    // We just clear our references
    this.objects = [];
  }
}
