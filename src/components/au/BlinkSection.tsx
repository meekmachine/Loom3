import React, { useEffect, useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Box,
  Switch,
  Button,
} from '@chakra-ui/react';
import { BlinkService } from '../../latticework/blink/blinkService';
import { BlinkState } from '../../latticework/blink/types';
import DockableAccordionItem from './DockableAccordionItem';

interface BlinkSectionProps {
  blinkService: BlinkService | null;
  disabled?: boolean;
}

export default function BlinkSection({ blinkService, disabled = false }: BlinkSectionProps) {
  const [state, setState] = useState<BlinkState | null>(null);

  useEffect(() => {
    if (!blinkService) return;

    // Get initial state
    setState(blinkService.getState());

    // Subscribe to updates
    const unsubscribe = blinkService.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [blinkService]);

  if (!blinkService || !state) {
    return (
      <DockableAccordionItem title="Blinking">
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">
            No blink service available
          </Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  // Control handlers
  const handleToggle = (checked: boolean) => {
    if (checked) {
      blinkService.enable();
    } else {
      blinkService.disable();
    }
  };

  const handleFrequencyChange = (frequency: number) => {
    blinkService.setFrequency(frequency);
  };

  const handleDurationChange = (duration: number) => {
    blinkService.setDuration(duration);
  };

  const handleIntensityChange = (intensity: number) => {
    blinkService.setIntensity(intensity);
  };

  const handleRandomnessChange = (randomness: number) => {
    blinkService.setRandomness(randomness);
  };

  const handleManualBlink = () => {
    blinkService.triggerBlink();
  };

  const handleReset = () => {
    blinkService.reset();
  };

  return (
    <DockableAccordionItem title="Blinking">
      <VStack spacing={4} align="stretch" p={2}>
        {/* Enable/Disable Toggle */}
        <HStack justify="space-between">
          <Text fontSize="sm" color="gray.50" fontWeight="semibold">
            Automatic Blinking
          </Text>
          <Switch
            isChecked={state.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            isDisabled={disabled}
            size="md"
            colorScheme="brand"
          />
        </HStack>

        {/* Manual Blink Button */}
        <Button
          size="sm"
          colorScheme="blue"
          onClick={handleManualBlink}
          isDisabled={disabled}
        >
          Trigger Blink Now
        </Button>

        {/* Frequency Slider */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Frequency (blinks/min)</Text>
            <Text fontSize="xs" color="gray.300">
              {state.frequency.toFixed(0)}
            </Text>
          </HStack>
          <Slider
            value={state.frequency}
            onChange={handleFrequencyChange}
            min={0}
            max={60}
            step={1}
            isDisabled={disabled || !state.enabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <Text fontSize="xs" color="gray.500" fontStyle="italic">
            Typical: 15-20 blinks/min
          </Text>
        </VStack>

        {/* Duration Slider */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Duration (seconds)</Text>
            <Text fontSize="xs" color="gray.300">
              {state.duration.toFixed(2)}s
            </Text>
          </HStack>
          <Slider
            value={state.duration}
            onChange={handleDurationChange}
            min={0.05}
            max={1.0}
            step={0.01}
            isDisabled={disabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <Text fontSize="xs" color="gray.500" fontStyle="italic">
            Typical: 0.1-0.3 seconds
          </Text>
        </VStack>

        {/* Intensity Slider */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Intensity</Text>
            <Text fontSize="xs" color="gray.300">
              {(state.intensity * 100).toFixed(0)}%
            </Text>
          </HStack>
          <Slider
            value={state.intensity}
            onChange={handleIntensityChange}
            min={0}
            max={1}
            step={0.01}
            isDisabled={disabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        {/* Randomness Slider */}
        <VStack align="stretch" spacing={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Randomness</Text>
            <Text fontSize="xs" color="gray.300">
              {(state.randomness * 100).toFixed(0)}%
            </Text>
          </HStack>
          <Slider
            value={state.randomness}
            onChange={handleRandomnessChange}
            min={0}
            max={1}
            step={0.01}
            isDisabled={disabled}
            colorScheme="brand"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <Text fontSize="xs" color="gray.500" fontStyle="italic">
            Adds natural variation to timing and intensity
          </Text>
        </VStack>

        {/* Reset Button */}
        <Button
          size="sm"
          colorScheme="orange"
          onClick={handleReset}
          isDisabled={disabled}
          mt={2}
        >
          Reset to Default
        </Button>
      </VStack>
    </DockableAccordionItem>
  );
}
