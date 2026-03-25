/**
 * Loom3 - Canonical viseme contract.
 *
 * This module defines the canonical viseme IDs used by Loom3 profiles and
 * provides helpers for converting between named bindings and the legacy
 * positional array representation.
 */

export const CANONICAL_VISEME_IDS = [
  'EE',
  'Ah',
  'Oh',
  'OO',
  'I',
  'U',
  'W',
  'L',
  'F_V',
  'Th',
  'S_Z',
  'B_M_P',
  'K_G_H_NG',
  'AE',
  'R',
] as const;

export type CanonicalVisemeId = (typeof CANONICAL_VISEME_IDS)[number];

export const CANONICAL_VISEME_INDEX_BY_ID: Record<CanonicalVisemeId, number> =
  Object.fromEntries(CANONICAL_VISEME_IDS.map((id, index) => [id, index])) as Record<CanonicalVisemeId, number>;

export const getCanonicalVisemeIndex = (id: CanonicalVisemeId): number => CANONICAL_VISEME_INDEX_BY_ID[id];

export const getCanonicalVisemeId = (index: number): CanonicalVisemeId | undefined => CANONICAL_VISEME_IDS[index];

export const CANONICAL_VISEME_JAW_AMOUNTS: number[] = [
  0.20,
  0.80,
  0.60,
  0.50,
  0.20,
  0.50,
  0.40,
  0.30,
  0.10,
  0.15,
  0.10,
  0.00,
  0.35,
  0.75,
  0.35,
];

export type VisemeMorphTargetRef = string | number | undefined;

export interface VisemeBinding {
  morph: VisemeMorphTargetRef;
  jawAmount?: number;
  note?: string;
  sharedWith?: CanonicalVisemeId[];
}

export type VisemeBindings = Partial<Record<CanonicalVisemeId, VisemeBinding>>;

export interface ResolvedVisemeBinding {
  id: CanonicalVisemeId;
  morph: VisemeMorphTargetRef;
  jawAmount: number;
  binding?: VisemeBinding;
  source: 'binding' | 'legacy' | 'hybrid' | 'empty';
}

const clampVisemeId = (id: string): id is CanonicalVisemeId =>
  (CANONICAL_VISEME_IDS as readonly string[]).includes(id);

export const isCanonicalVisemeId = (value: string): value is CanonicalVisemeId => clampVisemeId(value);

export function createVisemeBindingsFromKeys(
  keys: VisemeMorphTargetRef[],
  jawAmounts: number[] = CANONICAL_VISEME_JAW_AMOUNTS
): VisemeBindings {
  const bindings: VisemeBindings = {};
  for (let i = 0; i < CANONICAL_VISEME_IDS.length; i += 1) {
    const key = keys[i];
    if (key === undefined) continue;
    bindings[CANONICAL_VISEME_IDS[i]] = {
      morph: key,
      jawAmount: jawAmounts[i] ?? CANONICAL_VISEME_JAW_AMOUNTS[i],
    };
  }
  return bindings;
}

export function resolveVisemeBindings(
  visemeBindings?: VisemeBindings,
  visemeKeys: VisemeMorphTargetRef[] = [],
  visemeJawAmounts: number[] = CANONICAL_VISEME_JAW_AMOUNTS
): ResolvedVisemeBinding[] {
  const resolved: ResolvedVisemeBinding[] = [];

  for (let i = 0; i < CANONICAL_VISEME_IDS.length; i += 1) {
    const id = CANONICAL_VISEME_IDS[i];
    const binding = visemeBindings?.[id];
    const legacyMorph = visemeKeys[i];
    const morph = binding?.morph ?? legacyMorph;

    const jawAmount = binding?.jawAmount ?? visemeJawAmounts[i] ?? CANONICAL_VISEME_JAW_AMOUNTS[i] ?? 0;
    resolved.push({
      id,
      morph,
      jawAmount,
      binding,
      source: binding
        ? (legacyMorph === undefined ? 'binding' : 'hybrid')
        : (legacyMorph === undefined ? 'empty' : 'legacy'),
    });
  }

  return resolved;
}

export function compileVisemeKeys(
  visemeBindings?: VisemeBindings,
  visemeKeys: VisemeMorphTargetRef[] = [],
  visemeJawAmounts: number[] = CANONICAL_VISEME_JAW_AMOUNTS
): VisemeMorphTargetRef[] {
  return resolveVisemeBindings(visemeBindings, visemeKeys, visemeJawAmounts).map((entry) => entry.morph);
}

export function compileVisemeJawAmounts(
  visemeBindings?: VisemeBindings,
  visemeKeys: VisemeMorphTargetRef[] = [],
  visemeJawAmounts: number[] = CANONICAL_VISEME_JAW_AMOUNTS
): number[] {
  return resolveVisemeBindings(visemeBindings, visemeKeys, visemeJawAmounts).map((entry) => entry.jawAmount);
}

export function visemeBindingsToMorphSet(visemeBindings?: VisemeBindings, visemeKeys: VisemeMorphTargetRef[] = []): Set<string> {
  const morphs = new Set<string>();

  for (const entry of resolveVisemeBindings(visemeBindings, visemeKeys)) {
    if (typeof entry.morph === 'string') {
      morphs.add(entry.morph);
    }
  }

  return morphs;
}
