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

    // Create mock host with TransitionHandle returns
    const mockTransitionHandle = () => ({
      promise: Promise.resolve(),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    });

    mockHost = {
      applyAU: vi.fn((id, v) => {
        appliedAUs.push({ id, value: v });
      }),
      setMorph: vi.fn(),
      transitionAU: vi.fn((id, v, dur) => {
        appliedAUs.push({ id, value: v, duration: dur });
        return mockTransitionHandle();
      }),
      transitionMorph: vi.fn(() => mockTransitionHandle()),
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
      // First keyframe at time 0 may have inherit flag from continuity feature
      expect(loaded.curves['1'][0]).toMatchObject({ time: 0, intensity: 0 });
      expect(loaded.curves['1'][1]).toMatchObject({ time: 1, intensity: 1 });
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
      // First keyframe at time 0 gets replaced with current value (0) due to continuity feature
      expect(loaded.curves['aa'][0].time).toBe(0);
      // The second keyframe retains its original intensity
      expect(loaded.curves['aa'][1]).toMatchObject({ time: 1, intensity: 1.0 });
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

  describe('Promise-based Playback', () => {
    it('should fire transitions when play() is called', async () => {
      const snippet = {
        name: 'test_playback',
        curves: { '1': [{ time: 0, intensity: 0 }, { time: 0.1, intensity: 0.5 }] }
      };

      service.loadFromJSON(snippet);
      appliedAUs = [];
      service.play();

      // Allow promise-based playback to start
      await vi.runAllTimersAsync();

      // Should have fired transitions via transitionAU
      expect(appliedAUs.length).toBeGreaterThan(0);
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
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
      // Find the call that contains 'AnimationService' (other console logs may occur first)
      const debugCall = consoleSpy.mock.calls.find(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('AnimationService'))
      );
      expect(debugCall).toBeDefined();

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

  describe('Independent Scheduler Control (PROMISE-BASED ARCHITECTURE)', () => {
    it('should load multiple snippets independently', () => {
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

      const state = service.getState();
      expect(state.context.animations).toHaveLength(2);
    });

    it('should allow pausing individual snippets', () => {
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
      service.play();

      // Pause ONLY brow raise
      service.setSnippetPlaying('brow_raise', false);

      const state = service.getState();
      const browSnippet = state.context.animations.find((s: any) => s.name === 'brow_raise');
      const headSnippet = state.context.animations.find((s: any) => s.name === 'head_nod');

      expect(browSnippet.isPlaying).toBe(false);
      expect(headSnippet.isPlaying).toBe(true);
    });

    it('should allow independent intensity scaling', () => {
      // Test intensity scaling on a single snippet (no conflict resolution)
      const browRaise = {
        name: 'brow_raise',
        curves: { '1': [{ time: 0.01, intensity: 1.0 }, { time: 0.1, intensity: 1.0 }] }
      };

      service.loadFromJSON(browRaise);

      // Scale down brow to 50% (which becomes 0.25 after quadratic scaling: 0.5^2)
      service.setSnippetIntensityScale('brow_raise', 0.5);

      const state = service.getState();
      const loaded = state.context.animations[0];
      expect(loaded.snippetIntensityScale).toBe(0.5);
    });

    it('should allow independent priority control', async () => {
      const browRaise = {
        name: 'brow_raise',
        curves: { '1': [{ time: 0, intensity: 0.3 }, { time: 0.1, intensity: 0.3 }] }
      };
      const headNod = {
        name: 'head_nod',
        curves: { '1': [{ time: 0, intensity: 0.8 }, { time: 0.1, intensity: 0.8 }] }
      };

      service.loadFromJSON(browRaise);
      service.loadFromJSON(headNod);

      // Give brow higher priority
      service.setSnippetPriority('brow_raise', 10);
      service.setSnippetPriority('head_nod', 1);

      service.play();
      appliedAUs = [];

      // Let promise-based playback fire transitions
      await vi.runAllTimersAsync();

      // Brow should win despite lower value due to higher priority
      const au1 = appliedAUs.find(au => au.id === 1);
      expect(au1).toBeDefined();
      expect(au1!.value).toBeCloseTo(0.3, 1);
    });
  });
});
