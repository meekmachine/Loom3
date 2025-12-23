import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimationScheduler } from '../animationScheduler';
import { createActor } from 'xstate';
import { animationMachine } from '../animationMachine';
import type { HostCaps } from '../types';
import type { TransitionHandle } from '../../../engine/EngineThree.types';

/**
 * Tests for AnimationScheduler core functionality.
 *
 * Note: The scheduler now uses promise-based playback. These tests focus on:
 * - Loading/removing snippets
 * - Seek functionality (now includes immediate value application for scrubbing)
 * - Schedule snapshot
 * - Priority resolution
 *
 * For playback and transition tests, see promisePlayback.test.ts and scrubberAndReplay.test.ts
 */
describe('AnimationScheduler', () => {
  let scheduler: AnimationScheduler;
  let mockHost: HostCaps;
  let appliedAUs: Array<{ id: number | string; value: number; duration?: number }>;
  let machine: any;
  let firedTransitions: Array<{ resolve: () => void }>;

  beforeEach(() => {
    vi.useFakeTimers();

    const originalPerformance = globalThis.performance;
    vi.stubGlobal('performance', {
      ...originalPerformance,
      now: () => Date.now()
    });

    appliedAUs = [];
    firedTransitions = [];

    const createHandle = (): TransitionHandle => {
      let resolvePromise: () => void = () => {};
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      firedTransitions.push({ resolve: resolvePromise });
      return {
        promise,
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(() => resolvePromise()),
      };
    };

    mockHost = {
      applyAU: vi.fn((id, v) => {
        appliedAUs.push({ id, value: v });
      }),
      setMorph: vi.fn(),
      transitionAU: vi.fn((id, v, dur) => {
        appliedAUs.push({ id, value: v, duration: dur });
        return createHandle();
      }),
      transitionMorph: vi.fn(() => createHandle()),
      onSnippetEnd: vi.fn()
    };

    machine = createActor(animationMachine).start();
    scheduler = new AnimationScheduler(machine, mockHost);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('Loading and Machine State', () => {
    it('should load a snippet with curves', () => {
      const snippet = {
        name: 'test_snippet',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1 },
            { time: 2, intensity: 0 }
          ]
        }
      };

      const name = scheduler.loadFromJSON(snippet);
      expect(name).toBe('test_snippet');

      const state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);
      expect(state.context.animations[0].name).toBe('test_snippet');
    });

    it('should calculate correct duration from keyframes', () => {
      const snippet = {
        name: 'test_duration',
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 5, intensity: 1 }
          ],
          '2': [
            { time: 0, intensity: 0 },
            { time: 3, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      const snapshot = scheduler.getScheduleSnapshot();

      // Duration should be the max time across all curves
      expect(snapshot[0].duration).toBe(5);
    });

    it('should return isPlaying true when play() is called', () => {
      const snippet = {
        name: 'test_play',
        curves: {
          '1': [{ time: 0, intensity: 0.5 }]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      expect(scheduler.isPlaying()).toBe(true);
    });

    it('should remove snippet by name', () => {
      const snippet = {
        name: 'to_remove',
        curves: { '1': [{ time: 0, intensity: 0 }] }
      };

      scheduler.loadFromJSON(snippet);

      let state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);

      scheduler.remove('to_remove');

      state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(0);
    });

    it('should normalize old-format snippets with au/viseme arrays', () => {
      const oldFormatSnippet = {
        name: 'old_format',
        au: [
          { id: 1, t: 0, v: 0 },
          { id: 1, t: 1, v: 100 } // percentage format
        ]
      };

      scheduler.loadFromJSON(oldFormatSnippet);
      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      // Should have converted to curves format
      expect(sn.curves).toBeDefined();
      expect(sn.curves['1']).toBeDefined();
      expect(sn.curves['1'][1].intensity).toBe(1); // normalized from 100
    });
  });

  describe('Seek Functionality', () => {
    it('should seek to specific time', () => {
      const snippet = {
        name: 'test_seek',
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 5, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.seek('test_seek', 2.5);

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      expect(sn.currentTime).toBe(2.5);
    });

    it('should clamp seek to non-negative', () => {
      const snippet = {
        name: 'test_seek_negative',
        curves: {
          '1': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.seek('test_seek_negative', -5);

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      expect(sn.currentTime).toBe(0);
    });

    it('should clear ended flag when seeking', () => {
      const snippet = {
        name: 'test_seek_clear_ended',
        loop: false,
        curves: {
          '1': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }]
        }
      };

      scheduler.loadFromJSON(snippet);

      // Seek to beginning should enable the snippet
      scheduler.seek('test_seek_clear_ended', 0);

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      expect(sn.isPlaying).toBe(true);
    });
  });

  describe('Schedule Snapshot', () => {
    it('should return schedule snapshot with all snippets', () => {
      scheduler.loadFromJSON({ name: 'sn1', curves: { '1': [{ time: 0, intensity: 0 }, { time: 2, intensity: 1 }] } });
      scheduler.loadFromJSON({ name: 'sn2', curves: { '2': [{ time: 0, intensity: 0 }, { time: 3, intensity: 1 }] } });

      const snapshot = scheduler.getScheduleSnapshot();

      expect(snapshot).toHaveLength(2);
      expect(snapshot[0].name).toBe('sn1');
      expect(snapshot[0].duration).toBe(2);
      expect(snapshot[1].name).toBe('sn2');
      expect(snapshot[1].duration).toBe(3);
    });

    it('should include playbackRate and intensityScale in snapshot', () => {
      scheduler.loadFromJSON({
        name: 'test_snapshot',
        snippetPlaybackRate: 2.0,
        snippetIntensityScale: 0.5,
        curves: { '1': [{ time: 0, intensity: 0 }] }
      });

      const snapshot = scheduler.getScheduleSnapshot();

      expect(snapshot[0].playbackRate).toBe(2.0);
      expect(snapshot[0].intensityScale).toBe(0.5);
    });
  });

  describe('Seek with Immediate Apply', () => {
    it('should apply values immediately when seeking (scrubbing)', async () => {
      const snippet = {
        name: 'test_scrub',
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 0.8 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      appliedAUs = [];

      // seek() now internally applies values immediately via applyAU
      scheduler.seek('test_scrub', 0.5);

      await vi.runAllTimersAsync();

      // Should have called applyAU (immediate, not transitionAU)
      expect(mockHost.applyAU).toHaveBeenCalled();
      expect(appliedAUs.length).toBeGreaterThan(0);
      const au1 = appliedAUs.find(a => a.id === 1);
      expect(au1).toBeDefined();
      // At t=0.5, interpolated value should be ~0.4
      expect(au1!.value).toBeCloseTo(0.4, 1);
    });

    it('should apply values even on paused snippets', async () => {
      const snippet = {
        name: 'test_scrub_paused',
        curves: {
          '1': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }]
        }
      };

      scheduler.loadFromJSON(snippet);

      // Mark as paused
      const state = machine.getSnapshot();
      const sn = state.context.animations[0];
      sn.isPlaying = false;

      appliedAUs = [];
      scheduler.seek('test_scrub_paused', 0.5);

      await vi.runAllTimersAsync();

      // Should still apply values even when paused (scrubbing works on paused snippets)
      expect(mockHost.applyAU).toHaveBeenCalled();
      expect(appliedAUs.length).toBeGreaterThan(0);
    });
  });

  describe('getCurrentValue()', () => {
    it('should return 0 for AUs that have never been set', () => {
      expect(scheduler.getCurrentValue('999')).toBe(0);
    });

    it('should return tracked value after seek', async () => {
      const snippet = {
        name: 'test_current_value',
        curves: {
          // Use time > 0 to avoid continuity feature replacing first keyframe
          '5': [{ time: 0, intensity: 0 }, { time: 0.01, intensity: 0.7 }]
        }
      };

      scheduler.loadFromJSON(snippet);
      // seek() now applies values immediately and tracks currentValues
      scheduler.seek('test_current_value', 0.01);

      await vi.runAllTimersAsync();

      // Should track the value
      const value = scheduler.getCurrentValue('5');
      expect(value).toBeCloseTo(0.7, 2);
    });
  });

  describe('Priority Resolution (via seek)', () => {
    it('should resolve conflicts by priority', async () => {
      const highPriority = {
        name: 'high',
        snippetPriority: 10,
        curves: {
          '1': [{ time: 0.01, intensity: 0.3 }]
        }
      };

      const lowPriority = {
        name: 'low',
        snippetPriority: 1,
        curves: {
          '1': [{ time: 0.01, intensity: 0.8 }]
        }
      };

      scheduler.loadFromJSON(lowPriority);
      scheduler.loadFromJSON(highPriority);

      // Seek both to time 0.01 to hit the keyframes
      // Note: The last seek() call applies all snippets' values immediately
      appliedAUs = [];
      scheduler.seek('low', 0.01);
      scheduler.seek('high', 0.01);

      await vi.runAllTimersAsync();

      // High priority should win even with lower value
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.3, 2);
    });

    it('should use higher value for same priority', async () => {
      const snippet1 = {
        name: 's1',
        snippetPriority: 5,
        curves: {
          '1': [{ time: 0.01, intensity: 0.3 }]
        }
      };

      const snippet2 = {
        name: 's2',
        snippetPriority: 5,
        curves: {
          '1': [{ time: 0.01, intensity: 0.8 }]
        }
      };

      scheduler.loadFromJSON(snippet1);
      scheduler.loadFromJSON(snippet2);

      // Seek both - last seek applies all snippets
      appliedAUs = [];
      scheduler.seek('s1', 0.01);
      scheduler.seek('s2', 0.01);

      await vi.runAllTimersAsync();

      // Same priority, higher value wins
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.8, 2);
    });
  });

  describe('Intensity Scale (via seek)', () => {
    it('should apply intensity scale to sampled values', async () => {
      const snippet = {
        name: 'test_intensity',
        snippetIntensityScale: 0.5, // 50% intensity -> 0.5^2 = 0.25 multiplier
        curves: {
          '1': [{ time: 0.01, intensity: 1.0 }]
        }
      };

      scheduler.loadFromJSON(snippet);
      appliedAUs = [];
      scheduler.seek('test_intensity', 0.01);

      await vi.runAllTimersAsync();

      // Value should be scaled: 1.0 * 0.25 = 0.25
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.25, 2);
    });
  });
});
