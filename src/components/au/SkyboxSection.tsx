import { useState, useEffect, memo } from 'react';
import { VStack, HStack, Text, Slider, Box, Button } from '@chakra-ui/react';
import { EngineThree } from '../../engine/EngineThree';
import DockableAccordionItem from './DockableAccordionItem';

interface SkyboxSectionProps {
  engine: EngineThree | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

function SkyboxSection({ engine, disabled = false, defaultExpanded = false }: SkyboxSectionProps) {
  // Skybox controls
  const [blur, setBlur] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Initialize from engine once it's ready
  useEffect(() => {
    if (!engine) return;

    const syncFromEngine = () => {
      const skyboxReady = engine.isSkyboxReady();
      setIsReady(skyboxReady);
    };

    syncFromEngine();
    const timeout = requestAnimationFrame(syncFromEngine);
    return () => cancelAnimationFrame(timeout);
  }, [engine]);

  // Skybox handlers
  const handleBlurChange = (details: { value: number[] }) => {
    const value = details.value[0];
    setBlur(value);
    engine?.setSkyboxBlur(value);
  };

  const handleIntensityChange = (details: { value: number[] }) => {
    const value = details.value[0];
    setIntensity(value);
    engine?.setSkyboxIntensity(value);
  };

  const resetToDefaults = () => {
    // Reset skybox
    setBlur(0);
    setIntensity(1);
    engine?.setSkyboxBlur(0);
    engine?.setSkyboxIntensity(1);
  };
  if (!isReady) {
    return (
      <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="white">Loading...</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
      <VStack gap={4} align="stretch" p={2}>
        <Button size="sm" onClick={resetToDefaults} colorPalette="red" variant="outline">
          Reset to Defaults
        </Button>

        {/* Skybox Controls */}
        {isReady && (
          <>
            <Text fontSize="xs" fontWeight="bold" color="white" textTransform="uppercase" letterSpacing="wider">
              Skybox
            </Text>

            {/* Blur */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="white">Blur</Text>
                <Text fontSize="xs" color="white">{(blur * 100).toFixed(0)}%</Text>
              </HStack>
              <Slider.Root
                value={[blur]}
                onValueChange={handleBlurChange}
                min={0}
                max={1}
                step={0.01}
                disabled={disabled}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>

            {/* Intensity (uses scene backgroundIntensity) */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="white">Intensity</Text>
                <Text fontSize="xs" color="white">{(intensity * 100).toFixed(0)}%</Text>
              </HStack>
              <Slider.Root
                value={[intensity]}
                onValueChange={handleIntensityChange}
                min={0}
                max={2}
                step={0.01}
                disabled={disabled}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>
          </>
        )}

      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(SkyboxSection);
