import type {
  ClipOptions,
  CompiledLipsyncSequence,
  CurvePoint,
  CurvesMap,
  LipsyncEventListInput,
  LipsyncSequenceInput,
  LipsyncSequenceOptions,
  LipsyncSnippetInput,
  LipsyncTimeUnit,
  LipsyncVisemeKey,
  MicrosoftVisemeEvent,
  NormalizedLipsyncEvent,
} from '../core/types';
import type { Profile } from '../mappings/types';
import {
  getMeshNamesForVisemeProfile,
  getProfileVisemeSlots,
  getVisemeJawAmounts,
  getVisemeSlotIndex,
  mapProviderVisemeToSlot,
} from '../mappings/visemeSystem';

const DEFAULT_PROVIDER = 'azure';
const DEFAULT_RAMP_MS = 8;
const DEFAULT_VISEME_DURATION_MS = 100;
const DEFAULT_NEUTRAL_PAD_MS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isCurvePoint(value: unknown): value is CurvePoint {
  return isRecord(value)
    && typeof value.time === 'number'
    && typeof value.intensity === 'number';
}

function isSnippetInput(input: LipsyncSequenceInput): input is LipsyncSnippetInput {
  return isRecord(input) && isRecord(input.curves);
}

function asEvent(value: unknown): MicrosoftVisemeEvent | null {
  return isRecord(value) ? value as MicrosoftVisemeEvent : null;
}

function eventSourceId(event: MicrosoftVisemeEvent): LipsyncVisemeKey | undefined {
  return event.visemeId
    ?? event.viseme_id
    ?? event.VisemeId
    ?? event.id;
}

function providerAliases(provider: string): string[] {
  const lower = provider.toLowerCase();
  if (lower === 'microsoft') return ['microsoft', 'azure', 'sapi'];
  if (lower === 'azure') return ['azure', 'sapi', 'microsoft'];
  if (lower === 'sapi') return ['sapi', 'azure', 'microsoft'];
  return [lower];
}

function valuesEqual(a: LipsyncVisemeKey, b: LipsyncVisemeKey): boolean {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function lookupSourceMap(
  sourceVisemeMap: LipsyncSequenceOptions['sourceVisemeMap'] | undefined,
  sourceId: LipsyncVisemeKey
): LipsyncVisemeKey | undefined {
  if (!sourceVisemeMap) return undefined;

  const direct = sourceVisemeMap[String(sourceId)];
  if (Array.isArray(direct)) return direct[0];
  if (direct !== undefined) return direct;

  for (const [target, mapped] of Object.entries(sourceVisemeMap)) {
    if (Array.isArray(mapped)) {
      if (mapped.some((candidate) => valuesEqual(candidate, sourceId))) return target;
    } else if (valuesEqual(mapped, sourceId)) {
      return target;
    }
  }

  return undefined;
}

function resolveProfileVisemeIndex(profile: Profile, target: LipsyncVisemeKey): number {
  const slots = getProfileVisemeSlots(profile);

  if (typeof target === 'number' && Number.isInteger(target) && target >= 0 && target < slots.length) {
    return target;
  }

  const targetString = String(target);
  const numeric = Number(targetString);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < slots.length) {
    return numeric;
  }

  const direct = getVisemeSlotIndex(profile, targetString);
  if (direct >= 0) return direct;

  const lower = targetString.toLowerCase();
  return slots.findIndex((slot) =>
    slot.id.toLowerCase() === lower
    || slot.label.toLowerCase() === lower
  );
}

function resolveSourceVisemeIndex(
  profile: Profile,
  sourceId: LipsyncVisemeKey,
  provider: string,
  sourceVisemeMap?: LipsyncSequenceOptions['sourceVisemeMap'],
  phoneme?: string
): number {
  const mapped = lookupSourceMap(sourceVisemeMap, sourceId);
  if (mapped !== undefined) {
    const mappedIndex = resolveProfileVisemeIndex(profile, mapped);
    if (mappedIndex >= 0) return mappedIndex;
  }

  let fallbackRestIndex = -1;
  for (const alias of providerAliases(provider)) {
    const match = mapProviderVisemeToSlot(profile, { provider: alias, id: sourceId, phoneme });
    if (!match) continue;
    if (match.reason !== 'rest') return match.index;
    if (fallbackRestIndex < 0) fallbackRestIndex = match.index;
  }

  const direct = resolveProfileVisemeIndex(profile, sourceId);
  return direct >= 0 ? direct : fallbackRestIndex;
}

