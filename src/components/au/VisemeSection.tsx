import { useState, useCallback, memo } from 'react';
import { VStack, Box, Text, Slider, Tooltip, HStack, Button } from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { toaster } from '../ui/toaster';
import DockableAccordionItem from './DockableAccordionItem';
import { CurveEditor } from '../CurveEditor';
import { EngineThree } from '../../engine/EngineThree';
import { VISEME_KEYS } from '../../engine/arkit/shapeDict';
import type { NormalizedSnippet } from '../../latticework/animation/types';
import { useEngineState } from '../../context/engineContext';

type Keyframe = { time: number; value: number };

type SnippetCurveData = {
  snippetName: string;
  keyframes: Keyframe[];
  snippet: NormalizedSnippet;
};

const getSliderColor = (value: number): string => {
  const teal = { r: 0, g: 128, b: 128 };
  const magenta = { r: 255, g: 0, b: 255 };
  const r = Math.round(teal.r + (magenta.r - teal.r) * value);
  const g = Math.round(teal.g + (magenta.g - teal.g) * value);
  const b = Math.round(teal.b + (magenta.b - teal.b) * value);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * UNCONTROLLED viseme slider - manages its own state
 *
 * IMPORTANT: Uses engine.setViseme() which applies BOTH the morph target AND
 * jaw bone rotation in a coordinated way. Do NOT use setAU(26) for jaw here -
 * that would conflict with the viseme system's internal jaw coordination and
 * cause double jaw movement.
 */
interface VisemeSliderProps {
  visemeKey: string;
  disabled: boolean;
  engine?: EngineThree | null;
}

const VisemeSlider = memo(function VisemeSlider({
  visemeKey,
  disabled,
  engine
}: VisemeSliderProps) {
  // Internal state - component is uncontrolled
  const [value, setValue] = useState(0);
  const [jawRatio, setJawRatio] = useState(1.0);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleVisemeChange = useCallback((details: { value: number[] }) => {
    const v = details.value[0];
    setValue(v);

    // Use setViseme to apply both morph AND jaw bone rotation in sync
    // This avoids conflicting with AU 26 which would cause double jaw movement
    if (engine) {
      const visemeIndex = VISEME_KEYS.indexOf(visemeKey);
      if (visemeIndex >= 0) {
        engine.setViseme(visemeIndex, v, jawRatio);
      } else {
        // Fallback for unknown viseme keys
        engine.setMorph(visemeKey, v);
      }
    }
  }, [visemeKey, engine, jawRatio]);

  const handleJawRatioChange = useCallback((details: { value: number[] }) => {
    const v = details.value[0];
    setJawRatio(v);

    // Re-apply current viseme with new jaw ratio using setViseme
    if (engine && value > 0) {
      const visemeIndex = VISEME_KEYS.indexOf(visemeKey);
      if (visemeIndex >= 0) {
        engine.setViseme(visemeIndex, value, v);
      }
    }
  }, [visemeKey, engine, value]);

  return (
    <VStack width="100%" align="stretch" gap={2}>
      <Box>
        <Text mb="2" fontSize="sm">
          {visemeKey}
        </Text>
        <Slider.Root
          value={[value]}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          onValueChange={handleVisemeChange}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range style={{ background: getSliderColor(value) }} />
            </Slider.Track>
            <Tooltip.Root open={showTooltip}>
              <Tooltip.Trigger asChild>
                <Slider.Thumb index={0} boxSize={6} />
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content bg="gray.300" color="black">
                  {`${(value * 100).toFixed(0)}%`}
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          </Slider.Control>
        </Slider.Root>
      </Box>

      {/* Lip ↔ Jaw ratio slider */}
      <Box pt={2} borderTop="1px solid rgba(255,255,255,0.12)">
        <HStack mb={1} justify="space-between">
          <Text fontSize="xs" opacity={0.8}>Lip ↔ Jaw</Text>
          <Text fontSize="xs" opacity={0.6}>
            {jawRatio.toFixed(2)}
          </Text>
        </HStack>
        <Slider.Root
          aria-label={[`${visemeKey}-jaw-ratio`]}
          min={0}
          max={1}
          step={0.01}
          value={[jawRatio]}
          disabled={disabled}
          onValueChange={handleJawRatioChange}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} boxSize={4} />
          </Slider.Control>
        </Slider.Root>
      </Box>
    </VStack>
  );
});

