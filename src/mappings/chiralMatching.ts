import type { Profile } from './types';

export type ChiralSide = 'left' | 'right' | 'center' | 'unknown';

export interface ChiralBoneNode {
  nodeKey: string;
  boneName: string;
  side: ChiralSide;
  stem: string;
  /** Which identifier produced the side/stem inference. */
  evidence: 'nodeKey' | 'boneName' | 'none';
}

export interface ChiralBonePair {
  stem: string;
  left: ChiralBoneNode;
  right: ChiralBoneNode;
}

export interface ChiralBoneInference {
  pairs: ChiralBonePair[];
  unpairedLeft: ChiralBoneNode[];
  unpairedRight: ChiralBoneNode[];
  neutral: ChiralBoneNode[];
}

interface SideAnalysis {
  side: ChiralSide;
  stem: string;
  strength: number;
}

const LEFT_MARKERS = new Set(['left', 'l']);
const RIGHT_MARKERS = new Set(['right', 'r']);

function tokenizeIdentifier(value: string): string[] {
  const withWordBreaks = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');

  return withWordBreaks
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function analyzeSide(rawValue: string): SideAnalysis {
  const tokens = tokenizeIdentifier(rawValue);
  if (tokens.length === 0) {
    return { side: 'unknown', stem: '', strength: 0 };
  }

  const hasLeftWord = tokens.includes('left');
  const hasRightWord = tokens.includes('right');
  const hasLeftShort = tokens.includes('l');
  const hasRightShort = tokens.includes('r');

  const hasLeft = hasLeftWord || hasLeftShort;
  const hasRight = hasRightWord || hasRightShort;

  const side: ChiralSide = hasLeft && !hasRight
    ? 'left'
    : hasRight && !hasLeft
      ? 'right'
      : !hasLeft && !hasRight
        ? 'center'
        : 'unknown';

  const stemTokens = tokens.filter((token) => !LEFT_MARKERS.has(token) && !RIGHT_MARKERS.has(token));
  const stem = (stemTokens.length > 0 ? stemTokens : tokens).join('_');
  const strength = hasLeftWord || hasRightWord ? 2 : hasLeftShort || hasRightShort ? 1 : 0;

  return { side, stem, strength };
}

function buildChiralNode(nodeKey: string, boneName: string): ChiralBoneNode {
  const keyAnalysis = analyzeSide(nodeKey);
  const boneAnalysis = analyzeSide(boneName);

  const keyIsSide = keyAnalysis.side === 'left' || keyAnalysis.side === 'right';
  const boneIsSide = boneAnalysis.side === 'left' || boneAnalysis.side === 'right';

  if (keyIsSide && (!boneIsSide || keyAnalysis.strength >= boneAnalysis.strength)) {
    return {
      nodeKey,
      boneName,
      side: keyAnalysis.side,
      stem: keyAnalysis.stem,
      evidence: 'nodeKey',
    };
  }

  if (boneIsSide) {
    return {
      nodeKey,
      boneName,
      side: boneAnalysis.side,
      stem: boneAnalysis.stem,
      evidence: 'boneName',
    };
  }

  if (keyAnalysis.side === 'center') {
    return {
      nodeKey,
      boneName,
      side: 'center',
      stem: keyAnalysis.stem || boneAnalysis.stem,
      evidence: keyAnalysis.stem ? 'nodeKey' : boneAnalysis.stem ? 'boneName' : 'none',
    };
  }

  if (boneAnalysis.side === 'center') {
    return {
      nodeKey,
      boneName,
      side: 'center',
      stem: boneAnalysis.stem || keyAnalysis.stem,
      evidence: boneAnalysis.stem ? 'boneName' : keyAnalysis.stem ? 'nodeKey' : 'none',
    };
  }

  return {
    nodeKey,
    boneName,
    side: 'unknown',
    stem: keyAnalysis.stem || boneAnalysis.stem,
    evidence: 'none',
  };
}

/**
 * Infer left/right bone pairings for any chiral-matched nodes in a profile.
 * This works across eyes, hands, arms, legs, feet, and any custom rig keys
 * as long as side markers are present in either semantic node key or bone name.
 */
export function inferChiralBonePairs(profile: Pick<Profile, 'boneNodes'>): ChiralBoneInference {
  const grouped = new Map<string, { left: ChiralBoneNode[]; right: ChiralBoneNode[] }>();
  const neutral: ChiralBoneNode[] = [];

  for (const [nodeKey, boneName] of Object.entries(profile.boneNodes ?? {})) {
    const node = buildChiralNode(nodeKey, boneName);
    if (node.side === 'left' || node.side === 'right') {
      const stem = node.stem || `${nodeKey.toLowerCase()}_${node.side}`;
      const entry = grouped.get(stem) ?? { left: [], right: [] };
      entry[node.side].push(node);
      grouped.set(stem, entry);
      continue;
    }

    neutral.push(node);
  }

  const pairs: ChiralBonePair[] = [];
  const unpairedLeft: ChiralBoneNode[] = [];
  const unpairedRight: ChiralBoneNode[] = [];

  const stems = Array.from(grouped.keys()).sort();
  for (const stem of stems) {
    const group = grouped.get(stem);
    if (!group) continue;
    const leftNodes = [...group.left].sort((a, b) => a.nodeKey.localeCompare(b.nodeKey));
    const rightNodes = [...group.right].sort((a, b) => a.nodeKey.localeCompare(b.nodeKey));
    const pairCount = Math.min(leftNodes.length, rightNodes.length);

    for (let index = 0; index < pairCount; index += 1) {
      pairs.push({
        stem,
        left: leftNodes[index],
        right: rightNodes[index],
      });
    }

    if (leftNodes.length > pairCount) {
      unpairedLeft.push(...leftNodes.slice(pairCount));
    }
    if (rightNodes.length > pairCount) {
      unpairedRight.push(...rightNodes.slice(pairCount));
    }
  }

  return { pairs, unpairedLeft, unpairedRight, neutral };
}

/**
 * Return the opposite-side node key if the provided semantic key belongs
 * to an inferred left/right chiral pair.
 */
export function getChiralCounterpartNodeKey(
  profile: Pick<Profile, 'boneNodes'>,
  nodeKey: string,
): string | null {
  const inference = inferChiralBonePairs(profile);
  for (const pair of inference.pairs) {
    if (pair.left.nodeKey === nodeKey) return pair.right.nodeKey;
    if (pair.right.nodeKey === nodeKey) return pair.left.nodeKey;
  }
  return null;
}
