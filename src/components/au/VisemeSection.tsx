import React, { useState } from 'react';
import { VStack, Box, Text, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Tooltip, HStack } from '@chakra-ui/react';
import DockableAccordionItem from './DockableAccordionItem';
import { EngineThree } from '../../engine/EngineThree';
import { VISEME_KEYS } from '../../engine/arkit/shapeDict';

interface VisemeSectionProps {
  engine?: EngineThree;
  visemeStates: Record<string, number>;
  onVisemeChange: (key: string, value: number) => void;
  disabled?: boolean;
}

/**
 * VisemeSection - Controls for viseme blendshapes
 * Visemes are phoneme-based mouth shapes used for speech animation
 *
 * Maps each viseme to appropriate jaw opening amount (0-1 scale)
 */
export default function VisemeSection({ engine, visemeStates, onVisemeChange, disabled = false }: VisemeSectionProps) {
  const [tooltipStates, setTooltipStates] = useState<Record<string, boolean>>({});
  const [jawRatios, setJawRatios] = useState<Record<string, number>>({});

  // Jaw opening intensity per viseme (0 = closed, 1 = fully open)
  const VISEME_JAW_MAP: Record<string, number> = {
    'Ah': 1.0,      // Wide open
    'W_OO': 0.4,    // Rounded, moderate open
    'Oh': 0.7,      // Medium-wide open
    'EE': 0.2,      // Slight open, lips spread
    'Er': 0.4,      // Medium open
    'IH': 0.3,      // Small open
    'AE': 0.6,      // Medium-wide open (as in "cat")
    'R': 0.3,       // Small open
    'S_Z': 0.1,     // Nearly closed
    'Ch_J': 0.2,    // Slight open
    'F_V': 0.15,    // Nearly closed, teeth on lip
    'TH': 0.2,      // Slight open for tongue
    'T_L_D_N': 0.15, // Slight open for tongue-teeth contact
    'B_M_P': 0.0,   // Closed (bilabial)
    'K_G_H_NG': 0.3, // Medium open (velar/glottal)
  };

  const getSliderColor = (value: number): string => {
    const teal = { r: 0, g: 128, b: 128 };
    const magenta = { r: 255, g: 0, b: 255 };
    const r = Math.round(teal.r + (magenta.r - teal.r) * value);
    const g = Math.round(teal.g + (magenta.g - teal.g) * value);
    const b = Math.round(teal.b + (magenta.b - teal.b) * value);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <DockableAccordionItem title="Visemes (Speech)">
      <VStack spacing={4} mt={2} align="stretch">
        {VISEME_KEYS.map((key) => {
          const value = visemeStates[key] ?? 0;
          const jawRatio = jawRatios[key] ?? 1.0; // Default to full jaw rotation

          return (
            <VStack key={key} width="100%" align="stretch" spacing={2}>
              <Box>
                <Text mb="2" fontSize="sm">
                  {key}
                </Text>
                <Slider
                  value={value}
                  min={0}
                  max={1}
                  step={0.01}
                  isDisabled={disabled}
                  onChange={(v) => {
                    onVisemeChange(key, v);
                    engine?.setMorph(key, v);

                    // Apply jaw bone rotation based on viseme type and ratio
                    if (engine) {
                      const jawAmount = VISEME_JAW_MAP[key] ?? 0;
                      // Scale the jaw opening by viseme intensity, jaw mapping, and user-controlled ratio
                      // AU 26 = Jaw Drop with bone rotation
                      engine.setAU(26, v * jawAmount * jawRatio);
                    }
                  }}
                  onMouseEnter={() => setTooltipStates(prev => ({ ...prev, [key]: true }))}
                  onMouseLeave={() => setTooltipStates(prev => ({ ...prev, [key]: false }))}
                >
                  <SliderTrack>
                    <SliderFilledTrack bg={getSliderColor(value)} />
                  </SliderTrack>
                  <Tooltip
                    hasArrow
                    label={`${(value * 100).toFixed(0)}%`}
                    bg="gray.300"
                    color="black"
                    placement="top"
                    isOpen={tooltipStates[key]}
                  >
                    <SliderThumb boxSize={6} />
                  </Tooltip>
                </Slider>
              </Box>

              {/* Lip ↔ Jaw ratio slider */}
              <Box pt={2} borderTop="1px solid rgba(255,255,255,0.12)">
                <HStack mb={1} justify="space-between">
                  <Text fontSize="xs" opacity={0.8}>Lip ↔ Jaw</Text>
                  <Text fontSize="xs" opacity={0.6}>
                    {jawRatio.toFixed(2)}
                  </Text>
                </HStack>
                <Slider
                  aria-label={`${key}-jaw-ratio`}
                  min={0}
                  max={1}
                  step={0.01}
                  value={jawRatio}
                  isDisabled={disabled}
                  onChange={(v) => {
                    setJawRatios(prev => ({ ...prev, [key]: v }));

                    // Re-apply current viseme with new jaw ratio
                    if (engine && value > 0) {
                      const jawAmount = VISEME_JAW_MAP[key] ?? 0;
                      engine.setAU(26, value * jawAmount * v);
                    }
                  }}
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb boxSize={4} />
                </Slider>
              </Box>
            </VStack>
          );
        })}
      </VStack>
    </DockableAccordionItem>
  );
}
