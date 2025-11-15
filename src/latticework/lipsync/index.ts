/**
 * LipSync Agency - Public API
 * Lip-sync animation for facial animation engines
 */

// Main service (XState-based)
export { LipSyncService, createLipSyncService } from './lipSyncService';
export type { LipSyncServiceAPI, LipSyncHostCaps } from './lipSyncService';

// Machine and Scheduler
export { lipSyncMachine } from './lipSyncMachine';
export type { LipSyncSnippet } from './lipSyncMachine';
export { LipSyncScheduler } from './lipSyncScheduler';
export type { LipSyncSchedulerConfig } from './lipSyncScheduler';

// Utilities
export { VisemeMapper, visemeMapper } from './VisemeMapper';
export { PhonemeExtractor, phonemeExtractor } from './PhonemeExtractor';

// Types
export type {
  VisemeID,
  VisemeEvent,
  AnimationCurve,
  VisemeSnippet,
  LipSyncConfig,
  LipSyncState,
  LipSyncCallbacks,
  PhonemeMapping,
  SAPIViseme,
  SAPIResponse,
  PhonemeTiming,
} from './types';

export { VISEME_NAMES } from './types';
