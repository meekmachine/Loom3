import React, { useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Switch,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Box,
  Button,
} from '@chakra-ui/react';
import { EngineWind } from '../../engine/EngineWind';
import DockableAccordionItem from './DockableAccordionItem';

interface WindSectionProps {
  windEngine: EngineWind | null;
  disabled?: boolean;
}

export default function WindSection({ windEngine, disabled = false }: WindSectionProps) {
  // Local state for wind parameters
  const [enabled, setEnabled] = useState(windEngine?.getEnabled() ?? true);
  const [strength, setStrength] = useState(windEngine?.getStrength() ?? 0.3);
  const [frequency, setFrequency] = useState(windEngine?.getFrequency() ?? 0.5);
  const [turbulence, setTurbulence] = useState(windEngine?.getTurbulence() ?? 0.4);
  const [damping, setDamping] = useState(windEngine?.getDamping() ?? 0.85);
  const [springStiffness, setSpringStiffness] = useState(windEngine?.getSpringStiffness() ?? 8.0);

  // Wind direction presets
  const directionPresets = [
    { name: 'Right', value: [1, 0, 0] },
    { name: 'Left', value: [-1, 0, 0] },
    { name: 'Forward', value: [0, 0, 1] },
    { name: 'Back', value: [0, 0, -1] },
    { name: 'Up-Right', value: [1, 0.3, 0.3] },
  ];

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    windEngine?.setEnabled(checked);
  };

  const handleStrengthChange = (value: number) => {
    setStrength(value);
    windEngine?.setStrength(value);
  };

  const handleFrequencyChange = (value: number) => {
    setFrequency(value);
    windEngine?.setFrequency(value);
  };

  const handleTurbulenceChange = (value: number) => {
    setTurbulence(value);
    windEngine?.setTurbulence(value);
  };

  const handleDampingChange = (value: number) => {
    setDamping(value);
    windEngine?.setDamping(value);
  };

  const handleSpringStiffnessChange = (value: number) => {
    setSpringStiffness(value);
    windEngine?.setSpringStiffness(value);
  };

  const handleDirectionPreset = (x: number, y: number, z: number) => {
    windEngine?.setDirection(x, y, z);
  };

  const handleReset = () => {
    windEngine?.reset();
  };

  if (!windEngine || windEngine.getHairBoneCount() === 0) {
    return (
      <DockableAccordionItem title="Wind Physics">
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">
            No hair bones detected in model
          </Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Wind Physics">
      <VStack spacing={4} align="stretch" p={2}>
        {/* Info */}
        <Text fontSize="xs" color="gray.300">
          {windEngine.getHairBoneCount()} hair bones detected
        </Text>

        {/* Enable/Disable */}
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium" color="gray.50">Enable Wind</Text>
          <Switch
            isChecked={enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            isDisabled={disabled}
            size="sm"
            colorScheme="brand"
          />
        </HStack>

        {/* Wind Strength */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.50">Strength</Text>
            <Text fontSize="xs" color="gray.300">{strength.toFixed(2)}</Text>
          </HStack>
          <Slider
            value={strength}
            onChange={handleStrengthChange}
            min={0}
            max={1}
            step={0.01}
            isDisabled={disabled || !enabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {/* Wind Frequency */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.50">Frequency (Hz)</Text>
            <Text fontSize="xs" color="gray.300">{frequency.toFixed(2)}</Text>
          </HStack>
          <Slider
            value={frequency}
            onChange={handleFrequencyChange}
            min={0.1}
            max={2}
            step={0.05}
            isDisabled={disabled || !enabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {/* Turbulence */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.50">Turbulence</Text>
            <Text fontSize="xs" color="gray.300">{turbulence.toFixed(2)}</Text>
          </HStack>
          <Slider
            value={turbulence}
            onChange={handleTurbulenceChange}
            min={0}
            max={1}
            step={0.01}
            isDisabled={disabled || !enabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {/* Damping */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.50">Damping</Text>
            <Text fontSize="xs" color="gray.300">{damping.toFixed(2)}</Text>
          </HStack>
          <Slider
            value={damping}
            onChange={handleDampingChange}
            min={0}
            max={1}
            step={0.01}
            isDisabled={disabled || !enabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {/* Spring Stiffness */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.50">Spring Stiffness</Text>
            <Text fontSize="xs" color="gray.300">{springStiffness.toFixed(1)}</Text>
          </HStack>
          <Slider
            value={springStiffness}
            onChange={handleSpringStiffnessChange}
            min={1}
            max={20}
            step={0.5}
            isDisabled={disabled || !enabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {/* Direction Presets */}
        <VStack align="stretch" spacing={2}>
          <Text fontSize="sm" fontWeight="medium" color="gray.50">Wind Direction</Text>
          <HStack wrap="wrap" spacing={2}>
            {directionPresets.map((preset) => (
              <Button
                key={preset.name}
                size="xs"
                onClick={() => handleDirectionPreset(...preset.value as [number, number, number])}
                isDisabled={disabled || !enabled}
              >
                {preset.name}
              </Button>
            ))}
          </HStack>
        </VStack>

        {/* Reset Button */}
        <Button
          size="sm"
          colorScheme="orange"
          onClick={handleReset}
          isDisabled={disabled || !enabled}
        >
          Reset Hair
        </Button>
      </VStack>
    </DockableAccordionItem>
  );
}