interface VisemeSectionProps {
  engine?: EngineThree | null;
  disabled?: boolean;
  useCurveEditor?: boolean;
  visemeSnippetCurves?: Record<string, SnippetCurveData[]>;
  defaultExpanded?: boolean;
}

/**
 * VisemeSection - Controls for viseme blendshapes
 * Visemes are phoneme-based mouth shapes used for speech animation
 * UNCONTROLLED - each slider manages its own state
 */
function VisemeSection({
  engine,
  disabled = false,
  useCurveEditor = false,
  visemeSnippetCurves = {},
  defaultExpanded = false
}: VisemeSectionProps) {
  const { anim } = useEngineState();

  // Create a new animation snippet for a viseme
  const createNewVisemeAnimation = useCallback((visemeIndex: number, visemeKey: string) => {
    if (!anim) {
      toaster.error({
        title: 'Animation service not available',
      });
      return;
    }

    const name = prompt(`Enter name for ${visemeKey} (viseme ${visemeIndex}) animation:`, `${visemeKey.toLowerCase()}_${Date.now()}`);
    if (!name) return;

    // Create a default animation with a simple rise-and-fall curve
    const snippet = {
      name,
      snippetCategory: 'visemeSnippet',
      snippetPriority: -50,
      snippetPlaybackRate: 1,
      snippetIntensityScale: 1,
      loop: false,
      curves: {
        [visemeIndex]: [
          { time: 0.0, intensity: 0 },
          { time: 0.3, intensity: 90 },
          { time: 0.7, intensity: 90 },
          { time: 1.0, intensity: 0 }
        ]
      }
    };

    anim.schedule(snippet);
    anim.setSnippetPlaying(name, true);

    toaster.success({
      title: 'Viseme animation created',
      description: `${name} added to animation service`,
    });
  }, [anim]);

  // If curve editor mode, render curve editors for all visemes (one per snippet)
  if (useCurveEditor) {
    return (
      <DockableAccordionItem title="Visemes (Speech)" isDefaultExpanded={defaultExpanded}>
        <VStack gap={4} mt={2} align="stretch">
          {VISEME_KEYS.map((key, index) => {
            // Viseme snippets use numeric indices (0-21) as curve IDs
            // Map the ARKit key to its index to find the curves
            const snippetCurves = visemeSnippetCurves[index.toString()] || [];

            // If no curves, show placeholder with add button
            if (snippetCurves.length === 0) {
              return (
                <Box key={key} w="100%" p={3} bg="gray.700" borderRadius="md" border="1px dashed" borderColor="gray.600">
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="white">
                      {key} (index {index})
                    </Text>
                    <Button
                      size="xs"
                      colorPalette="brand"
                      variant="outline"
                      onClick={() => createNewVisemeAnimation(index, key)}
                    >
                      <Plus size={14} /> Add Animation
                    </Button>
                  </HStack>
                </Box>
              );
            }

            // Render one curve editor per snippet
            return (
              <VStack key={key} w="100%" gap={3} align="stretch">
                {snippetCurves.map((curveData, idx) => (
                  <Box key={`${key}-${curveData.snippetName}-${idx}`} w="100%">
                    <CurveEditor
                      auId={index.toString()}
                      label={`${key} (${index}) - ${curveData.snippetName}`}
                      keyframes={curveData.keyframes}
                      duration={curveData.snippet.duration || 2.0}
                      currentTime={curveData.snippet.currentTime || 0}
                      isPlaying={curveData.snippet.isPlaying || false}
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
    <DockableAccordionItem title="Visemes (Speech)" isDefaultExpanded={defaultExpanded}>
      <VStack gap={4} mt={2} align="stretch">
        {VISEME_KEYS.map((key) => (
          <VisemeSlider
            key={key}
            visemeKey={key}
            disabled={disabled}
            engine={engine}
          />
        ))}
      </VStack>
    </DockableAccordionItem>
  );
}

// Memoize the section to prevent rerenders from parent state changes
export default memo(VisemeSection);
