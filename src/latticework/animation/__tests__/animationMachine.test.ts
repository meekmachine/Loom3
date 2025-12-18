import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createActor } from 'xstate';
import { animationMachine } from '../animationMachine';
import type { AnimContext } from '../types';

describe('AnimationMachine', () => {
  let machine: any;

  beforeEach(() => {
    // Mock performance.now() for consistent timestamps
    const originalPerformance = globalThis.performance;
    vi.stubGlobal('performance', {
      ...originalPerformance,
      now: () => Date.now()
    });

    machine = createActor(animationMachine).start();
  });

  afterEach(() => {
    machine.stop();
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('should start in stopped state', () => {
      const state = machine.getSnapshot();
      expect(state.value).toBe('stopped');
    });

    it('should initialize with empty context', () => {
      const state = machine.getSnapshot();
      const ctx: AnimContext = state.context;

      expect(ctx.animations).toEqual([]);
      expect(ctx.currentAUs).toEqual({});
      expect(ctx.currentVisemes).toEqual({});
      expect(ctx.manualOverrides).toEqual({});
      expect(ctx.scheduledTransitions).toEqual([]);
    });
  });

  describe('Loading Animations', () => {
    it('should add animation when stopped', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_load',
          curves: {
            '1': [
              { time: 0, intensity: 0 },
              { time: 1, intensity: 1 }
            ]
          }
        }
      });

      const state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);
      expect(state.context.animations[0].name).toBe('test_load');
      expect(state.context.animations[0].isPlaying).toBe(false);
    });

    it('should add animation in playing state when machine is playing', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_load_playing',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      const state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);
      expect(state.context.animations[0].isPlaying).toBe(true);
    });

    it('should normalize curves with t/v syntax', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_normalize',
          curves: {
            '1': [
              { t: 0, v: 0.5 },
              { t: 1, v: 1.0 }
            ]
          }
        }
      });

      const state = machine.getSnapshot();
      const curves = state.context.animations[0].curves['1'];
      // Use toMatchObject since normalize may add inherit flag
      expect(curves[0]).toMatchObject({ time: 0, intensity: 0.5 });
      expect(curves[1]).toMatchObject({ time: 1, intensity: 1.0 });
    });

    it('should sort curves by time', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_sort',
          curves: {
            '1': [
              { time: 2, intensity: 1 },
              { time: 0, intensity: 0 },
              { time: 1, intensity: 0.5 }
            ]
          }
        }
      });

      const state = machine.getSnapshot();
      const curves = state.context.animations[0].curves['1'];
      expect(curves[0].time).toBe(0);
      expect(curves[1].time).toBe(1);
      expect(curves[2].time).toBe(2);
    });

    it('should generate name if not provided', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      const state = machine.getSnapshot();
      expect(state.context.animations[0].name).toMatch(/^sn_\d+$/);
    });

    it('should apply default values', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_defaults',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      expect(snippet.loop).toBe(false);
      expect(snippet.snippetPlaybackRate).toBe(1);
      expect(snippet.snippetIntensityScale).toBe(1);
      expect(snippet.snippetCategory).toBe('default');
      expect(snippet.snippetPriority).toBe(0);
      expect(snippet.currentTime).toBe(0);
      expect(snippet.cursor).toEqual({});
    });

    it('should initialize startWallTime', () => {
      const before = performance.now();

      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_wall_time',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      const after = performance.now();
      const state = machine.getSnapshot();
      const startWallTime = state.context.animations[0].startWallTime;

      expect(startWallTime).toBeGreaterThanOrEqual(before);
      expect(startWallTime).toBeLessThanOrEqual(after);
    });

    it('should preserve custom properties', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_custom',
          curves: { '1': [{ time: 0, intensity: 0.5 }] },
          loop: true,
          snippetPlaybackRate: 2.0,
          snippetIntensityScale: 0.5,
          snippetCategory: 'auSnippet',
          snippetPriority: 10
        }
      });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      expect(snippet.loop).toBe(true);
      expect(snippet.snippetPlaybackRate).toBe(2.0);
      expect(snippet.snippetIntensityScale).toBe(0.5);
      expect(snippet.snippetCategory).toBe('auSnippet');
      expect(snippet.snippetPriority).toBe(10);
    });
  });

  describe('Removing Animations', () => {
    it('should remove animation by name', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'to_remove',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      let state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);

      machine.send({ type: 'REMOVE_ANIMATION', name: 'to_remove' });

      state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(0);
    });

    it('should not affect other animations', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'keep',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'remove',
          curves: { '2': [{ time: 0, intensity: 0.5 }] }
        }
      });

      machine.send({ type: 'REMOVE_ANIMATION', name: 'remove' });

      const state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);
      expect(state.context.animations[0].name).toBe('keep');
    });

    it('should handle removing non-existent animation', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'existing',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      machine.send({ type: 'REMOVE_ANIMATION', name: 'nonexistent' });

      const state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);
      expect(state.context.animations[0].name).toBe('existing');
    });
  });

  describe('State Transitions', () => {
    it('should transition from stopped to playing', () => {
      machine.send({ type: 'PLAY_ALL' });
      const state = machine.getSnapshot();
      expect(state.value).toBe('playing');
    });

    it('should transition from playing to paused', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });
      const state = machine.getSnapshot();
      expect(state.value).toBe('paused');
    });

    it('should transition from playing to stopped', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'STOP_ALL' });
      const state = machine.getSnapshot();
      expect(state.value).toBe('stopped');
    });

    it('should transition from paused to playing', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });
      machine.send({ type: 'PLAY_ALL' });
      const state = machine.getSnapshot();
      expect(state.value).toBe('playing');
    });

    it('should transition from paused to stopped', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });
      machine.send({ type: 'STOP_ALL' });
      const state = machine.getSnapshot();
      expect(state.value).toBe('stopped');
    });
  });

  describe('Playing State Actions', () => {
    it('should mark all animations as playing', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test1',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test2',
          curves: { '2': [{ time: 0, intensity: 0.5 }] }
        }
      });

      machine.send({ type: 'PLAY_ALL' });
      const state = machine.getSnapshot();

      expect(state.context.animations[0].isPlaying).toBe(true);
      expect(state.context.animations[1].isPlaying).toBe(true);
    });

    it('should mark all animations as paused', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      machine.send({ type: 'PAUSE_ALL' });
      const state = machine.getSnapshot();

      expect(state.context.animations[0].isPlaying).toBe(false);
    });
  });

  describe('Curve Changes', () => {
    // Note: CURVE_CHANGED is only handled in 'playing' or 'paused' states

    it('should update curve data', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_curve',
          curves: {
            '1': [
              { time: 0, intensity: 0 },
              { time: 1, intensity: 1 }
            ]
          }
        }
      });

      // Need to be in playing/paused state for CURVE_CHANGED to work
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });

      const newCurve = [
        { time: 0, intensity: 0 },
        { time: 0.5, intensity: 0.5 },
        { time: 1, intensity: 1 }
      ];

      machine.send({
        type: 'CURVE_CHANGED',
        nameOrId: 'test_curve',
        auId: '1',
        curve: newCurve
      });

      const state = machine.getSnapshot();
      expect(state.context.animations[0].curves['1']).toHaveLength(3);
      // CURVE_CHANGED passes curve data directly without normalization, so no inherit flag
      expect(state.context.animations[0].curves['1'][1]).toMatchObject({ time: 0.5, intensity: 0.5 });
    });

    it('should sort new curve by time', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_sort_curve',
          curves: { '1': [{ time: 0, intensity: 0 }] }
        }
      });

      // Need to be in playing/paused state
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });

      const newCurve = [
        { time: 2, intensity: 1 },
        { time: 0, intensity: 0 },
        { time: 1, intensity: 0.5 }
      ];

      machine.send({
        type: 'CURVE_CHANGED',
        nameOrId: 'test_sort_curve',
        auId: '1',
        curve: newCurve
      });

      const state = machine.getSnapshot();
      const curves = state.context.animations[0].curves['1'];
      expect(curves[0].time).toBe(0);
      expect(curves[1].time).toBe(1);
      expect(curves[2].time).toBe(2);
    });

    it('should set cursor for changed curve', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_cursor',
          curves: { '1': [{ time: 0, intensity: 0 }] }
        }
      });

      // Need to be in playing/paused state
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });

      machine.send({
        type: 'CURVE_CHANGED',
        nameOrId: 'test_cursor',
        auId: '1',
        curve: [{ time: 0, intensity: 0.5 }]
      });

      const state = machine.getSnapshot();
      // mergeCurve action sets cursor[auId] = 0 for the changed curve
      expect(state.context.animations[0].cursor['1']).toBe(0);
    });

    it('should handle curve change for non-existent animation', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'existing',
          curves: { '1': [{ time: 0, intensity: 0 }] }
        }
      });

      // Need to be in playing/paused state
      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });

      machine.send({
        type: 'CURVE_CHANGED',
        nameOrId: 'nonexistent',
        auId: '1',
        curve: [{ time: 0, intensity: 1 }]
      });

      const state = machine.getSnapshot();
      // Should not change existing animation
      expect(state.context.animations[0].curves['1'][0].intensity).toBe(0);
    });
  });

  describe('Manual Overrides', () => {
    it('should set manual AU override', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({
        type: 'MANUAL_SET',
        id: 1,
        value: 0.75
      });

      const state = machine.getSnapshot();
      expect(state.context.manualOverrides[1]).toBe(0.75);
      expect(state.context.currentAUs['1']).toBe(0.75);
    });

    it('should set manual viseme override', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({
        type: 'MANUAL_SET',
        id: 'aa',
        value: 0.8,
        isViseme: true
      });

      const state = machine.getSnapshot();
      expect(state.context.manualOverrides['aa']).toBe(0.8);
      expect(state.context.currentVisemes['aa']).toBe(0.8);
    });

    it('should clear manual override', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({
        type: 'MANUAL_SET',
        id: 1,
        value: 0.75
      });

      let state = machine.getSnapshot();
      expect(state.context.manualOverrides[1]).toBe(0.75);

      machine.send({
        type: 'MANUAL_CLEAR',
        id: 1
      });

      state = machine.getSnapshot();
      expect(state.context.manualOverrides[1]).toBeUndefined();
    });

    it('should handle clearing non-existent override', () => {
      machine.send({ type: 'PLAY_ALL' });
      machine.send({
        type: 'MANUAL_CLEAR',
        id: 999
      });

      const state = machine.getSnapshot();
      expect(state.context.manualOverrides[999]).toBeUndefined();
    });
  });

  describe('Keyframe Hit Events', () => {
    it('should apply blend values from keyframe hit', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_keyframe',
          curves: { '1': [{ time: 0, intensity: 0.8 }] },
          snippetIntensityScale: 1.0
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      machine.send({
        type: 'KEYFRAME_HIT',
        data: [
          {
            tAbs: 0,
            snippet: snippet,
            curveId: '1',
            kfIdx: 0
          }
        ]
      });

      const newState = machine.getSnapshot();
      expect(newState.context.currentAUs['1']).toBe(0.8);
    });

    it('should apply intensity scale to keyframe values', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_scale',
          curves: { '1': [{ time: 0, intensity: 1.0 }] },
          snippetIntensityScale: 0.5
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      machine.send({
        type: 'KEYFRAME_HIT',
        data: [
          {
            tAbs: 0,
            snippet: snippet,
            curveId: '1',
            kfIdx: 0
          }
        ]
      });

      const newState = machine.getSnapshot();
      expect(newState.context.currentAUs['1']).toBe(0.5);
    });

    it('should route visemes to currentVisemes', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_viseme',
          curves: { 'aa': [{ time: 0, intensity: 0.9 }] },
          snippetCategory: 'visemeSnippet'
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      machine.send({
        type: 'KEYFRAME_HIT',
        data: [
          {
            tAbs: 0,
            snippet: snippet,
            curveId: 'aa',
            kfIdx: 0
          }
        ]
      });

      const newState = machine.getSnapshot();
      expect(newState.context.currentVisemes['aa']).toBe(0.9);
    });

    it('should prioritize manual overrides over keyframe values', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_override',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      // Set manual override
      machine.send({
        type: 'MANUAL_SET',
        id: '1',
        value: 0.9
      });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      // Send keyframe hit with different value
      machine.send({
        type: 'KEYFRAME_HIT',
        data: [
          {
            tAbs: 0,
            snippet: snippet,
            curveId: '1',
            kfIdx: 0
          }
        ]
      });

      const newState = machine.getSnapshot();
      // Manual override should win
      expect(newState.context.currentAUs['1']).toBe(0.9);
    });

    it('should record scheduled transitions', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_transitions',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      const state = machine.getSnapshot();
      const snippet = state.context.animations[0];

      machine.send({
        type: 'KEYFRAME_HIT',
        data: [
          {
            tAbs: 0,
            snippet: snippet,
            curveId: '1',
            kfIdx: 0
          }
        ]
      });

      const newState = machine.getSnapshot();
      expect(newState.context.scheduledTransitions).toContain('test_transitions:1:0');
    });
  });

  describe('Update Current Times', () => {
    it('should update currentTime for playing snippets', () => {
      // Note: coerceSnippet uses performance.now() which is stubbed in beforeEach to use Date.now()
      // And updateCurrentTimes uses Date.now() directly
      // With fake timers, both should return the same mocked time

      // Need to get the snippet's startWallTime and then advance
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_time',
          curves: { '1': [{ time: 0, intensity: 0.5 }] },
          snippetPlaybackRate: 1
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      // Get the startWallTime that was set when snippet loaded
      const startTime = machine.getSnapshot().context.animations[0].startWallTime;

      // Use fake timers and set time 2 seconds after startWallTime
      vi.useFakeTimers();
      vi.setSystemTime(startTime + 2000);

      machine.send({ type: 'UI_PROGRESS' });

      const state = machine.getSnapshot();
      // updateCurrentTimes uses Date.now() - startWallTime
      // Date.now() is now startWallTime + 2000, so (2000)/1000 * 1 = 2.0
      expect(state.context.animations[0].currentTime).toBeCloseTo(2.0, 1);

      vi.useRealTimers();
    });

    it('should respect playback rate when updating time', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_rate',
          curves: { '1': [{ time: 0, intensity: 0.5 }] },
          snippetPlaybackRate: 2
        }
      });

      machine.send({ type: 'PLAY_ALL' });

      // Get the startWallTime
      const startTime = machine.getSnapshot().context.animations[0].startWallTime;

      // Use fake timers and set time 1 second after startWallTime
      vi.useFakeTimers();
      vi.setSystemTime(startTime + 1000);

      machine.send({ type: 'UI_PROGRESS' });

      const state = machine.getSnapshot();
      // At 2x rate, 1 real second = 2 snippet seconds
      expect(state.context.animations[0].currentTime).toBeCloseTo(2.0, 1);

      vi.useRealTimers();
    });

    it('should not update time for paused snippets', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000);

      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test_paused',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      // Don't send PLAY_ALL, so snippet remains paused

      vi.setSystemTime(3000);

      machine.send({ type: 'UI_PROGRESS' });

      const state = machine.getSnapshot();
      // Time should still be 0 since not playing
      expect(state.context.animations[0].currentTime).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('Event Handling by State', () => {
    it('should handle LOAD_ANIMATION in stopped state', () => {
      expect(machine.getSnapshot().value).toBe('stopped');

      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test',
          curves: { '1': [{ time: 0, intensity: 0.5 }] }
        }
      });

      const state = machine.getSnapshot();
      expect(state.context.animations).toHaveLength(1);
      expect(state.value).toBe('stopped');
    });

    it('should ignore KEYFRAME_HIT in stopped state', () => {
      machine.send({
        type: 'KEYFRAME_HIT',
        data: []
      });

      const state = machine.getSnapshot();
      expect(state.value).toBe('stopped');
    });

    it('should handle CURVE_CHANGED in paused state', () => {
      machine.send({
        type: 'LOAD_ANIMATION',
        data: {
          name: 'test',
          curves: { '1': [{ time: 0, intensity: 0 }] }
        }
      });

      machine.send({ type: 'PLAY_ALL' });
      machine.send({ type: 'PAUSE_ALL' });

      machine.send({
        type: 'CURVE_CHANGED',
        nameOrId: 'test',
        auId: '1',
        curve: [{ time: 0, intensity: 1 }]
      });

      const state = machine.getSnapshot();
      expect(state.context.animations[0].curves['1'][0].intensity).toBe(1);
      expect(state.value).toBe('paused');
    });
  });
});
