import React from 'react';
import { VStack, Box } from '@chakra-ui/react';
import DockableAccordionItem from './DockableAccordionItem';
import AUSlider from './AUSlider';
import ContinuumSlider from './ContinuumSlider';
import { AUInfo, CONTINUUM_PAIRS } from '../../engine/arkit/shapeDict';
import { EngineThree } from '../../engine/EngineThree';

interface AUSectionProps {
  section: string;
  aus: AUInfo[];
  auStates: Record<string, number>;
  engine?: EngineThree;
  showUnusedSliders?: boolean;
  onAUChange?: (id: string, value: number) => void;
  disabled?: boolean;
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
  disabled = false
}: AUSectionProps) {
  // Build a map of AU ID to continuum pair info
  const continuumMap = new Map<number, { pair: typeof CONTINUUM_PAIRS[0]; isNegative: boolean }>();
  CONTINUUM_PAIRS.forEach(pair => {
    continuumMap.set(pair.negative, { pair, isNegative: true });
    continuumMap.set(pair.positive, { pair, isNegative: false });
  });

  // Track which AUs we've already rendered as part of a continuum
  const renderedAUs = new Set<string>();

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
              if (!showUnusedSliders && intensity <= 0) return null;

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

            // Determine which continuum helper to call
            const isEyesHorizontal = pair.negative === 61 && pair.positive === 62;
            const isEyesVertical = pair.negative === 64 && pair.positive === 63;
            const isHeadHorizontal = pair.negative === 31 && pair.positive === 32;
            const isHeadVertical = pair.negative === 54 && pair.positive === 33;
            const isHeadTilt = pair.negative === 55 && pair.positive === 56;
            const isJawHorizontal = pair.negative === 30 && pair.positive === 35;

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
                    // Update local state
                    if (val >= 0) {
                      onAUChange?.(positiveAU.id, val);
                      onAUChange?.(negativeAU.id, 0);
                    } else {
                      onAUChange?.(negativeAU.id, -val);
                      onAUChange?.(positiveAU.id, 0);
                    }

                    // Call the appropriate engine helper
                    if (isEyesHorizontal) {
                      engine?.setEyesHorizontal(val);
                    } else if (isEyesVertical) {
                      engine?.setEyesVertical(val);
                    } else if (isHeadHorizontal) {
                      engine?.setHeadHorizontal(val);
                    } else if (isHeadVertical) {
                      engine?.setHeadVertical(val);
                    } else if (isHeadTilt) {
                      engine?.setHeadTilt(val);
                    } else if (isJawHorizontal) {
                      engine?.setJawHorizontal(val);
                    }
                  }}
                />
              </Box>
            );
          }

          // Regular individual AU slider
          const intensity = auStates[au.id] ?? 0;
          if (!showUnusedSliders && intensity <= 0) return null;

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
