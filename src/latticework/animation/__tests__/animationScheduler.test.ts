import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimationScheduler } from '../animationScheduler';
import { createActor } from 'xstate';
import { animationMachine } from '../animationMachine';
import type { HostCaps } from '../types';

describe('AnimationScheduler', () => {
  let scheduler: AnimationScheduler;
  let mockHost: HostCaps;
  let appliedAUs: Array<{ id: number | string; value: number; duration?: number }>;
  let machine: any;

  beforeEach(() => {
    // Use fake timers for deterministic time control
    vi.useFakeTimers();

    // Mock performance.now() to use Date.now() so fake timers work
    const originalPerformance = globalThis.performance;
    vi.stubGlobal('performance', {
      ...originalPerformance,
      now: () => Date.now()
    });

    // Reset mocks
    appliedAUs = [];

    // Create mock host
    mockHost = {
      applyAU: vi.fn((id, v) => {
        appliedAUs.push({ id, value: v });
      }),
      setMorph: vi.fn(),
      transitionAU: vi.fn((id, v, dur) => {
        appliedAUs.push({ id, value: v, duration: dur });
      }),
      transitionMorph: vi.fn(),
      onSnippetEnd: vi.fn()
    };

    // Create fresh machine instance
    machine = createActor(animationMachine).start();

    // Create scheduler
    scheduler = new AnimationScheduler(machine, mockHost);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('Basic Loading and Playback', () => {
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

    it('should start playing when play() is called', () => {
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
  });

  describe('Wall-Clock Anchoring', () => {
    it('should initialize startWallTime when loading', () => {
      const snippet = {
        name: 'test_anchor',
        curves: {
          '1': [{ time: 0, intensity: 0 }]
        }
      };

      scheduler.loadFromJSON(snippet);
      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      expect(sn.startWallTime).toBeDefined();
      expect(typeof sn.startWallTime).toBe('number');
    });

    it('should maintain independent timelines for multiple snippets', () => {
      const snippet1 = {
        name: 'snippet1',
        snippetPlaybackRate: 1,
        curves: { '1': [{ time: 0, intensity: 0 }, { time: 2, intensity: 1 }] }
      };

      const snippet2 = {
        name: 'snippet2',
        snippetPlaybackRate: 2, // 2x speed
        curves: { '2': [{ time: 0, intensity: 0 }, { time: 2, intensity: 1 }] }
      };

      scheduler.loadFromJSON(snippet1);
      scheduler.loadFromJSON(snippet2);

      const state = machine.getSnapshot();
      const sn1 = state.context.animations[0];
      const sn2 = state.context.animations[1];

      // Both should have different startWallTime anchors
      expect(sn1.startWallTime).toBeDefined();
      expect(sn2.startWallTime).toBeDefined();
      expect(sn1.snippetPlaybackRate).toBe(1);
      expect(sn2.snippetPlaybackRate).toBe(2);
    });
  });

  describe('Looping Behavior', () => {
    it('should reset currentTime to 0 when looping completes', () => {
      vi.setSystemTime(0); // Start at t=0

      const snippet = {
        name: 'test_loop',
        loop: true,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      // Advance time by 2.5 seconds (2.5 loops through a 1 second animation)
      vi.advanceTimersByTime(2500);

      // Step should wrap the time
      scheduler.step(0.016);

      // CurrentTime should be wrapped to within [0, 1]
      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      expect(sn.currentTime).toBeGreaterThanOrEqual(0);
      expect(sn.currentTime).toBeLessThan(1);
    });

    it('should not reset non-looping snippets', () => {
      vi.setSystemTime(0); // Start at t=0

      const snippet = {
        name: 'test_no_loop',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);

      let state = machine.getSnapshot();
      let sn = state.context.animations[0];
      console.log('After load: performance.now()=', performance.now(), 'startWallTime=', sn.startWallTime);

      scheduler.play();

      // Advance time by 2 seconds (beyond 1 second duration)
      vi.advanceTimersByTime(2000);

      console.log('After advance: performance.now()=', performance.now());

      // Manually verify the calculation that step() should do
      const now = performance.now();
      const rate = 1;
      const dur = 1;
      const expectedLocal = ((now - sn.startWallTime) / 1000) * rate;
      const expectedClamped = Math.min(dur, Math.max(0, expectedLocal));
      console.log('Expected calculation: local=', expectedLocal, 'clamped=', expectedClamped);

      scheduler.step(0.016);

      // Should clamp at duration, not wrap
      state = machine.getSnapshot();
      sn = state.context.animations[0];

      console.log('After step: currentTime=', sn.currentTime);
      expect(sn.currentTime).toBe(1);
    });
  });

  describe('Playback Rate', () => {
    it('should respect snippetPlaybackRate', () => {
      const snippet = {
        name: 'test_rate',
        snippetPlaybackRate: 2.0, // 2x speed
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 4, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      // At 2x speed, 1 real second = 2 snippet seconds
      const now = performance.now();
      sn.startWallTime = now - 1000; // 1 real second ago

      scheduler.step(0.016);

      // With 2x rate, after 1 real second we should be at time=2 in the snippet
      expect(sn.currentTime).toBeCloseTo(2.0, 1);
    });
  });

  describe('Intensity Scale', () => {
    it('should apply intensity scale to sampled values', () => {
      const snippet = {
        name: 'test_intensity',
        snippetIntensityScale: 0.5, // 50% intensity
        curves: {
          '1': [
            { time: 0, intensity: 1.0 } // Full intensity in data
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();
      appliedAUs = [];

      // Step once to apply values
      scheduler.step(0.016);

      // Should have applied AU with scaled value
      expect(appliedAUs.length).toBeGreaterThan(0);

      // Value should be scaled to 0.5
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.5, 2);
    });
  });

  describe('Priority Resolution', () => {
    it('should resolve conflicts by priority', () => {
      const highPriority = {
        name: 'high',
        snippetPriority: 10,
        curves: {
          '1': [{ time: 0, intensity: 0.3 }]
        }
      };

      const lowPriority = {
        name: 'low',
        snippetPriority: 1,
        curves: {
          '1': [{ time: 0, intensity: 0.8 }]
        }
      };

      scheduler.loadFromJSON(lowPriority);
      scheduler.loadFromJSON(highPriority);
      scheduler.play();
      appliedAUs = [];

      scheduler.step(0.016);

      // High priority should win even with lower value
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.3, 2);
    });

    it('should use higher value for same priority', () => {
      const snippet1 = {
        name: 's1',
        snippetPriority: 5,
        curves: {
          '1': [{ time: 0, intensity: 0.3 }]
        }
      };

      const snippet2 = {
        name: 's2',
        snippetPriority: 5,
        curves: {
          '1': [{ time: 0, intensity: 0.8 }]
        }
      };

      scheduler.loadFromJSON(snippet1);
      scheduler.loadFromJSON(snippet2);
      scheduler.play();
      appliedAUs = [];

      scheduler.step(0.016);

      // Same priority, higher value wins
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.8, 2);
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

    it('should adjust startWallTime correctly when seeking', () => {
      const snippet = {
        name: 'test_seek_anchor',
        snippetPlaybackRate: 2.0,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 4, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.seek('test_seek_anchor', 2.0);

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      // After seek, the current wall time should match the seek position
      const now = performance.now();
      const expectedLocal = ((now - sn.startWallTime) / 1000) * 2.0;

      expect(expectedLocal).toBeCloseTo(2.0, 1);
    });
  });

  describe('Snippet Removal', () => {
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
  });

  describe('Completion Callbacks', () => {
    it('should call onSnippetEnd when non-looping snippet completes', () => {
      const snippet = {
        name: 'test_complete',
        loop: false,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      // Set to past duration
      const now = performance.now();
      sn.startWallTime = now - 2000; // 2 seconds ago, duration is 1 second

      scheduler.step(0.016);

      // Should have called completion callback
      expect(mockHost.onSnippetEnd).toHaveBeenCalledWith('test_complete');
    });

    it('should not call onSnippetEnd for looping snippets', () => {
      const snippet = {
        name: 'test_loop_no_end',
        loop: true,
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      // Set to past duration
      const now = performance.now();
      sn.startWallTime = now - 2000;

      scheduler.step(0.016);

      // Should NOT call completion callback for looping
      expect(mockHost.onSnippetEnd).not.toHaveBeenCalled();
    });
  });

  describe('Curve Sampling', () => {
    it('should interpolate between keyframes', () => {
      const snippet = {
        name: 'test_interpolation',
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 2, intensity: 1 }
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();

      const state = machine.getSnapshot();
      const sn = state.context.animations[0];

      // Set to middle of animation (1 second into 2 second duration)
      const now = performance.now();
      sn.startWallTime = now - 1000;

      appliedAUs = [];
      scheduler.step(0.016);

      // At t=1 in the curve [0,0] -> [2,1], value should be 0.5
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.5, 1);
    });

    it('should clamp values to [0, 1]', () => {
      const snippet = {
        name: 'test_clamp',
        curves: {
          '1': [
            { time: 0, intensity: 2.0 } // Over 1.0
          ]
        }
      };

      scheduler.loadFromJSON(snippet);
      scheduler.play();
      appliedAUs = [];

      scheduler.step(0.016);

      // Value should be clamped to 1.0
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeLessThanOrEqual(1.0);
    });
  });
});
