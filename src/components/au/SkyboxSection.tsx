import { useState, useEffect } from 'react';
import {
  VStack,
  HStack,
  Text,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Box,
  Button,
} from '@chakra-ui/react';
import { EngineThree } from '../../engine/EngineThree';
import DockableAccordionItem from './DockableAccordionItem';

interface SkyboxSectionProps {
  engine: EngineThree | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

export default function SkyboxSection({ engine, disabled = false, defaultExpanded = false }: SkyboxSectionProps) {
  const [rotation, setRotation] = useState(0);
  const [blur, setBlur] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Check if skybox is ready - poll periodically since texture loads async
  useEffect(() => {
    if (!engine) return;

    const checkReady = () => {
      const ready = engine.isSkyboxReady();
      setIsReady(ready);
      return ready;
    };

    // Check immediately
    if (checkReady()) return;

    // Poll every 500ms until ready
    const interval = setInterval(() => {
      if (checkReady()) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [engine]);

  const handleRotationChange = (value: number) => {
    setRotation(value);
    engine?.setSkyboxRotation(value);
  };

  const handleBlurChange = (value: number) => {
    setBlur(value);
    engine?.setSkyboxBlur(value);
  };

  const handleIntensityChange = (value: number) => {
    setIntensity(value);
    engine?.setSkyboxIntensity(value);
  };

  const resetToDefaults = () => {
    setRotation(0);
    setBlur(0);
    setIntensity(1);
    engine?.setSkyboxRotation(0);
    engine?.setSkyboxBlur(0);
    engine?.setSkyboxIntensity(1);
  };

  if (!isReady) {
    return (
      <DockableAccordionItem title="Skybox" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">No skybox loaded</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Skybox" isDefaultExpanded={defaultExpanded}>
      <VStack spacing={4} align="stretch" p={2}>
        <Button size="sm" onClick={resetToDefaults} colorScheme="red" variant="outline">
          Reset to Defaults
        </Button>

        {/* Rotation */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="sm" color="gray.300">Rotation</Text>
            <Text fontSize="xs" color="gray.500">{rotation.toFixed(0)}°</Text>
          </HStack>
          <Slider
            value={rotation}
            onChange={handleRotationChange}
            min={0}
            max={360}
            step={1}
            isDisabled={disabled}
          >
            <SliderTrack bg="gray.600">
              <SliderFilledTrack bg="brand.500" />
            </SliderTrack>
            <SliderThumb boxSize={4} />
          </Slider>
        </Box>

        {/* Blur */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="sm" color="gray.300">Blur</Text>
            <Text fontSize="xs" color="gray.500">{(blur * 100).toFixed(0)}%</Text>
          </HStack>
          <Slider
            value={blur}
            onChange={handleBlurChange}
            min={0}
            max={1}
            step={0.01}
            isDisabled={disabled}
          >
            <SliderTrack bg="gray.600">
              <SliderFilledTrack bg="brand.500" />
            </SliderTrack>
            <SliderThumb boxSize={4} />
          </Slider>
        </Box>

        {/* Intensity */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="sm" color="gray.300">Intensity</Text>
            <Text fontSize="xs" color="gray.500">{(intensity * 100).toFixed(0)}%</Text>
          </HStack>
          <Slider
            value={intensity}
            onChange={handleIntensityChange}
            min={0}
            max={2}
            step={0.01}
            isDisabled={disabled}
          >
            <SliderTrack bg="gray.600">
              <SliderFilledTrack bg="brand.500" />
            </SliderTrack>
            <SliderThumb boxSize={4} />
          </Slider>
        </Box>
      </VStack>
    </DockableAccordionItem>
  );
}
