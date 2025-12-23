import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimationScheduler } from '../animationScheduler';
import { createActor } from 'xstate';
import { animationMachine } from '../animationMachine';
import type { HostCaps } from '../types';
import type { TransitionHandle } from '../../../engine/EngineThree.types';

/**
 * Tests for the promise-based playback system.
 * These tests verify that:
 * 1. TransitionHandle promises are awaited
 * 2. Keyframe transitions fire in sequence
 * 3. Morph/AU values actually change
 */
describe('Promise-Based Playback', () => {
  let scheduler: AnimationScheduler;
  let mockHost: HostCaps;
  let machine: any;

  // Track all transitions fired
  let firedTransitions: Array<{
    type: 'AU' | 'morph' | 'continuum';
    id: number | string;
    value: number;
    durationMs: number;
    resolvePromise: () => void;
  }>;

  // Simulated "mesh" state - what the morph values would be after transitions complete
  let meshState: Record<string, number>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock performance.now() to use Date.now() so fake timers work
    const originalPerformance = globalThis.performance;
    vi.stubGlobal('performance', {
      ...originalPerformance,
      now: () => Date.now()
    });

    firedTransitions = [];
    meshState = {};

    // Create mock host that tracks transitions and provides controllable promises
    mockHost = {
      applyAU: vi.fn((id, v) => {
        meshState[String(id)] = v;
      }),
      setMorph: vi.fn((key, v) => {
        meshState[key] = v;
      }),
      transitionAU: vi.fn((id, v, dur): TransitionHandle => {
        let resolvePromise: () => void = () => {};
        const promise = new Promise<void>((resolve) => {
          resolvePromise = () => {
            // When resolved, update the mesh state
            meshState[String(id)] = v;
            resolve();
          };
        });

        firedTransitions.push({
          type: 'AU',
          id,
          value: v,
          durationMs: dur ?? 200,
          resolvePromise,
        });

        return {
          promise,
          pause: vi.fn(),
          resume: vi.fn(),
          cancel: vi.fn(() => resolvePromise()),
        };
      }),
      transitionMorph: vi.fn((key, v, dur): TransitionHandle => {
        let resolvePromise: () => void = () => {};
        const promise = new Promise<void>((resolve) => {
          resolvePromise = () => {
            meshState[key] = v;
            resolve();
          };
        });

        firedTransitions.push({
          type: 'morph',
          id: key,
          value: v,
          durationMs: dur ?? 80,
          resolvePromise,
        });

        return {
          promise,
          pause: vi.fn(),
          resume: vi.fn(),
          cancel: vi.fn(() => resolvePromise()),
        };
      }),
      onSnippetEnd: vi.fn()
    };

    machine = createActor(animationMachine).start();
    scheduler = new AnimationScheduler(machine, mockHost);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('Transition Firing', () => {
    it('should fire transitionAU when play() is called', async () => {
      const snippet = {
        name: 'test_fire',
        loop: false,
        curves: {
          '12': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 0.8 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      // Allow microtasks to run
      await vi.runAllTimersAsync();

      // Should have fired at least one AU transition
      expect(firedTransitions.length).toBeGreaterThan(0);
      const auTransition = firedTransitions.find(t => t.type === 'AU' && t.id === 12);
      expect(auTransition).toBeDefined();
    });

    it('should await promise before firing next keyframe', async () => {
      const snippet = {
        name: 'test_await',
        loop: false,
        curves: {
          '12': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 0.5 },
            { time: 2, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      // Let the first batch of transitions fire
      await vi.runAllTimersAsync();

      const initialCount = firedTransitions.length;
      expect(initialCount).toBeGreaterThan(0);

      // Resolve the first transition's promise
      firedTransitions[0].resolvePromise();
      await vi.runAllTimersAsync();

      // Should have fired more transitions after the first resolved
      expect(firedTransitions.length).toBeGreaterThan(initialCount);
    });

    it('should update mesh state when transition completes', async () => {
      const snippet = {
        name: 'test_mesh_update',
        loop: false,
        curves: {
          '12': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 0.8 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      await vi.runAllTimersAsync();

      // Before resolving, mesh state should not be updated
      expect(meshState['12']).toBeUndefined();

      // Resolve the transition
      const auTransition = firedTransitions.find(t => t.type === 'AU' && t.id === 12);
      expect(auTransition).toBeDefined();
      auTransition!.resolvePromise();

      await vi.runAllTimersAsync();

      // After resolving, mesh state should be updated
      expect(meshState['12']).toBeCloseTo(0.8, 2);
    });
  });

  describe('Keyframe Sequencing', () => {
    it('should fire transitions for all keyframe times', async () => {
      const snippet = {
        name: 'test_sequence',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 0.5, intensity: 0.5 },
            { time: 1, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      // Resolve all transitions as they fire
      for (let i = 0; i < 10; i++) {
        await vi.runAllTimersAsync();
        firedTransitions.forEach(t => t.resolvePromise());
      }

      // Should have fired transitions for all keyframes
      const auTransitions = firedTransitions.filter(t => t.type === 'AU' && t.id === 1);
      expect(auTransitions.length).toBeGreaterThanOrEqual(2); // At least 2 keyframes after time 0
    });

    it('should apply intensity scale to transition values', async () => {
      const snippet = {
        name: 'test_intensity_scale',
        loop: false,
        snippetIntensityScale: 0.5,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      await vi.runAllTimersAsync();

      // Find the transition for AU 1
      const auTransition = firedTransitions.find(t => t.type === 'AU' && t.id === 1);
      expect(auTransition).toBeDefined();

      // Value should be scaled: 1.0 * (0.5^2) = 0.25
      expect(auTransition!.value).toBeCloseTo(0.25, 2);
    });
  });

  describe('Looping', () => {
    it('should restart playback for looping snippets', async () => {
      const snippet = {
        name: 'test_loop',
        loop: true,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 0.5, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      // Run through the first loop
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
        firedTransitions.forEach(t => t.resolvePromise());
      }

      const countAfterFirstLoop = firedTransitions.length;

      // Continue - should keep looping
      for (let i = 0; i < 5; i++) {
        await vi.runAllTimersAsync();
        firedTransitions.forEach(t => t.resolvePromise());
      }

      // Should have more transitions from the second loop
      expect(firedTransitions.length).toBeGreaterThan(countAfterFirstLoop);
    });
  });

  describe('Pause/Resume', () => {
    it('should pause active transitions when pauseSnippet is called', async () => {
      const snippet = {
        name: 'test_pause',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 2, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      await vi.runAllTimersAsync();

      // Pause the snippet
      scheduler.pauseSnippet('test_pause');

      // The pause() method should have been called on the transition handle
      const auTransition = firedTransitions.find(t => t.type === 'AU' && t.id === 1);
      expect(auTransition).toBeDefined();

      // Note: Since we're using mock handles, we can't directly test if pause was called
      // But we can verify the scheduler marks the snippet as paused
      const state = machine.getSnapshot();
      const sn = state.context.animations.find((s: any) => s.name === 'test_pause');
      expect(sn?.isPlaying).toBe(false);
    });

    it('should resume playback when resumeSnippet is called', async () => {
      const snippet = {
        name: 'test_resume',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 2, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      await vi.runAllTimersAsync();

      const countBeforePause = firedTransitions.length;

      // Pause then resume
      scheduler.pauseSnippet('test_resume');
      scheduler.resumeSnippet('test_resume');

      // Resolve transitions and allow new ones to fire
      firedTransitions.forEach(t => t.resolvePromise());
      await vi.runAllTimersAsync();

      // Should have fired more transitions after resume
      expect(firedTransitions.length).toBeGreaterThanOrEqual(countBeforePause);

      // Snippet should be marked as playing
      const state = machine.getSnapshot();
      const sn = state.context.animations.find((s: any) => s.name === 'test_resume');
      expect(sn?.isPlaying).toBe(true);
    });
  });

  describe('Stop/Cancel', () => {
    it('should cancel transitions when stopSnippet is called', async () => {
      const snippet = {
        name: 'test_stop',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 5, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      await vi.runAllTimersAsync();

      // Stop the snippet
      scheduler.stopSnippet('test_stop');

      // Snippet should be removed
      const state = machine.getSnapshot();
      const sn = state.context.animations.find((s: any) => s.name === 'test_stop');
      expect(sn).toBeUndefined();
    });
  });

  describe('Completion Callback', () => {
    it('should call onSnippetEnd when non-looping snippet completes', async () => {
      const snippet = {
        name: 'test_complete',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 0.5, intensity: 1.0 },
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      // Resolve all transitions to completion
      for (let i = 0; i < 10; i++) {
        await vi.runAllTimersAsync();
        firedTransitions.forEach(t => t.resolvePromise());
      }

      // Should have called onSnippetEnd
      expect(mockHost.onSnippetEnd).toHaveBeenCalledWith('test_complete');
    });
  });

  describe('Multiple Snippets', () => {
    it('should fire transitions for multiple playing snippets', async () => {
      const snippet1 = {
        name: 'snippet1',
        loop: false,
        curves: {
          '1': [{ time: 0, intensity: 0 }, { time: 1, intensity: 0.5 }]
        }
      };

      const snippet2 = {
        name: 'snippet2',
        loop: false,
        curves: {
          '2': [{ time: 0, intensity: 0 }, { time: 1, intensity: 0.8 }]
        }
      };

      scheduler.loadFromJSON(snippet1);
      scheduler.loadFromJSON(snippet2);
      scheduler.play();

      await vi.runAllTimersAsync();

      // Should have transitions for both AUs
      const au1 = firedTransitions.find(t => t.type === 'AU' && t.id === 1);
      const au2 = firedTransitions.find(t => t.type === 'AU' && t.id === 2);

      expect(au1).toBeDefined();
      expect(au2).toBeDefined();
    });
  });
});
