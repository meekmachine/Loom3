import React, { memo, useCallback } from 'react';
import { VStack, Box, Text, Button, HStack } from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { toaster } from '../ui/toaster';
import DockableAccordionItem from './DockableAccordionItem';
import AUSlider from './AUSlider';
import ContinuumSlider from './ContinuumSlider';
import { CurveEditor } from '../CurveEditor';
import { AUInfo, CONTINUUM_PAIRS_MAP, CONTINUUM_LABELS } from '../../engine/arkit/shapeDict';
import { EngineThree } from '../../engine/EngineThree';

// Build CONTINUUM_PAIRS from CONTINUUM_PAIRS_MAP
const CONTINUUM_PAIRS: Array<{ negative: number; positive: number; showBlend: boolean }> = (() => {
  const seen = new Set<string>();
  const pairs: Array<{ negative: number; positive: number; showBlend: boolean }> = [];
  for (const [auIdStr, info] of Object.entries(CONTINUUM_PAIRS_MAP)) {
    const auId = Number(auIdStr);
    if (info.isNegative) {
      const key = `${auId}-${info.pairId}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ negative: auId, positive: info.pairId, showBlend: true });
      }
    }
  }
  return pairs;
})();
import type { NormalizedSnippet } from '../../latticework/animation/types';
import { useEngineState } from '../../context/engineContext';

type Keyframe = { time: number; value: number };

type SnippetCurveData = {
  snippetName: string;
  keyframes: Keyframe[];
  snippet: NormalizedSnippet;
};

type ContinuumPair = typeof CONTINUUM_PAIRS[number];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const continuumKey = (pair: ContinuumPair) => `${pair.negative}-${pair.positive}`;

const getContinuumLabel = (pair: ContinuumPair) =>
  CONTINUUM_LABELS[continuumKey(pair)] ?? `AU ${pair.negative} ↔ AU ${pair.positive}`;

// Linear interpolation helper to reconstruct a curve's value at an arbitrary time
const getValueAtTime = (keyframes: Keyframe[], time: number): number => {
  if (!keyframes.length) return 0;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time === a.time) return a.value;
    if (time >= a.time && time <= b.time) {
      const t = (time - a.time) / (b.time - a.time || 1);
      return a.value + t * (b.value - a.value);
    }
  }
  return sorted[sorted.length - 1].value;
};

// Merge negative and positive AU curves into a single continuum (-1..1)
const buildContinuumKeyframes = (negKeyframes: Keyframe[], posKeyframes: Keyframe[]): Keyframe[] => {
  const times = Array.from(
    new Set([...negKeyframes.map(k => k.time), ...posKeyframes.map(k => k.time)])
  ).sort((a, b) => a - b);

  return times.map((time) => {
    const posVal = getValueAtTime(posKeyframes, time);
    const negVal = getValueAtTime(negKeyframes, time);
    return {
      time,
      value: clamp(posVal - negVal, -1, 1),
    };
  });
};

// Build continuum curve data for a pair, combining snippets that contain both AUs
const buildContinuumCurveData = (
  pair: ContinuumPair,
  auSnippetCurves: Record<string, SnippetCurveData[]>
): SnippetCurveData[] => {
  const negKey = String(pair.negative);
  const posKey = String(pair.positive);
  const negativeCurves = auSnippetCurves[negKey] || [];
  const positiveCurves = auSnippetCurves[posKey] || [];

  const negByName = new Map(negativeCurves.map(c => [c.snippetName, c]));
  const posByName = new Map(positiveCurves.map(c => [c.snippetName, c]));
  const combinedNames = new Set<string>();

  negativeCurves.forEach(c => { if (posByName.has(c.snippetName)) combinedNames.add(c.snippetName); });
  positiveCurves.forEach(c => { if (negByName.has(c.snippetName)) combinedNames.add(c.snippetName); });

  const combined: SnippetCurveData[] = [];
  combinedNames.forEach((name) => {
    const neg = negByName.get(name);
    const pos = posByName.get(name);
    if (!neg || !pos) return;

    combined.push({
      snippetName: name,
      keyframes: buildContinuumKeyframes(neg.keyframes, pos.keyframes),
      snippet: {
        ...neg.snippet,
        ...pos.snippet,
      },
    });
  });

  return combined;
};

interface AUSectionProps {
  section: string;
  aus: AUInfo[];
  engine?: EngineThree | null;
  disabled?: boolean;
  useCurveEditor?: boolean;
  auSnippetCurves?: Record<string, SnippetCurveData[]>;
}

/**
 * AUSection - Renders AU sliders for a section
 * Shows continuum sliders for paired AUs, individual sliders for others
 * UNCONTROLLED - each slider manages its own state
 */
function AUSection({
  section,
  aus,
  engine,
  disabled = false,
  useCurveEditor = false,
  auSnippetCurves = {}
}: AUSectionProps) {
  const { anim } = useEngineState();

  // Build a map of AU ID to continuum pair info
  const continuumMap = new Map<number, { pair: typeof CONTINUUM_PAIRS[0]; isNegative: boolean }>();
  CONTINUUM_PAIRS.forEach(pair => {
    continuumMap.set(pair.negative, { pair, isNegative: true });
    continuumMap.set(pair.positive, { pair, isNegative: false });
  });

  // Track which AUs we've already rendered as part of a continuum
  const renderedAUs = new Set<string>();

  // Create a new animation snippet for an AU
  const createNewAnimation = (auId: string, auName: string) => {
    if (!anim) {
      toaster.error({
        title: 'Animation service not available',
      });
      return;
    }

    const name = prompt(`Enter name for ${auName} (AU ${auId}) animation:`, `${auName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`);
    if (!name) return;

    // Create a default animation with a simple rise-and-fall curve
    const snippet = {
      name,
      snippetCategory: 'auSnippet',
      snippetPriority: 0,
      snippetPlaybackRate: 1,
      snippetIntensityScale: 1,
      loop: false,
      curves: {
        [auId]: [
          { time: 0.0, intensity: 0 },
          { time: 0.5, intensity: 70 },
          { time: 1.5, intensity: 70 },
          { time: 2.0, intensity: 0 }
        ]
      }
    };

    anim.schedule(snippet);
    anim.setSnippetPlaying(name, true);

    toaster.success({
      title: 'Animation created',
      description: `${name} added to animation service`,
    });
  };

  // If curve editor mode, render curve editors for all AUs (one per snippet)
  if (useCurveEditor) {
    const renderedContinuums = new Set<string>();

    return (
      <DockableAccordionItem title={section}>
        <VStack gap={4} mt={2} align="stretch">
          {aus.map((au) => {
            if (renderedAUs.has(au.id)) return null;

            const auNum = parseInt(au.id);
            const continuumInfo = continuumMap.get(auNum);

            // Continuum-aware curve editors (mirror how sliders combine AU pairs)
            if (continuumInfo) {
              const { pair, isNegative } = continuumInfo;
              const pairedAUId = isNegative ? pair.positive : pair.negative;
              const pairedAU = aus.find(a => parseInt(a.id) === pairedAUId);

              if (pairedAU) {
                const key = continuumKey(pair);
                if (renderedContinuums.has(key)) return null;

                renderedContinuums.add(key);
                renderedAUs.add(au.id);
                renderedAUs.add(pairedAU.id);

                const continuumCurves = buildContinuumCurveData(pair, auSnippetCurves);
                const label = getContinuumLabel(pair);

                if (continuumCurves.length === 0) {
                  return (
                    <Box
                      key={key}
                      w="100%"
                      p={3}
                      bg="gray.750"
                      borderRadius="md"
                      border="1px dashed"
                      borderColor="gray.600"
                    >
                      <HStack justify="space-between" align="flex-start">
                        <Box>
                          <Text fontSize="sm" color="gray.200" fontWeight="semibold">
                            {label} (AU {pair.negative} ↔ AU {pair.positive})
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            Continuum curves mirror the sliders (morph + bone). Add a snippet that includes both sides of this pair.
                          </Text>
                        </Box>
                        <Text fontSize="xs" color="gray.500">No curves</Text>
                      </HStack>
                    </Box>
                  );
                }

                return (
                  <VStack key={key} w="100%" gap={3} align="stretch">
                    {continuumCurves.map((curveData, idx) => (
                      <Box key={`${key}-${curveData.snippetName}-${idx}`} w="100%">
                        <CurveEditor
                          auId={`${pair.negative}↔${pair.positive}`}
                          label={`${label} — ${curveData.snippetName}`}
                          keyframes={curveData.keyframes}
                          duration={curveData.snippet.duration || 2.0}
                          currentTime={curveData.snippet.currentTime || 0}
                          isPlaying={curveData.snippet.isPlaying || false}
                          valueMin={-1}
                          valueMax={1}
                        />
                      </Box>
                    ))}
                  </VStack>
                );
              }
            }

            const snippetCurves = auSnippetCurves[au.id] || [];

            // If no curves, show placeholder with add button
            if (snippetCurves.length === 0) {
              return (
                <Box key={au.id} w="100%" p={3} bg="gray.700" borderRadius="md" border="1px dashed" borderColor="gray.600">
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.300">
                      {au.name} (AU {au.id})
                    </Text>
                    <Button
                      size="xs"
                      colorPalette="brand"
                      variant="outline"
                      onClick={() => createNewAnimation(au.id, au.name)}
                    >
                      <Plus size={14} /> Add Animation
                    </Button>
                  </HStack>
                </Box>
              );
            }

            // Render one curve editor per snippet
            return (
              <VStack key={au.id} w="100%" gap={3} align="stretch">
                {snippetCurves.map((curveData, idx) => (
                  <Box key={`${au.id}-${curveData.snippetName}-${idx}`} w="100%">
                    <CurveEditor
                      auId={au.id}
                      label={`${au.name} - ${curveData.snippetName}`}
                      keyframes={curveData.keyframes}
                      duration={curveData.snippet.duration || 2.0}
                      currentTime={curveData.snippet.currentTime || 0}
                      isPlaying={curveData.snippet.isPlaying || false}
                      onChange={() => {
                        // Note: In this read-only view from animation service,
                        // we don't update the snippets directly. The animation service
                        // controls the keyframes. This is just for visualization.
                      }}
                    />
                  </Box>
                ))}
              </VStack>
            );
          })}
        </VStack>
      </DockableAccordionItem>
    );
  }

  // Otherwise, render sliders (existing behavior)
  return (
    <DockableAccordionItem title={section}>
      <VStack gap={4} mt={2} align="stretch">
        {aus.map((au) => {
          const auNum = parseInt(au.id);

          // Skip if already rendered as part of a continuum pair
          if (renderedAUs.has(au.id)) return null;

          // Check if this AU is part of a continuum pair
          const continuumInfo = continuumMap.get(auNum);

          if (continuumInfo) {
            // Find the paired AU
            const { pair, isNegative } = continuumInfo;
            const pairedAUId = isNegative ? pair.positive : pair.negative;
            const pairedAU = aus.find(a => parseInt(a.id) === pairedAUId);

            if (!pairedAU) {
              // Pair not in this section, render as individual AU slider
              // AUSlider now handles balance internally for bilateral AUs
              return (
                <Box key={au.id} w="100%">
                  <AUSlider
                    au={au.id}
                    name={au.name}
                    muscularBasis={au.muscularBasis}
                    links={au.links}
                    engine={engine}
                    disabled={disabled}
                  />
                </Box>
              );
            }

            // Mark both AUs as rendered
            renderedAUs.add(au.id);
            renderedAUs.add(pairedAU.id);

            // Render continuum slider
            const negativeAU = isNegative ? au : pairedAU;
            const positiveAU = isNegative ? pairedAU : au;

            return (
              <Box key={`${pair.negative}-${pair.positive}`} w="100%">
                <ContinuumSlider
                  negativeAU={negativeAU}
                  positiveAU={positiveAU}
                  engine={engine}
                  showBlendSlider={pair.showBlend}
                  disabled={disabled}
                />
              </Box>
            );
          }

          // Regular individual AU slider
          // AUSlider now handles balance internally for bilateral AUs (L/R morphs)
          return (
            <Box key={au.id} w="100%">
              <AUSlider
                au={au.id}
                name={au.name}
                muscularBasis={au.muscularBasis}
                links={au.links}
                engine={engine}
                disabled={disabled}
              />
            </Box>
          );
        })}
      </VStack>
    </DockableAccordionItem>
  );
}

// Custom comparison - only rerender if meaningful props change
// auSnippetCurves changes frequently during animation playback, but we only need
// to rerender if the curves for THIS section's AUs actually changed
function arePropsEqual(
  prev: AUSectionProps,
  next: AUSectionProps
): boolean {
  // Quick checks for primitive/reference equality
  if (prev.section !== next.section) return false;
  if (prev.disabled !== next.disabled) return false;
  if (prev.useCurveEditor !== next.useCurveEditor) return false;
  if (prev.engine !== next.engine) return false;

  // Check if aus array contents changed (by reference since they come from auGroups)
  if (prev.aus !== next.aus) {
    // If lengths differ, definitely changed
    if (prev.aus.length !== next.aus.length) return false;
    // Check if any AU id changed
    for (let i = 0; i < prev.aus.length; i++) {
      if (prev.aus[i].id !== next.aus[i].id) return false;
    }
  }

  // For auSnippetCurves, only check if curves for our AUs changed
  // This prevents rerenders when other sections' curves update
  if (prev.useCurveEditor && next.useCurveEditor) {
    const prevCurves = prev.auSnippetCurves || {};
    const nextCurves = next.auSnippetCurves || {};

    for (const au of next.aus) {
      if (prevCurves[au.id] !== nextCurves[au.id]) return false;
    }
  }

  return true;
}

// Memoize to prevent rerenders when parent state changes
export default memo(AUSection, arePropsEqual);
