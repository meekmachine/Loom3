import type {
  MappingEditorModel,
  MappingEditorSection,
  MorphCandidate,
  MorphCandidateMatch,
  MorphTargetRef,
  Profile,
  VisemeBinding,
  VisemeSlot,
} from './types';

function hasOwn<T extends object>(value: T | undefined, key: string): boolean {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function toSlotId(label: string, index: number): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `viseme-${index}`;
}

function bindingTargets(binding: VisemeBinding | undefined): MorphTargetRef[] {
  if (!binding) return [];
  const targets = binding.targets?.map((target) => target.morph).filter((morph) => morph !== '');
  if (targets && targets.length > 0) return targets;
  return binding.morph !== undefined && binding.morph !== '' ? [binding.morph] : [];
}

export function getProfileVisemeSlots(profile: Profile): VisemeSlot[] {
  if (profile.visemeSlots && profile.visemeSlots.length > 0) {
    return [...profile.visemeSlots].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  return (profile.visemeKeys || []).map((key, index) => {
    const label = typeof key === 'string' && key ? key : `Viseme ${index}`;
    return {
      id: toSlotId(label, index),
      label,
      order: index,
      defaultJawAmount: profile.visemeJawAmounts?.[index],
    };
  });
}

export function getVisemeSlotIndex(profile: Profile, slotId: string): number {
  return getProfileVisemeSlots(profile).findIndex((slot) => slot.id === slotId);
}

export function compileVisemeKeys(profile: Profile): MorphTargetRef[] {
  const slots = getProfileVisemeSlots(profile);
  if (!profile.visemeBindings) return [...(profile.visemeKeys || [])];

  return slots.map((slot, index) => {
    const target = bindingTargets(profile.visemeBindings?.[slot.id])[0];
    return target ?? profile.visemeKeys?.[index] ?? '';
  });
}

export function getVisemeJawAmounts(profile: Profile): number[] | undefined {
  const slots = getProfileVisemeSlots(profile);
  if (slots.length === 0) return profile.visemeJawAmounts ? [...profile.visemeJawAmounts] : undefined;
  return slots.map((slot, index) => slot.defaultJawAmount ?? profile.visemeJawAmounts?.[index] ?? 0);
}

export function resolveVisemeMeshCategory(profile: Profile): string {
  const morphToMesh = profile.morphToMesh || {};
  if (profile.visemeMeshCategory) return profile.visemeMeshCategory;
  if (hasOwn(morphToMesh, 'viseme')) return 'viseme';
  return 'face';
}

export function getMeshNamesForVisemeProfile(profile: Profile): string[] {
  const morphToMesh: Record<string, string[]> = profile.morphToMesh || {};
  const category = resolveVisemeMeshCategory(profile);
  if (hasOwn(morphToMesh, category)) {
    return Array.isArray(morphToMesh[category]) ? [...morphToMesh[category]] : [];
  }
  return profile.visemeMeshCategory ? [] : [...(morphToMesh.face || [])];
}

export function getMeshNamesForAUProfile(profile: Profile, auId: number): string[] {
  const morphToMesh = profile.morphToMesh || {};
  const facePart = profile.auInfo?.[String(auId)]?.facePart;
  const category = facePart ? profile.auFacePartToMeshCategory?.[facePart] : undefined;
  if (category) return Array.isArray(morphToMesh[category]) ? [...morphToMesh[category]] : [];
  return [...(morphToMesh.face || [])];
}

function compileMatcher(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

function classifyVisemeMorph(morphName: string, profile: Profile): MorphCandidateMatch[] {
  const slots = getProfileVisemeSlots(profile);
  const matches: MorphCandidateMatch[] = [];

  for (const slot of slots) {
    const explicitTargets = bindingTargets(profile.visemeBindings?.[slot.id]);
    if (explicitTargets.some((target) => String(target).toLowerCase() === morphName.toLowerCase())) {
      matches.push({
        slotId: slot.id,
        label: slot.label,
        confidence: 1,
        reason: 'explicit',
      });
      continue;
    }

    for (const pattern of slot.matchers || []) {
      const matcher = compileMatcher(pattern);
      if (matcher?.test(morphName)) {
        matches.push({
          slotId: slot.id,
          label: slot.label,
          confidence: 0.75,
          reason: 'regex',
          pattern,
        });
      }
    }
  }

  return matches;
}

export function buildMappingEditorModel(profile: Profile, morphNames: string[] = []): MappingEditorModel {
  const sections = new Map<string, MappingEditorSection>();
  const configuredSections = profile.mappingSections || [];
  const configuredById = new Map(configuredSections.map((section) => [section.id, section]));
  let nextOrder = configuredSections.length;

  for (const section of configuredSections) {
    sections.set(section.id, { ...section });
  }

  const getOrder = (id: string, fallback?: number): number => {
    const configured = configuredById.get(id);
    if (configured) return configured.order;
    if (fallback !== undefined) return fallback;
    const order = nextOrder;
    nextOrder += 1;
    return order;
  };

  const auSectionOrders = new Map<string, number>();
  for (const [auId, info] of Object.entries(profile.auInfo || {})) {
    const label = info.facePart || 'Unmapped';
    auSectionOrders.set(label, Math.min(auSectionOrders.get(label) ?? Number.MAX_SAFE_INTEGER, Number(auId)));
  }
  if (configuredSections.length === 0 && auSectionOrders.size > 0) {
    nextOrder = Math.max(...auSectionOrders.values()) + 1;
  }

  for (const info of Object.values(profile.auInfo || {})) {
    const label = info.facePart || 'Unmapped';
    const configured = configuredById.get(label);
    const meshCategory = profile.auFacePartToMeshCategory?.[label] || 'face';
    sections.set(label, {
      ...configured,
      id: label,
      label: configured?.label || label,
      kind: 'au',
      order: getOrder(label, auSectionOrders.get(label)),
      meshCategory: configured?.meshCategory || meshCategory,
      facePart: label,
    });
  }

  const configuredVisemes = configuredById.get('Visemes');
  sections.set('Visemes', {
    ...configuredVisemes,
    id: 'Visemes',
    label: configuredVisemes?.label || 'Visemes',
    kind: 'viseme',
    order: getOrder('Visemes'),
    meshCategory: configuredVisemes?.meshCategory || resolveVisemeMeshCategory(profile),
  });

  if (hasOwn(profile.morphToMesh, 'hair')) {
    const configuredHair = configuredById.get('Hair');
    sections.set('Hair', {
      ...configuredHair,
      id: 'Hair',
      label: configuredHair?.label || 'Hair',
      kind: 'hair',
      order: getOrder('Hair'),
      meshCategory: configuredHair?.meshCategory || 'hair',
    });
  }

  const configuredUnmapped = configuredById.get('Unmapped');
  sections.set('Unmapped', {
    ...configuredUnmapped,
    id: 'Unmapped',
    label: configuredUnmapped?.label || 'Unmapped',
    kind: 'unmapped',
    order: getOrder('Unmapped'),
    meshCategory: configuredUnmapped?.meshCategory || 'face',
  });

  const candidates: MorphCandidate[] = morphNames.map((morph) => {
    const matches = classifyVisemeMorph(morph, profile);
    if (matches.length === 0) {
      return { morph, sectionId: 'Unmapped', kind: 'unmapped', matches };
    }
    const explicit = matches.filter((match) => match.reason === 'explicit');
    if (explicit.length > 0) {
      return { morph, sectionId: 'Visemes', kind: 'explicit', matches: explicit };
    }
    return {
      morph,
      sectionId: 'Visemes',
      kind: matches.length > 1 ? 'conflict' : 'candidate',
      matches,
    };
  });

  return {
    sections: Array.from(sections.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    candidates,
  };
}

export interface ProviderVisemeEvent {
  provider: string;
  id?: string | number;
  phoneme?: string;
}

export interface ProviderVisemeMatch {
  slotId: string;
  index: number;
  confidence: number;
  reason: 'provider' | 'phoneme' | 'rest' | 'none';
}

export function mapProviderVisemeToSlot(profile: Profile, event: ProviderVisemeEvent): ProviderVisemeMatch | null {
  const slots = getProfileVisemeSlots(profile);
  const provider = event.provider.toLowerCase();

  if (event.id !== undefined) {
    const id = String(event.id);
    const index = slots.findIndex((slot) =>
      (slot.providerIds?.[provider] || []).some((candidate) => String(candidate) === id)
    );
    if (index >= 0) {
      return { slotId: slots[index].id, index, confidence: 1, reason: 'provider' };
    }
  }

  if (event.phoneme) {
    const phoneme = event.phoneme.toLowerCase();
    const index = slots.findIndex((slot) =>
      (slot.phonemes || []).some((candidate) => candidate.toLowerCase() === phoneme)
    );
    if (index >= 0) {
      return { slotId: slots[index].id, index, confidence: 0.8, reason: 'phoneme' };
    }
  }

  const restIndex = slots.findIndex((slot) => slot.id === 'rest' || slot.features?.lipClosed === 1);
  if (restIndex >= 0) {
    return { slotId: slots[restIndex].id, index: restIndex, confidence: 0.25, reason: 'rest' };
  }

  return null;
}
