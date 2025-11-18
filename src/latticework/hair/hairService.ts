/**
 * Hair Service
 *
 * Service layer for managing hair customization.
 * Bridges the XState machine with Three.js scene updates.
 * Part of the latticework agency architecture.
 */

import * as THREE from 'three';
import { createActor } from 'xstate';
import { hairMachine } from './hairMachine';
import { HairObjectRef, HairColor, HairEvent, HairState } from './types';

export class HairService {
  private actor: ReturnType<typeof createActor<typeof hairMachine>>;
  private objects: HairObjectRef[] = [];
  private subscribers: Set<(state: HairState) => void> = new Set();

  constructor() {
    this.actor = createActor(hairMachine);

    // Subscribe to state changes
    this.actor.subscribe((snapshot) => {
      const state = snapshot.context.state;

      // Apply changes to Three.js objects
      this.applyStateToScene(state);

      // Notify subscribers
      this.subscribers.forEach((callback) => callback(state));
    });

    this.actor.start();
  }

  /**
   * Register hair/eyebrow objects from the Three.js scene
   */
  registerObjects(objects: THREE.Object3D[]) {
    this.objects = objects.map((obj) => {
      // Detect if this is an eyebrow based on name
      const nameLower = obj.name.toLowerCase();

      // Check for eyebrow patterns (including "Male_Bushy" which are eyebrows)
      const isEyebrow = nameLower.includes('eyebrow') ||
                       nameLower.includes('brow') ||
                       nameLower.includes('male_bushy') ||
                       nameLower === 'male_bushy';

      const ref: HairObjectRef = {
        name: obj.name,
        object: obj,
        isEyebrow: isEyebrow,
      };

      // If it's a mesh, store reference to mesh and original material
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        ref.mesh = mesh;
        ref.originalMaterial = mesh.material;
      }

      return ref;
    });

    // Update machine context with objects
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
   * Apply the current state to the Three.js scene
   */
  private applyStateToScene(state: HairState) {
    this.objects.forEach((objRef) => {
      const { mesh, object, isEyebrow } = objRef;

      // Apply color - use eyebrowColor for eyebrows, hairColor for hair
      if (mesh && mesh.material) {
        const colorToApply = isEyebrow ? state.eyebrowColor : state.hairColor;
        this.applyColorToMesh(mesh, colorToApply);
      }

      // Apply outline
      this.applyOutline(objRef, state.showOutline, state.outlineColor, state.outlineOpacity);

      // Apply part-specific settings
      const partState = state.parts[object.name];
      if (partState) {
        object.visible = partState.visible;

        if (partState.scale !== undefined) {
          object.scale.setScalar(partState.scale);
        }

        if (partState.position) {
          const [x, y, z] = partState.position;
          object.position.set(x, y, z);
        }
      }
    });
  }

  /**
   * Apply color to a hair mesh
   */
  private applyColorToMesh(mesh: THREE.Mesh, color: HairColor) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat) => {
      const standardMat = mat as THREE.MeshStandardMaterial;

      // Set base color
      if (standardMat.color !== undefined) {
        standardMat.color = new THREE.Color(color.baseColor);
      }

      // Set emissive glow
      if (standardMat.emissive !== undefined) {
        standardMat.emissive = new THREE.Color(color.emissive);
        standardMat.emissiveIntensity = color.emissiveIntensity;
      }
    });
  }

  /**
   * Apply or remove outline wireframe
   */
  private applyOutline(
    objRef: HairObjectRef,
    show: boolean,
    color: string,
    opacity: number
  ) {
    const { mesh } = objRef;
    if (!mesh) return;

    // Remove existing wireframe if present
    if (objRef.wireframe) {
      mesh.remove(objRef.wireframe);
      objRef.wireframe.geometry.dispose();
      (objRef.wireframe.material as THREE.Material).dispose();
      objRef.wireframe = undefined;
    }

    // Add wireframe if requested
    if (show) {
      const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2,
        transparent: true,
        opacity: opacity,
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      wireframe.name = `${mesh.name}_wireframe`;
      mesh.add(wireframe);
      objRef.wireframe = wireframe;
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    this.actor.stop();
    this.subscribers.clear();

    // Clean up wireframes
    this.objects.forEach((objRef) => {
      if (objRef.wireframe && objRef.mesh) {
        objRef.mesh.remove(objRef.wireframe);
        objRef.wireframe.geometry.dispose();
        (objRef.wireframe.material as THREE.Material).dispose();
      }
    });
  }
}
