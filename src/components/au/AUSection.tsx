import React from 'react';
import { VStack, Box, Text, Button, HStack, useToast } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';
import DockableAccordionItem from './DockableAccordionItem';
import AUSlider from './AUSlider';
import ContinuumSlider from './ContinuumSlider';
import { CurveEditor } from '../CurveEditor';
import { AUInfo } from '../../engine/arkit/shapeDict';
import { EngineThree, CONTINUUM_PAIRS, hasLeftRightMorphs } from '../../engine/EngineThree';
import type { NormalizedSnippet } from '../../latticework/animation/types';
import { useEngineState } from '../../context/engineContext';

type Keyframe = { time: number; value: number };

type SnippetCurveData = {
  snippetName: string;
  keyframes: Keyframe[];
  snippet: NormalizedSnippet;
};

type ContinuumPair = typeof CONTINUUM_PAIRS[number];

// Labels for continuum axes so curve editors match the slider language
const CONTINUUM_LABELS: Record<string, string> = {
  '61-62': 'Eyes — Horizontal',
  '64-63': 'Eyes — Vertical',
  '31-32': 'Head — Horizontal',
  '54-33': 'Head — Vertical',
  '55-56': 'Head — Tilt',
  '30-35': 'Jaw — Horizontal',
  '38-37': 'Tongue — Vertical',
  '39-40': 'Tongue — Horizontal',
};

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
  auStates: Record<string, number>;
  engine?: EngineThree | null;
  showUnusedSliders?: boolean;
  onAUChange?: (id: string, value: number) => void;
  disabled?: boolean;
  useCurveEditor?: boolean;
  auSnippetCurves?: Record<string, SnippetCurveData[]>;
}

/**
 * AUSection - Renders AU sliders for a section
 * Shows continuum sliders for paired AUs, individual sliders for others
 */
