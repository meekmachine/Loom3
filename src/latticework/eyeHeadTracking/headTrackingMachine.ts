/**
 * Head Tracking State Machine
 * Manages head rotation and tilt to follow eye gaze or external targets
 */

import { createMachine, assign } from 'xstate';
import type { GazeTarget } from './types';

export interface HeadTrackingContext {
  currentPosition: GazeTarget;
  targetPosition: GazeTarget;
  headIntensity: number;
  followDelay: number; // ms delay before following eye gaze
  headSpeed: number; // 0-1
  isFollowingEyes: boolean;
}

export type HeadTrackingEvent =
  | { type: 'SET_POSITION'; target: GazeTarget }
  | { type: 'FOLLOW_EYES'; target: GazeTarget }
  | { type: 'START_TRACKING' }
  | { type: 'STOP_TRACKING' }
  | { type: 'MOVEMENT_COMPLETE' }
  | { type: 'UPDATE_CONFIG'; config: Partial<HeadTrackingContext> };

/**
 * Head Tracking State Machine
 * States: idle -> tracking -> following -> tracking -> idle
 */
export const headTrackingMachine = createMachine(
  {
    id: 'headTracking',
    initial: 'idle',

    types: {
      context: {} as HeadTrackingContext,
      events: {} as HeadTrackingEvent,
    },

    context: {
      currentPosition: { x: 0, y: 0, z: 0 },
      targetPosition: { x: 0, y: 0, z: 0 },
      headIntensity: 0,
      followDelay: 200, // ms
      headSpeed: 0.4,
      isFollowingEyes: false,
    },

    states: {
      idle: {
        on: {
          START_TRACKING: { target: 'tracking' },
          SET_POSITION: { target: 'tracking', actions: 'setTargetPosition' },
          FOLLOW_EYES: { target: 'delayedFollow', actions: 'setFollowTarget' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },
      },

      tracking: {
        on: {
          STOP_TRACKING: { target: 'idle' },
          SET_POSITION: { target: 'moving', actions: 'setTargetPosition' },
          FOLLOW_EYES: { target: 'delayedFollow', actions: 'setFollowTarget' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },
      },

      delayedFollow: {
        entry: 'prepareFollow',
        on: {
          STOP_TRACKING: { target: 'idle' },
          SET_POSITION: {
            target: 'moving',
            actions: ['cancelFollow', 'setTargetPosition'],
          },
          FOLLOW_EYES: { actions: 'setFollowTarget' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Delay before head follows eyes
        after: {
          followDelay: { target: 'following', actions: 'startFollow' },
        },
      },

      following: {
        entry: 'startMovement',
        on: {
          STOP_TRACKING: { target: 'idle' },
          SET_POSITION: {
            target: 'moving',
            actions: ['cancelFollow', 'setTargetPosition'],
          },
          FOLLOW_EYES: { actions: 'updateFollowTarget' },
          MOVEMENT_COMPLETE: { target: 'tracking', actions: 'completeMovement' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Head movement duration based on distance and speed
        after: {
          movementDuration: {
            target: 'tracking',
            actions: 'completeMovement',
          },
        },
      },

      moving: {
        entry: 'startMovement',
        on: {
          STOP_TRACKING: { target: 'idle' },
          SET_POSITION: { actions: 'updateTargetPosition' },
          MOVEMENT_COMPLETE: { target: 'tracking', actions: 'completeMovement' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Head movement duration
        after: {
          movementDuration: {
            target: 'tracking',
            actions: 'completeMovement',
          },
        },
      },
    },
  },
  {
    actions: {
      setTargetPosition: assign(({ context, event }) => {
        if (event.type !== 'SET_POSITION') return {};
        return {
          targetPosition: event.target,
          isFollowingEyes: false,
        };
      }),

      updateTargetPosition: assign(({ context, event }) => {
        if (event.type !== 'SET_POSITION') return {};
        return {
          targetPosition: event.target,
        };
      }),

      setFollowTarget: assign(({ context, event }) => {
        if (event.type !== 'FOLLOW_EYES') return {};
        return {
          targetPosition: event.target,
          isFollowingEyes: true,
        };
      }),

      updateFollowTarget: assign(({ context, event }) => {
        if (event.type !== 'FOLLOW_EYES') return {};
        return {
          targetPosition: event.target,
        };
      }),

      updateConfig: assign(({ context, event }) => {
        if (event.type !== 'UPDATE_CONFIG') return {};
        return event.config;
      }),

      prepareFollow: assign(({ context }) => {
        return {
          headIntensity: 0.5,
        };
      }),

      startFollow: assign(({ context }) => {
        return {
          headIntensity: 0.8,
        };
      }),

      cancelFollow: assign(({ context }) => {
        return {
          isFollowingEyes: false,
        };
      }),

      startMovement: assign(({ context }) => {
        return {
          headIntensity: 1.0,
        };
      }),

      completeMovement: assign(({ context }) => {
        return {
          currentPosition: context.targetPosition,
          headIntensity: 0.7,
        };
      }),
    },

    delays: {
      followDelay: ({ context }) => {
        return context.followDelay;
      },

      movementDuration: ({ context }) => {
        // Head movement is slower than eyes (200-800ms)
        // Calculate based on distance and speed
        const dx = context.targetPosition.x - context.currentPosition.x;
        const dy = context.targetPosition.y - context.currentPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Base duration scaled by distance and speed
        const baseDuration = 400; // ms
        const scaledDuration = baseDuration + distance * 200;

        return Math.max(200, Math.min(800, scaledDuration / context.headSpeed));
      },
    },
  }
);
