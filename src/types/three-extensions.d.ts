import type { AnimationAction } from 'three';

declare module 'three' {
  interface AnimationAction {
    __actionId?: string;
  }

  interface AnimationMixer {
    _actions?: AnimationAction[];
  }
}

export {};