function resolveAnyVisemeIndex(
  profile: Profile,
  viseme: LipsyncVisemeKey,
  provider: string,
  sourceVisemeMap?: LipsyncSequenceOptions['sourceVisemeMap']
): number {
  const direct = resolveProfileVisemeIndex(profile, viseme);
  if (direct >= 0) return direct;
  return resolveSourceVisemeIndex(profile, viseme, provider, sourceVisemeMap);
}

function convertTimeToMs(value: number, unit: LipsyncTimeUnit, key: string): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === 'milliseconds') return value;
  if (unit === 'seconds') return value * 1000;
  if (unit === 'ticks') return value / 10_000;
  if (/ms/i.test(key)) return value;
  if (/audio/i.test(key) && Math.abs(value) > 10_000) return value / 10_000;
  return value * 1000;
}

function readTimeMs(
  event: MicrosoftVisemeEvent,
  unit: LipsyncTimeUnit,
  candidates: Array<[string, unknown]>
): number | undefined {
  for (const [key, raw] of candidates) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(0, convertTimeToMs(raw, unit, key));
    }
  }
  return undefined;
}

function readOffsetMs(event: MicrosoftVisemeEvent, unit: LipsyncTimeUnit): number {
  return readTimeMs(event, unit, [
    ['offsetMs', event.offsetMs],
    ['offset_ms', event.offset_ms],
    ['timeMs', event.timeMs],
    ['startMs', event.startMs],
    ['audioOffset', event.audioOffset],
    ['audio_offset', event.audio_offset],
    ['AudioOffset', event.AudioOffset],
    ['time', event.time],
    ['offset', event.offset],
  ]) ?? 0;
}

function readDurationMs(event: MicrosoftVisemeEvent, unit: LipsyncTimeUnit): number | undefined {
  return readTimeMs(event, unit, [
    ['durationMs', event.durationMs],
    ['duration_ms', event.duration_ms],
    ['duration', event.duration],
  ]);
}

function normalizeCurve(input: unknown): CurvePoint[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(isCurvePoint)
    .map((point) => ({
      time: Math.max(0, point.time),
      intensity: Number.isFinite(point.intensity) ? point.intensity : 0,
      inherit: point.inherit,
    }))
    .sort((a, b) => a.time - b.time);
}

function normalizeCurves(curves: CurvesMap): CurvesMap {
  const normalized: CurvesMap = {};
  for (const [key, value] of Object.entries(curves || {})) {
    const curve = normalizeCurve(value);
    if (curve.length > 0) normalized[key] = curve;
  }
  return normalized;
}

function buildVisemeCurve(offsetMs: number, durationMs: number, rampMs: number): CurvePoint[] {
  const startSec = Math.max(0, offsetMs) / 1000;
  const durationSec = Math.max(0, durationMs) / 1000;
  const endSec = startSec + durationSec;
  const rampSec = Math.min(Math.max(0, rampMs) / 1000, durationSec / 2);
  const peakStart = startSec + rampSec;
  const peakEnd = Math.max(peakStart, endSec - rampSec);

  return [
    { time: startSec, intensity: 0 },
    { time: peakStart, intensity: 1 },
    { time: peakEnd, intensity: 1 },
    { time: endSec, intensity: 0 },
  ];
}

function appendCurve(curves: CurvesMap, key: string, curve: CurvePoint[]): void {
  if (!curve.length) return;
  curves[key] = [...(curves[key] || []), ...curve]
    .sort((a, b) => a.time - b.time)
    .filter((point, index, arr) => {
      if (index === 0) return true;
      const prev = arr[index - 1];
      return Math.abs(prev.time - point.time) > 1e-6
        || Math.abs(prev.intensity - point.intensity) > 1e-6
        || Boolean(point.inherit) !== Boolean(prev.inherit);
    });
}

function addNeutralPad(curves: CurvesMap, neutralPadMs: number): void {
  if (neutralPadMs <= 0) return;

  let maxTime = 0;
  for (const curve of Object.values(curves)) {
    const last = curve[curve.length - 1];
    if (last) maxTime = Math.max(maxTime, last.time);
  }

  const neutralTime = maxTime + neutralPadMs / 1000;
  for (const curve of Object.values(curves)) {
    const last = curve[curve.length - 1];
    if (!last || Math.abs(last.time - neutralTime) < 1e-6) continue;
    curve.push({ time: neutralTime, intensity: 0 });
  }
}

function clipOptionsFromSequenceOptions(options: LipsyncSequenceOptions = {}): ClipOptions {
  const {
    name: _name,
    sourceProvider: _sourceProvider,
    timeUnit: _timeUnit,
    sourceVisemeMap: _sourceVisemeMap,
    morphTargetToViseme: _morphTargetToViseme,
    jawActivation: _jawActivation,
    defaultJawScale: _defaultJawScale,
    defaultVisemeDurationMs: _defaultVisemeDurationMs,
    rampMs: _rampMs,
    neutralPadMs: _neutralPadMs,
    ...clipOptions
  } = options;
  return clipOptions;
}

