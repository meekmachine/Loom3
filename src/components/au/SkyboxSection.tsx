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
  Select,
  Divider,
} from '@chakra-ui/react';
import * as THREE from 'three';
import { EngineThree } from '../../engine/EngineThree';
import DockableAccordionItem from './DockableAccordionItem';

interface SkyboxSectionProps {
  engine: EngineThree | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

// Tone mapping options with readable labels
const TONE_MAPPING_OPTIONS: { value: THREE.ToneMapping; label: string }[] = [
  { value: THREE.NoToneMapping, label: 'None' },
  { value: THREE.LinearToneMapping, label: 'Linear' },
  { value: THREE.ReinhardToneMapping, label: 'Reinhard' },
  { value: THREE.CineonToneMapping, label: 'Cineon' },
  { value: THREE.ACESFilmicToneMapping, label: 'ACES Filmic' },
  { value: THREE.AgXToneMapping, label: 'AgX' },
];

export default function SkyboxSection({ engine, disabled = false, defaultExpanded = false }: SkyboxSectionProps) {
  // Skybox controls
  const [blur, setBlur] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Post-processing controls
  const [toneMapping, setToneMapping] = useState<THREE.ToneMapping>(THREE.NoToneMapping);
  const [exposure, setExposure] = useState(1);
  const [envIntensity, setEnvIntensity] = useState(1);
  const [isRendererReady, setIsRendererReady] = useState(false);

  // Check if skybox is ready - poll periodically since texture loads async
  useEffect(() => {
    if (!engine) return;

    const checkReady = () => {
      const skyboxReady = engine.isSkyboxReady();
      const rendererReady = engine.isRendererReady();
      setIsReady(skyboxReady);
      setIsRendererReady(rendererReady);

      // Initialize post-processing values from engine when renderer is ready
      if (rendererReady) {
        setToneMapping(engine.getToneMapping());
        setExposure(engine.getExposure());
        setEnvIntensity(engine.getEnvironmentIntensity());
      }

      return skyboxReady;
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

  // Skybox handlers
  const handleBlurChange = (value: number) => {
    setBlur(value);
    engine?.setSkyboxBlur(value);
  };

  const handleIntensityChange = (value: number) => {
    setIntensity(value);
    engine?.setSkyboxIntensity(value);
  };

  // Post-processing handlers
  const handleToneMappingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value) as THREE.ToneMapping;
    setToneMapping(value);
    engine?.setToneMapping(value);
  };

  const handleExposureChange = (value: number) => {
    setExposure(value);
    engine?.setExposure(value);
  };

  const handleEnvIntensityChange = (value: number) => {
    setEnvIntensity(value);
    engine?.setEnvironmentIntensity(value);
  };

  const resetToDefaults = () => {
    // Reset skybox
    setBlur(0);
    setIntensity(1);
    engine?.setSkyboxBlur(0);
    engine?.setSkyboxIntensity(1);

    // Reset post-processing
    setToneMapping(THREE.NoToneMapping);
    setExposure(1);
    setEnvIntensity(1);
    engine?.setToneMapping(THREE.NoToneMapping);
    engine?.setExposure(1);
    engine?.setEnvironmentIntensity(1);
  };

  if (!isReady && !isRendererReady) {
    return (
      <DockableAccordionItem title="Skybox & Post FX" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">No skybox loaded</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Skybox & Post FX" isDefaultExpanded={defaultExpanded}>
      <VStack spacing={4} align="stretch" p={2}>
        <Button size="sm" onClick={resetToDefaults} colorScheme="red" variant="outline">
          Reset to Defaults
        </Button>

        {/* Skybox Controls */}
        {isReady && (
          <>
            <Text fontSize="xs" fontWeight="bold" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Skybox
            </Text>

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

          </>
        )}

        {/* Post-Processing Controls */}
        {isRendererReady && (
          <>
            <Divider borderColor="gray.600" />
            <Text fontSize="xs" fontWeight="bold" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Post Processing
            </Text>

            {/* Tone Mapping */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Tone Mapping</Text>
              </HStack>
              <Select
                value={toneMapping}
                onChange={handleToneMappingChange}
                size="sm"
                bg="gray.700"
                borderColor="gray.600"
                isDisabled={disabled}
              >
                {TONE_MAPPING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Box>

            {/* Exposure */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Exposure</Text>
                <Text fontSize="xs" color="gray.500">{exposure.toFixed(2)}</Text>
              </HStack>
              <Slider
                value={exposure}
                onChange={handleExposureChange}
                min={0.1}
                max={3}
                step={0.01}
                isDisabled={disabled}
              >
                <SliderTrack bg="gray.600">
                  <SliderFilledTrack bg="brand.500" />
                </SliderTrack>
                <SliderThumb boxSize={4} />
              </Slider>
            </Box>

            {/* Environment Intensity */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Environment Intensity</Text>
                <Text fontSize="xs" color="gray.500">{(envIntensity * 100).toFixed(0)}%</Text>
              </HStack>
              <Slider
                value={envIntensity}
                onChange={handleEnvIntensityChange}
                min={0}
                max={3}
                step={0.01}
                isDisabled={disabled}
              >
                <SliderTrack bg="gray.600">
                  <SliderFilledTrack bg="brand.500" />
                </SliderTrack>
                <SliderThumb boxSize={4} />
              </Slider>
            </Box>
          </>
        )}
      </VStack>
    </DockableAccordionItem>
  );
}
