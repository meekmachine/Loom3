import { useEffect, useState, memo, useRef } from 'react';
import {
  VStack,
  HStack,
  Text,
  Slider,
  Box,
  Switch,
  Button,
} from '@chakra-ui/react';
import { BlinkService } from '../../latticework/blink/blinkService';
import { BlinkState } from '../../latticework/blink/types';
import { useThreeState } from '../../context/threeContext';
import DockableAccordionItem from './DockableAccordionItem';

interface BlinkSectionProps {
  disabled?: boolean;
  defaultExpanded?: boolean;
}

function BlinkSection({ disabled = false, defaultExpanded = false }: BlinkSectionProps) {
  const { anim } = useThreeState();
  const blinkServiceRef = useRef<BlinkService | null>(null);
  const [state, setState] = useState<BlinkState | null>(null);

  // Create and manage BlinkService lifecycle
  useEffect(() => {
    if (!anim) return;

    // Create service if not exists
    if (!blinkServiceRef.current) {
      blinkServiceRef.current = new BlinkService({
        scheduleSnippet: (snippet: any) => anim.schedule?.(snippet) || null,
        removeSnippet: (name: string) => anim.remove?.(name),
      });
    }

    const service = blinkServiceRef.current;

    // Get initial state
    setState(service.getState());

    // Subscribe to updates
    const unsubscribe = service.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
      // Dispose service on unmount
      service.dispose();
      blinkServiceRef.current = null;
    };
  }, [anim]);

  const blinkService = blinkServiceRef.current;

  if (!blinkService || !state) {
    return (
      <DockableAccordionItem title="Blinking" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="white">
            Waiting for animation service...
          </Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  // Control handlers
  const handleToggle = (details: { checked: boolean }) => {
    if (details.checked) {
      blinkService.enable();
    } else {
      blinkService.disable();
    }
  };

  const handleFrequencyChange = (details: { value: number[] }) => {
    blinkService.setFrequency(details.value[0]);
  };

  const handleDurationChange = (details: { value: number[] }) => {
    blinkService.setDuration(details.value[0]);
  };

  const handleIntensityChange = (details: { value: number[] }) => {
    blinkService.setIntensity(details.value[0]);
  };

  const handleRandomnessChange = (details: { value: number[] }) => {
    blinkService.setRandomness(details.value[0]);
  };

  const handleManualBlink = () => {
    blinkService.triggerBlink();
  };

  const handleReset = () => {
    blinkService.reset();
  };

  return (
    <DockableAccordionItem title="Blinking" isDefaultExpanded={defaultExpanded}>
      <VStack gap={4} align="stretch" p={2}>
        {/* Enable/Disable Toggle */}
        <HStack justify="space-between">
          <Text fontSize="sm" color="gray.50" fontWeight="semibold">
            Automatic Blinking
          </Text>
          <Switch.Root
            checked={state.enabled}
            onCheckedChange={handleToggle}
            disabled={disabled}
            size="md"
            colorPalette="brand"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </HStack>

        {/* Manual Blink Button */}
        <Button
          size="sm"
          colorPalette="blue"
          onClick={handleManualBlink}
          disabled={disabled}
        >
          Trigger Blink Now
        </Button>

        {/* Frequency Slider */}
        <VStack align="stretch" gap={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Frequency (blinks/min)</Text>
            <Text fontSize="xs" color="white">
              {state.frequency.toFixed(0)}
            </Text>
          </HStack>
          <Slider.Root
            value={[state.frequency]}
            onValueChange={handleFrequencyChange}
            min={0}
            max={60}
            step={1}
            disabled={disabled || !state.enabled}
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0} />
            </Slider.Control>
          </Slider.Root>
          <Text fontSize="xs" color="white" fontStyle="italic">
            Typical: 15-20 blinks/min
          </Text>
        </VStack>

        {/* Duration Slider */}
        <VStack align="stretch" gap={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Duration (seconds)</Text>
            <Text fontSize="xs" color="white">
              {state.duration.toFixed(2)}s
            </Text>
          </HStack>
          <Slider.Root
            value={[state.duration]}
            onValueChange={handleDurationChange}
            min={0.05}
            max={1.0}
            step={0.01}
            disabled={disabled}
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0} />
            </Slider.Control>
          </Slider.Root>
          <Text fontSize="xs" color="white" fontStyle="italic">
            Typical: 0.1-0.3 seconds
          </Text>
        </VStack>

        {/* Intensity Slider */}
        <VStack align="stretch" gap={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Intensity</Text>
            <Text fontSize="xs" color="white">
              {(state.intensity * 100).toFixed(0)}%
            </Text>
          </HStack>
          <Slider.Root
            value={[state.intensity]}
            onValueChange={handleIntensityChange}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0} />
            </Slider.Control>
          </Slider.Root>
        </VStack>

        {/* Randomness Slider */}
        <VStack align="stretch" gap={1}>
          <HStack justify="space-between">
            <Text fontSize="xs" color="gray.50">Randomness</Text>
            <Text fontSize="xs" color="white">
              {(state.randomness * 100).toFixed(0)}%
            </Text>
          </HStack>
          <Slider.Root
            value={[state.randomness]}
            onValueChange={handleRandomnessChange}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0} />
            </Slider.Control>
          </Slider.Root>
          <Text fontSize="xs" color="white" fontStyle="italic">
            Adds natural variation to timing and intensity
          </Text>
        </VStack>

        {/* Reset Button */}
        <Button
          size="sm"
          colorPalette="orange"
          onClick={handleReset}
          disabled={disabled}
          mt={2}
        >
          Reset to Default
        </Button>
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(BlinkSection);