function getArrayField(input: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = input[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

function eventsFromParallelArrays(input: Record<string, unknown>): MicrosoftVisemeEvent[] | null {
  const visemes = input.visemes;
  if (!Array.isArray(visemes) || visemes.every(isRecord)) return null;

  const timings = getArrayField(input, [
    'vtimes',
    'visemeTiming',
    'visemeTimings',
    'visemesTiming',
    'visemesTimings',
    'viseme_timing',
    'visemes_timing',
    'vsemestiming',
    'vsemesTiming',
  ]);
  const durations = getArrayField(input, ['vdurations', 'durationMs', 'durations']);

  return visemes.map((viseme, index) => ({
    visemeId: viseme as LipsyncVisemeKey,
    offsetMs: typeof timings?.[index] === 'number' ? timings[index] as number : index * DEFAULT_VISEME_DURATION_MS,
    durationMs: typeof durations?.[index] === 'number' ? durations[index] as number : undefined,
  }));
}

function extractEventInput(input: LipsyncSequenceInput): {
  name?: string;
  provider?: string;
  durationMs?: number;
  events: MicrosoftVisemeEvent[];
} {
  if (Array.isArray(input)) {
    return { events: input.map(asEvent).filter((event): event is MicrosoftVisemeEvent => Boolean(event)) };
  }

  if (!isRecord(input)) return { events: [] };

  const parallel = eventsFromParallelArrays(input);
  if (parallel) {
    return {
      name: typeof input.name === 'string' ? input.name : undefined,
      provider: typeof input.provider === 'string'
        ? input.provider
        : typeof input.sourceProvider === 'string'
          ? input.sourceProvider
          : undefined,
      durationMs: typeof input.durationMs === 'number'
        ? input.durationMs
        : typeof input.duration === 'number'
          ? input.duration * 1000
          : undefined,
      events: parallel,
    };
  }

  const rawEvents = getArrayField(input, [
    'events',
    'visemes',
    'visemeTiming',
    'visemeTimings',
    'visemesTiming',
    'visemesTimings',
    'viseme_timing',
    'visemes_timing',
    'vsemestiming',
    'vsemesTiming',
  ]) || [];

  return {
    name: typeof input.name === 'string' ? input.name : undefined,
    provider: typeof input.provider === 'string'
      ? input.provider
      : typeof input.sourceProvider === 'string'
        ? input.sourceProvider
        : undefined,
    durationMs: typeof input.durationMs === 'number'
      ? input.durationMs
      : typeof input.duration === 'number'
        ? input.duration * 1000
        : undefined,
    events: rawEvents.map(asEvent).filter((event): event is MicrosoftVisemeEvent => Boolean(event)),
  };
}

function buildJawAmounts(
  profile: Profile,
  provider: string,
  options: LipsyncSequenceOptions
): number[] | undefined {
  const slots = getProfileVisemeSlots(profile);
  if (slots.length === 0) return undefined;

  const jawAmounts = getVisemeJawAmounts(profile) || Array.from({ length: slots.length }, () => 0);

  for (const [viseme, amount] of Object.entries(options.jawActivation || {})) {
    if (!Number.isFinite(amount)) continue;
    const index = resolveAnyVisemeIndex(profile, viseme, provider, options.sourceVisemeMap);
    if (index >= 0 && index < jawAmounts.length) {
      jawAmounts[index] = Math.max(0, amount);
    }
  }

  return jawAmounts;
}

function addMorphOverrideCurves(
  profile: Profile,
  provider: string,
  curves: CurvesMap,
  options: LipsyncSequenceOptions
): string[] {
  const morphOverrides = options.morphTargetToViseme || {};
  const directMorphs: string[] = [];

  for (const [morphName, viseme] of Object.entries(morphOverrides)) {
    const index = resolveAnyVisemeIndex(profile, viseme, provider, options.sourceVisemeMap);
    if (index < 0) continue;
    const sourceCurve = curves[String(index)];
    if (!sourceCurve || sourceCurve.length === 0) continue;
    appendCurve(curves, morphName, sourceCurve.map((point) => ({ ...point })));
    directMorphs.push(morphName);
  }

  return directMorphs;
}

function compileSnippetInput(
  _profile: Profile,
  input: LipsyncSnippetInput,
  options: LipsyncSequenceOptions = {}
): CompiledLipsyncSequence {
  const name = options.name || input.name || `lipsync_${Date.now()}`;
  const clipOptions = clipOptionsFromSequenceOptions(options);

  return {
    name,
    sourceProvider: options.sourceProvider || DEFAULT_PROVIDER,
    curves: normalizeCurves(input.curves),
    events: [],
    clipOptions: {
      ...clipOptions,
      loop: clipOptions.loop ?? input.loop,
      loopMode: clipOptions.loopMode ?? input.mixerLoopMode,
      repeatCount: clipOptions.repeatCount ?? input.mixerRepeatCount,
      reverse: clipOptions.reverse ?? input.mixerReverse,
      playbackRate: clipOptions.playbackRate ?? input.snippetPlaybackRate,
      intensityScale: clipOptions.intensityScale ?? input.snippetIntensityScale,
      jawScale: input.snippetJawScale ?? options.defaultJawScale ?? 1,
      snippetCategory: 'visemeSnippet',
      autoVisemeJaw: input.autoVisemeJaw !== false,
      source: clipOptions.source ?? 'clip',
    },
  };
}

export function compileLipsyncSequence(
  profile: Profile,
  input: LipsyncSequenceInput,
  options: LipsyncSequenceOptions = {}
): CompiledLipsyncSequence {
  if (isSnippetInput(input)) {
    return compileSnippetInput(profile, input, options);
  }

  const eventInput = extractEventInput(input);
  const provider = options.sourceProvider || eventInput.provider || DEFAULT_PROVIDER;
  const sourceProvider = provider.toLowerCase();
  const timeUnit = options.timeUnit || 'auto';
  const rampMs = options.rampMs ?? DEFAULT_RAMP_MS;
  const defaultDurationMs = options.defaultVisemeDurationMs ?? DEFAULT_VISEME_DURATION_MS;
  const neutralPadMs = options.neutralPadMs ?? DEFAULT_NEUTRAL_PAD_MS;
  const slots = getProfileVisemeSlots(profile);
  const normalized: NormalizedLipsyncEvent[] = [];

  const rawEvents = eventInput.events
    .map((event) => ({
      event,
      sourceId: eventSourceId(event),
      offsetMs: readOffsetMs(event, timeUnit),
    }))
    .filter((entry): entry is { event: MicrosoftVisemeEvent; sourceId: LipsyncVisemeKey; offsetMs: number } =>
      entry.sourceId !== undefined
    )
    .sort((a, b) => a.offsetMs - b.offsetMs);

  for (let index = 0; index < rawEvents.length; index += 1) {
    const current = rawEvents[index];
    const next = rawEvents[index + 1];
    const slotIndex = resolveSourceVisemeIndex(
      profile,
      current.sourceId,
      sourceProvider,
      options.sourceVisemeMap,
      typeof current.event.phoneme === 'string' ? current.event.phoneme : undefined
    );

    if (slotIndex < 0 || slotIndex >= slots.length) continue;

    const explicitDuration = readDurationMs(current.event, timeUnit);
    const inferredDuration = next
      ? Math.max(0, next.offsetMs - current.offsetMs)
      : eventInput.durationMs !== undefined
        ? Math.max(0, eventInput.durationMs - current.offsetMs)
        : defaultDurationMs;

    normalized.push({
      sourceId: current.sourceId,
      slotId: slots[slotIndex].id,
      slotIndex,
      offsetMs: current.offsetMs,
      durationMs: Math.max(0, explicitDuration ?? inferredDuration),
      phoneme: typeof current.event.phoneme === 'string' ? current.event.phoneme : undefined,
      animation: current.event.animation ?? current.event.Animation,
      raw: current.event,
    });
  }

  const curves: CurvesMap = {};
  for (const event of normalized) {
    appendCurve(
      curves,
      String(event.slotIndex),
      buildVisemeCurve(event.offsetMs, event.durationMs || defaultDurationMs, rampMs)
    );
  }

  const directMorphs = addMorphOverrideCurves(profile, sourceProvider, curves, options);
  addNeutralPad(curves, neutralPadMs);

  const clipOptions = clipOptionsFromSequenceOptions(options);
  const visemeMeshNames = directMorphs.length > 0 && !clipOptions.meshNames
    ? getMeshNamesForVisemeProfile(profile)
    : undefined;

  return {
    name: options.name || eventInput.name || `lipsync_${Date.now()}`,
    sourceProvider,
    curves,
    events: normalized,
    clipOptions: {
      ...clipOptions,
      meshNames: clipOptions.meshNames ?? (visemeMeshNames && visemeMeshNames.length > 0 ? visemeMeshNames : undefined),
      jawScale: options.defaultJawScale ?? 1,
      snippetCategory: 'visemeSnippet',
      autoVisemeJaw: true,
      visemeJawAmounts: buildJawAmounts(profile, sourceProvider, options),
      source: clipOptions.source ?? 'clip',
    },
  };
}