export default function AUSection({
  section,
  aus,
  auStates,
  engine,
  showUnusedSliders = false,
  onAUChange,
  disabled = false,
  useCurveEditor = false,
  auSnippetCurves = {}
}: AUSectionProps) {
  const { anim } = useEngineState();
  const toast = useToast();

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
      toast({
        title: 'Animation service not available',
        status: 'error',
        duration: 3000
      });
      return;
    }

    const name = prompt(`Enter name for ${auName} (AU ${auId}) animation:`, `${auName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`);
    if (!name) return;

    // Get current AU intensity from state (0-1 range), convert to 0-100 for animation curves
    const currentIntensity = (auStates[auId] ?? 0) * 100;

    // Create a default animation with a simple rise-and-fall curve
    // Start from current slider position
    const snippet = {
      name,
      snippetCategory: 'auSnippet',
      snippetPriority: 0,
      snippetPlaybackRate: 1,
      snippetIntensityScale: 1,
      loop: false,
      curves: {
        [auId]: [
          { time: 0.0, intensity: currentIntensity },
          { time: 0.5, intensity: 70 },
          { time: 1.5, intensity: 70 },
          { time: 2.0, intensity: currentIntensity }
        ]
      }
    };

    anim.schedule(snippet);
    anim.setSnippetPlaying(name, true);

    toast({
      title: 'Animation created',
      description: `${name} added to animation service`,
      status: 'success',
      duration: 3000
    });
  };

  // If curve editor mode, render curve editors for all AUs (one per snippet)
  if (useCurveEditor) {
    console.log(`[AUSection:${section}] Curve editor mode enabled`);
    console.log(`[AUSection:${section}] auSnippetCurves:`, auSnippetCurves);
    console.log(`[AUSection:${section}] AUs in this section:`, aus.map(au => au.id));
    const renderedContinuums = new Set<string>();

    return (
      <DockableAccordionItem title={section}>
        <VStack spacing={4} mt={2} align="stretch">
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
                  <VStack key={key} w="100%" spacing={3} align="stretch">
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
            console.log(`[AUSection:${section}] AU ${au.id} (${au.name}) has ${snippetCurves.length} curves`);

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
                      leftIcon={<AddIcon />}
                      colorScheme="brand"
                      variant="outline"
                      onClick={() => createNewAnimation(au.id, au.name)}
                    >
                      Add Animation
                    </Button>
                  </HStack>
                </Box>
              );
            }

            // Render one curve editor per snippet
            return (
              <VStack key={au.id} w="100%" spacing={3} align="stretch">
                {snippetCurves.map((curveData, idx) => (
                  <Box key={`${au.id}-${curveData.snippetName}-${idx}`} w="100%">
                    <CurveEditor
                      auId={au.id}
                      label={`${au.name} - ${curveData.snippetName}`}
                      keyframes={curveData.keyframes}
                      duration={curveData.snippet.duration || 2.0}
                      currentTime={curveData.snippet.currentTime || 0}
                      isPlaying={curveData.snippet.isPlaying || false}
                      onChange={(updated) => {
                        // Note: In this read-only view from animation service,
                        // we don't update the snippets directly. The animation service
                        // controls the keyframes. This is just for visualization.
                        console.log('Curve edited:', au.id, curveData.snippetName, updated);
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
      <VStack spacing={4} mt={2} align="stretch">
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
              // Pair not in this section, render as individual
              const intensity = auStates[au.id] ?? 0;
              const intensityL = auStates[`${au.id}L`] ?? 0;
              const intensityR = auStates[`${au.id}R`] ?? 0;

              // Check if this AU has left/right morphs
              const hasLR = hasLeftRightMorphs(auNum);

              if (!showUnusedSliders && intensity <= 0 && intensityL <= 0 && intensityR <= 0) return null;

              // If AU has left/right variants, render 3 sliders
              if (hasLR) {
                return (
                  <VStack key={au.id} w="100%" spacing={1} align="stretch">
                    <Box w="100%" bg="gray.800" p={2} borderRadius="md">
                      <AUSlider
                        au={au.id}
                        name={au.name}
                        intensity={intensity}
                        muscularBasis={au.muscularBasis}
                        links={au.links}
                        engine={engine}
                        disabled={disabled}
                        side="both"
                        onChange={(val) => {
                          onAUChange?.(au.id, val);
                        }}
                      />
                    </Box>
                    <HStack w="100%" spacing={2}>
                      <Box flex={1} bg="gray.750" p={2} borderRadius="md">
                        <AUSlider
                          au={au.id}
                          name={au.name}
                          intensity={intensityL}
                          engine={engine}
                          disabled={disabled}
                          side="L"
                          onChange={(val) => {
                            onAUChange?.(`${au.id}L`, val);
                          }}
                        />
                      </Box>
                      <Box flex={1} bg="gray.750" p={2} borderRadius="md">
                        <AUSlider
                          au={au.id}
                          name={au.name}
                          intensity={intensityR}
                          engine={engine}
                          disabled={disabled}
                          side="R"
                          onChange={(val) => {
                            onAUChange?.(`${au.id}R`, val);
                          }}
                        />
                      </Box>
                    </HStack>
                  </VStack>
                );
              }

              // Otherwise single bilateral slider
              return (
                <Box key={au.id} w="100%">
                  <AUSlider
                    au={au.id}
                    name={au.name}
                    intensity={intensity}
                    muscularBasis={au.muscularBasis}
                    links={au.links}
                    engine={engine}
                    disabled={disabled}
                    side="both"
                    onChange={(val) => {
                      onAUChange?.(au.id, val);
                      engine?.setAU(au.id as any, val);
                    }}
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
            const negValue = auStates[negativeAU.id] ?? 0;
            const posValue = auStates[positiveAU.id] ?? 0;
            const continuumValue = posValue - negValue;

            return (
              <Box key={`${pair.negative}-${pair.positive}`} w="100%">
                <ContinuumSlider
                  negativeAU={negativeAU}
                  positiveAU={positiveAU}
                  value={continuumValue}
                  engine={engine}
                  showBlendSlider={pair.showBlend}
                  disabled={disabled}
                  onChange={(val) => {
                    // Update local state for UI tracking
                    // ContinuumSlider calls engine.setContinuum() directly
                    if (val >= 0) {
                      onAUChange?.(positiveAU.id, val);
                      onAUChange?.(negativeAU.id, 0);
                    } else {
                      onAUChange?.(negativeAU.id, Math.abs(val));
                      onAUChange?.(positiveAU.id, 0);
                    }
                  }}
                />
              </Box>
            );
          }

          // Regular individual AU slider
          const intensity = auStates[au.id] ?? 0;
          const intensityL = auStates[`${au.id}L`] ?? 0;
          const intensityR = auStates[`${au.id}R`] ?? 0;

          // Check if this AU has left/right morphs
          const hasLR = hasLeftRightMorphs(auNum);

          if (!showUnusedSliders && intensity <= 0 && intensityL <= 0 && intensityR <= 0) return null;

          // If AU has left/right variants, render 3 sliders in a compact layout
          if (hasLR) {
            return (
              <VStack key={au.id} w="100%" spacing={1} align="stretch">
                {/* Both sides slider */}
                <Box w="100%" bg="gray.800" p={2} borderRadius="md">
                  <AUSlider
                    au={au.id}
                    name={au.name}
                    intensity={intensity}
                    muscularBasis={au.muscularBasis}
                    links={au.links}
                    engine={engine}
                    disabled={disabled}
                    side="both"
                    onChange={(val) => {
                      onAUChange?.(au.id, val);
                    }}
                  />
                </Box>

                {/* Left and Right sliders in a compact row */}
                <HStack w="100%" spacing={2}>
                  <Box flex={1} bg="gray.750" p={2} borderRadius="md">
                    <AUSlider
                      au={au.id}
                      name={au.name}
                      intensity={intensityL}
                      engine={engine}
                      disabled={disabled}
                      side="L"
                      onChange={(val) => {
                        onAUChange?.(`${au.id}L`, val);
                      }}
                    />
                  </Box>
                  <Box flex={1} bg="gray.750" p={2} borderRadius="md">
                    <AUSlider
                      au={au.id}
                      name={au.name}
                      intensity={intensityR}
                      engine={engine}
                      disabled={disabled}
                      side="R"
                      onChange={(val) => {
                        onAUChange?.(`${au.id}R`, val);
                      }}
                    />
                  </Box>
                </HStack>
              </VStack>
            );
          }

          // Otherwise render single bilateral slider
          return (
            <Box key={au.id} w="100%">
              <AUSlider
                au={au.id}
                name={au.name}
                intensity={intensity}
                muscularBasis={au.muscularBasis}
                links={au.links}
                engine={engine}
                disabled={disabled}
                side="both"
                onChange={(val) => {
                  onAUChange?.(au.id, val);

                  // Handle jaw AUs (25, 26, 27) like visemes
                  const auNum = parseInt(au.id);
                  if (auNum === 25 || auNum === 26 || auNum === 27) {
                    engine?.setMorph('Jaw_Open', val);
                    if (auNum === 27) {
                      engine?.setMorph('Mouth_Stretch_L', val);
                      engine?.setMorph('Mouth_Stretch_R', val);
                    }
                    engine?.setAU(auNum, val);
                  } else {
                    engine?.setAU(au.id as any, val);
                  }
                }}
              />
            </Box>
          );
        })}
      </VStack>
    </DockableAccordionItem>
  );
}
