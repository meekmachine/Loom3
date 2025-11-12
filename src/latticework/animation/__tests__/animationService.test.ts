import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnimationService } from '../animationService';
import type { HostCaps } from '../types';

describe('AnimationService', () => {
  let service: ReturnType<typeof createAnimationService>;
  let mockHost: HostCaps;
  let appliedAUs: Array<{ id: number | string; value: number; duration?: number }>;

  beforeEach(() => {
    // Use fake timers for deterministic time control
    vi.useFakeTimers();

    // Mock performance.now() to use Date.now() so fake timers work
    const originalPerformance = globalThis.performance;
    vi.stubGlobal('performance', {
      ...originalPerformance,
      now: () => Date.now()
    });

    // Mock localStorage for Vitest environment
    const localStorageMock = {
      data: {} as Record<string, string>,
      getItem(key: string) {
        return this.data[key] || null;
      },
      setItem(key: string, value: string) {
        this.data[key] = value;
      },
      removeItem(key: string) {
        delete this.data[key];
      },
      clear() {
        this.data = {};
      }
    };
    vi.stubGlobal('localStorage', localStorageMock);

    // Mock window object for Vitest environment
    vi.stubGlobal('window', {});

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

    // Create service
    service = createAnimationService(mockHost);
  });

  afterEach(() => {
    service.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('Service Creation and Initialization', () => {
    it('should create a service with all API methods', () => {
      expect(service).toBeDefined();
      expect(typeof service.loadFromJSON).toBe('function');
      expect(typeof service.schedule).toBe('function');
      expect(typeof service.play).toBe('function');
      expect(typeof service.pause).toBe('function');
      expect(typeof service.stop).toBe('function');
      expect(typeof service.remove).toBe('function');
    });

    it('should initialize in non-playing state', () => {
      expect(service.isPlaying()).toBe(false);
    });

    it('should expose window.anim global', () => {
      expect((window as any).anim).toBe(service);
    });
  });

  describe('Loading Animations', () => {
    it('should load animation from JSON', () => {
      const snippet = {
        name: 'test_load',
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 1, intensity: 1 }
          ]
        }
      };

      const name = service.loadFromJSON(snippet);
      expect(name).toBe('test_load');

      const state = service.getState();
      expect(state.context.animations).toHaveLength(1);
      expect(state.context.animations[0].name).toBe('test_load');
    });

    it('should generate name if not provided', () => {
      const snippet = {
        curves: {
          '1': [{ time: 0, intensity: 0 }]
        }
      };

      const name = service.loadFromJSON(snippet);
      expect(name).toMatch(/^sn_\d+$/);
    });

    it('should normalize AU keyframes to curves', () => {
      const snippet = {
        name: 'test_au',
        au: [
          { t: 0, id: 1, v: 0 },
          { t: 1, id: 1, v: 1 }
        ]
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.curves).toBeDefined();
      expect(loaded.curves['1']).toHaveLength(2);
      expect(loaded.curves['1'][0]).toEqual({ time: 0, intensity: 0 });
      expect(loaded.curves['1'][1]).toEqual({ time: 1, intensity: 1 });
    });

    it('should normalize viseme keyframes to curves', () => {
      const snippet = {
        name: 'test_viseme',
        viseme: [
          { t: 0, key: 'aa', v: 0.5 },
          { t: 1, key: 'aa', v: 1.0 }
        ]
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.curves).toBeDefined();
      expect(loaded.curves['aa']).toHaveLength(2);
      expect(loaded.curves['aa'][0]).toEqual({ time: 0, intensity: 0.5 });
    });

    it('should load from localStorage', () => {
      const snippet = {
        name: 'test_local',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      // Mock localStorage
      localStorage.setItem('test/snippet', JSON.stringify(snippet));

      const name = service.loadFromLocal('test/snippet');
      expect(name).toBe('test_local');

      const state = service.getState();
      expect(state.context.animations).toHaveLength(1);
    });

    it('should extract name from localStorage key if not in data', () => {
      const snippet = {
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      localStorage.setItem('emotionAnimationsList/happy_smile', JSON.stringify(snippet));

      const name = service.loadFromLocal('emotionAnimationsList/happy_smile');
      expect(name).toBe('happy_smile');
    });

    it('should return null for missing localStorage key', () => {
      const name = service.loadFromLocal('nonexistent/key');
      expect(name).toBe(null);
    });
  });

  describe('Scheduling with Options', () => {
    it('should schedule animation with priority option', () => {
      const snippet = {
        name: 'test_schedule',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.schedule(snippet, { priority: 10 });

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.snippetPriority).toBe(10);
    });

    it('should schedule multiple animations', () => {
      const snippet1 = {
        name: 's1',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };
      const snippet2 = {
        name: 's2',
        curves: { '2': [{ time: 0, intensity: 0.5 }] }
      };

      service.schedule(snippet1);
      service.schedule(snippet2);

      const state = service.getState();
      expect(state.context.animations).toHaveLength(2);
    });
  });

  describe('Playback Control', () => {
    it('should start playing when play() is called', () => {
      const snippet = {
        name: 'test_play',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();

      expect(service.isPlaying()).toBe(true);
    });

    it('should pause playback', () => {
      const snippet = {
        name: 'test_pause',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();
      expect(service.isPlaying()).toBe(true);

      service.pause();
      expect(service.isPlaying()).toBe(false);
    });

    it('should stop playback', () => {
      const snippet = {
        name: 'test_stop',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();
      expect(service.isPlaying()).toBe(true);

      service.stop();
      expect(service.isPlaying()).toBe(false);
    });

    it('should support playing property getter', () => {
      const snippet = {
        name: 'test_playing',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      expect(service.playing).toBe(false);

      service.play();
      expect(service.playing).toBe(true);
    });
  });

  describe('Snippet Removal', () => {
    it('should remove snippet by name', () => {
      const snippet = {
        name: 'to_remove',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      let state = service.getState();
      expect(state.context.animations).toHaveLength(1);

      service.remove('to_remove');
      state = service.getState();
      expect(state.context.animations).toHaveLength(0);
    });
  });

  describe('Snippet Parameter Tuning', () => {
    it('should set snippet playback rate', () => {
      const snippet = {
        name: 'test_rate',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetPlaybackRate('test_rate', 2.0);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.snippetPlaybackRate).toBe(2.0);
    });

    it('should set snippet intensity scale', () => {
      const snippet = {
        name: 'test_scale',
        curves: { '1': [{ time: 0, intensity: 1.0 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetIntensityScale('test_scale', 0.5);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.snippetIntensityScale).toBe(0.5);
    });

    it('should set snippet priority', () => {
      const snippet = {
        name: 'test_priority',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetPriority('test_priority', 15);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.snippetPriority).toBe(15);
    });

    it('should set snippet loop', () => {
      const snippet = {
        name: 'test_loop',
        loop: false,
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetLoop('test_loop', true);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.loop).toBe(true);
    });

    it('should set snippet playing state', () => {
      const snippet = {
        name: 'test_playing',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetPlaying('test_playing', true);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.isPlaying).toBe(true);
    });

    it('should validate playback rate is positive', () => {
      const snippet = {
        name: 'test_rate_validate',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetPlaybackRate('test_rate_validate', -1);

      const state = service.getState();
      const loaded = state.context.animations[0];
      // Should default to 1 for invalid rates
      expect(loaded.snippetPlaybackRate).toBe(1);
    });

    it('should clamp intensity scale to minimum 0', () => {
      const snippet = {
        name: 'test_scale_clamp',
        curves: { '1': [{ time: 0, intensity: 1.0 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetIntensityScale('test_scale_clamp', -0.5);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.snippetIntensityScale).toBe(0);
    });
  });

  describe('Seek Functionality', () => {
    it('should seek to specific time in snippet', () => {
      const snippet = {
        name: 'test_seek',
        curves: {
          '1': [
            { time: 0, intensity: 0 },
            { time: 5, intensity: 1 }
          ]
        }
      };

      service.loadFromJSON(snippet);
      service.setSnippetTime('test_seek', 2.5);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.currentTime).toBe(2.5);
    });

    it('should clamp seek time to minimum 0', () => {
      const snippet = {
        name: 'test_seek_clamp',
        curves: { '1': [{ time: 0, intensity: 0 }] }
      };

      service.loadFromJSON(snippet);
      service.setSnippetTime('test_seek_clamp', -1);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.currentTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('External Frame Step', () => {
    it('should accept step() calls with delta time', () => {
      const snippet = {
        name: 'test_step',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();

      // Should not throw
      expect(() => service.step(0.016)).not.toThrow();
    });

    it('should ignore invalid delta times', () => {
      const snippet = {
        name: 'test_step_invalid',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();

      // Should not throw on invalid inputs
      expect(() => service.step(0)).not.toThrow();
      expect(() => service.step(-1)).not.toThrow();
      expect(() => service.step(NaN)).not.toThrow();
      expect(() => service.step(Infinity)).not.toThrow();
    });

    it('should apply animations to host on step', () => {
      const snippet = {
        name: 'test_apply',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();
      appliedAUs = [];

      service.step(0.016);

      // Should have applied AU values
      expect(appliedAUs.length).toBeGreaterThan(0);
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
    });
  });

  describe('FlushOnce', () => {
    it('should immediately apply current values', () => {
      const snippet = {
        name: 'test_flush',
        curves: { '1': [{ time: 0, intensity: 0.8 }] }
      };

      service.loadFromJSON(snippet);
      appliedAUs = [];

      service.flushOnce();

      // Should have applied values immediately
      expect(appliedAUs.length).toBeGreaterThan(0);
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.8, 1);
    });
  });

  describe('State Subscription', () => {
    it('should allow subscribing to state transitions', () => {
      const callback = vi.fn();
      const unsubscribe = service.onTransition(callback);

      const snippet = {
        name: 'test_subscribe',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);

      // Should have been called with new state
      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow unsubscribing from state transitions', () => {
      const callback = vi.fn();
      const unsubscribe = service.onTransition(callback);

      callback.mockClear();
      unsubscribe();

      const snippet = {
        name: 'test_unsubscribe',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);

      // Should not have been called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      const snippet = {
        name: 'test_dispose',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.play();

      expect(() => service.dispose()).not.toThrow();
      expect(service.isPlaying()).toBe(false);
    });

    it('should handle multiple dispose calls', () => {
      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });

  describe('Debug Helper', () => {
    it('should provide debug information', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const snippet = {
        name: 'test_debug',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      service.debug();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('AnimationService');

      consoleSpy.mockRestore();
    });
  });

  describe('Default Values', () => {
    it('should apply default snippetCategory', () => {
      const snippet = {
        name: 'test_defaults',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.snippetCategory).toBe('default');
    });

    it('should apply default snippetPriority of 0', () => {
      const snippet = {
        name: 'test_defaults',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.snippetPriority).toBe(0);
    });

    it('should apply default snippetPlaybackRate of 1', () => {
      const snippet = {
        name: 'test_defaults',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.snippetPlaybackRate).toBe(1);
    });

    it('should apply default snippetIntensityScale of 1', () => {
      const snippet = {
        name: 'test_defaults',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.snippetIntensityScale).toBe(1);
    });

    it('should apply default loop of false', () => {
      const snippet = {
        name: 'test_defaults',
        curves: { '1': [{ time: 0, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      const state = service.getState();
      const loaded = state.context.animations[0];

      expect(loaded.loop).toBe(false);
    });
  });

  describe('Independent Scheduler Control (NEW ARCHITECTURE)', () => {
    it('should maintain independent playback for multiple snippets', () => {
      vi.setSystemTime(0);

      const browRaise = {
        name: 'brow_raise',
        curves: { '1': [{ time: 0, intensity: 0 }, { time: 2, intensity: 1 }] }
      };
      const headNod = {
        name: 'head_nod',
        curves: { '2': [{ time: 0, intensity: 0 }, { time: 2, intensity: 1 }] }
      };

      service.loadFromJSON(browRaise);
      service.loadFromJSON(headNod);

      // Play both
      service.play();

      // Advance 1 second
      vi.advanceTimersByTime(1000);
      service.step(1.0);

      let snapshot = service.getScheduleSnapshot();
      let browState = snapshot.find(s => s.name === 'brow_raise');
      let headState = snapshot.find(s => s.name === 'head_nod');

      // Both should be at ~1 second
      expect(browState!.localTime).toBeCloseTo(1.0, 1);
      expect(headState!.localTime).toBeCloseTo(1.0, 1);

      // Now speed up ONLY head nod to 2x
      service.setSnippetPlaybackRate('head_nod', 2.0);

      // Advance another 1 second
      vi.advanceTimersByTime(1000);
      service.step(1.0);

      snapshot = service.getScheduleSnapshot();
      browState = snapshot.find(s => s.name === 'brow_raise');
      headState = snapshot.find(s => s.name === 'head_nod');

      // Brow should be at ~2 seconds (1x speed)
      // Head should be at ~2 seconds too, but because of 2x speed after t=1
      // The second real second at 2x rate = 2 snippet seconds, so 1 + 2 = 3, but clamped to max 2
      expect(browState!.localTime).toBeCloseTo(2.0, 1);
      expect(headState!.localTime).toBeCloseTo(2.0, 1); // Clamped at duration

      vi.useRealTimers();
    });

    it('should allow pausing individual snippets independently', () => {
      vi.setSystemTime(0);

      const browRaise = {
        name: 'brow_raise',
        curves: { '1': [{ time: 0, intensity: 0 }, { time: 5, intensity: 1 }] }
      };
      const headNod = {
        name: 'head_nod',
        curves: { '2': [{ time: 0, intensity: 0 }, { time: 5, intensity: 1 }] }
      };

      service.loadFromJSON(browRaise);
      service.loadFromJSON(headNod);

      // Play both
      service.play();

      // Advance 1 second
      vi.advanceTimersByTime(1000);
      service.step(1.0);

      // Pause ONLY brow raise
      service.setSnippetPlaying('brow_raise', false);

      // Advance another 1 second
      vi.advanceTimersByTime(1000);
      service.step(1.0);

      const snapshot = service.getScheduleSnapshot();
      const browState = snapshot.find(s => s.name === 'brow_raise');
      const headState = snapshot.find(s => s.name === 'head_nod');

      // Brow should still be at ~1 second (paused)
      expect(browState!.localTime).toBeCloseTo(1.0, 1);
      // Head should be at ~2 seconds (continued playing)
      expect(headState!.localTime).toBeCloseTo(2.0, 1);

      vi.useRealTimers();
    });

    it('should allow independent intensity scaling', () => {
      const browRaise = {
        name: 'brow_raise',
        curves: { '1': [{ time: 0, intensity: 1.0 }] }
      };
      const headNod = {
        name: 'head_nod',
        curves: { '1': [{ time: 0, intensity: 1.0 }] } // Same AU for conflict
      };

      service.loadFromJSON(browRaise);
      service.loadFromJSON(headNod);

      // Scale down brow to 50%
      service.setSnippetIntensityScale('brow_raise', 0.5);

      service.play();
      appliedAUs = [];
      service.step(0.016);

      // With same priority and same AU, higher value wins
      // head_nod has intensity 1.0, brow has 0.5
      // So head_nod should win
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(1.0, 2);
    });

    it('should allow independent priority control', () => {
      const browRaise = {
        name: 'brow_raise',
        curves: { '1': [{ time: 0, intensity: 0.3 }] }
      };
      const headNod = {
        name: 'head_nod',
        curves: { '1': [{ time: 0, intensity: 0.8 }] }
      };

      service.loadFromJSON(browRaise);
      service.loadFromJSON(headNod);

      // Give brow higher priority
      service.setSnippetPriority('brow_raise', 10);
      service.setSnippetPriority('head_nod', 1);

      service.play();
      appliedAUs = [];
      service.step(0.016);

      // Brow should win despite lower value
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.3, 2);
    });
  });
});
