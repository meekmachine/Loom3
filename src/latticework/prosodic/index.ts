/**
 * Prosodic Expression Agency
 * Exports machine, scheduler, service, and types
 */

export { prosodicMachine } from './prosodicMachine';
export { ProsodicScheduler } from './prosodicScheduler';
export { createProsodicService, ProsodicService } from './prosodicService';
export type { ProsodicServiceAPI } from './prosodicService';
export type { ProsodicSnippet } from './prosodicMachine';
export type {
  ProsodicConfig,
  ProsodicState,
  ProsodicCallbacks,
  ProsodicChannel,
  AnimationSnippet,
  AnimationCurve,
  FadeStep,
} from './types';
export { DEFAULT_PROSODIC_CONFIG, DEFAULT_ANIMATION_KEYS } from './types';
