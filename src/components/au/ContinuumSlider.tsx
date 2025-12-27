import React, { useState, memo, useRef } from 'react';
import {
  Box,
  Slider,
  Tooltip,
  Text,
  HStack,
  VStack
} from '@chakra-ui/react';
import { AUInfo, AU_MIX_DEFAULTS, CONTINUUM_PAIRS_MAP, CONTINUUM_LABELS } from '../../engine/arkit/shapeDict';
import { EngineThree } from '../../engine/EngineThree';

interface ContinuumSliderProps {
  negativeAU: AUInfo;
  positiveAU: AUInfo;
  initialValue?: number; // -1 to 1
  engine?: EngineThree | null; // Optional: for morph/bone blend control
  showBlendSlider?: boolean; // Whether to show the morph/bone blend slider
  disabled?: boolean;
  onValueChange?: (negId: string, posId: string, value: number) => void; // Optional callback for parent tracking
}

// Color helper - defined outside component
const getSliderColor = (val: number): string => {
  if (val < 0) {
    const intensity = Math.abs(val);
    return `rgba(66, 153, 225, ${intensity})`; // blue
  } else {
    return `rgba(237, 137, 54, ${val})`; // orange
  }
};

/**
 * ContinuumSlider - Bidirectional slider for paired AUs (e.g., Head Left <-> Right)
 * UNCONTROLLED component - manages its own state and syncs directly to engine
 * Range: -1 (negative AU) to +1 (positive AU)
 * Calls engine.setContinuum() directly for unified morph + bone handling.
 */
const ContinuumSlider: React.FC<ContinuumSliderProps> = ({
  negativeAU,
  positiveAU,
  initialValue = 0,
  engine,
  showBlendSlider = false,
  disabled = false,
  onValueChange
}) => {
  // Internal state - component is uncontrolled
  const [value, setValue] = useState(initialValue);
  const [showTooltip, setShowTooltip] = useState(false);

  // Stable ref for callback
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const negId = parseInt(negativeAU.id);
  const posId = parseInt(positiveAU.id);

  // Get header label for this continuum pair
  const continuumKey = `${negId}-${posId}`;
  const headerLabel = CONTINUUM_LABELS[continuumKey] ?? `AU ${negId} ↔ AU ${posId}`;

  // Handle slider change - calls setAU for ONE AU only
  // (Calling both would overwrite the bone since they share the same axis)
  const handleSliderChange = (details: { value: number[] }) => {
    const val = details.value[0];
    setValue(val);

    // Notify parent if callback provided
    onValueChangeRef.current?.(negativeAU.id, positiveAU.id, val);

    if (!engine) return;

    if (val < 0) {
      // Negative direction: activate negAU only
      engine.setAU(negId, Math.abs(val));
    } else if (val > 0) {
      // Positive direction: activate posAU only
      engine.setAU(posId, val);
    } else {
      // Zero: set one AU to 0 (either works, they share the bone)
      engine.setAU(posId, 0);
    }
  };

  // Determine which AU is the "base" for mix weight using CONTINUUM_PAIRS_MAP
  // Yaw/roll axes use negative (left) AU, pitch uses positive (up) AU
  const pairInfo = CONTINUUM_PAIRS_MAP[negId];
  const axisType = pairInfo?.axis;
  const baseAUId = (axisType === 'yaw' || axisType === 'roll') ? negId : posId;

  // Initialize mix value from AU_MIX_DEFAULTS
  const [mixValue, setMixValue] = useState<number>(AU_MIX_DEFAULTS[baseAUId] ?? 1.0);

  // Get current mix value from engine, or use local state
  const getMix = () => {
    if (engine && typeof baseAUId === 'number') {
      return engine.getAUMixWeight(baseAUId) ?? mixValue;
    }
    return mixValue;
  };

  // Update mix weight in engine and local state - set for BOTH AUs in the pair
  const handleMixChange = (details: { value: number[] }) => {
    const v = details.value[0];
    setMixValue(v);
    if (engine) {
      engine.setAUMixWeight(negId, v);
      engine.setAUMixWeight(posId, v);
    }
  };

  return (
    <VStack width="100%" align="stretch" gap={2}>
      <Box>
        {/* Header with AU IDs and label */}
        <Text mb={1} fontSize="sm" color="gray.50">
          {negId}/{posId} - {headerLabel}
        </Text>

        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="white">
            {negativeAU.name}
          </Text>
          <Text fontSize="xs" fontWeight="semibold" color="gray.50">
            {value.toFixed(2)}
          </Text>
          <Text fontSize="xs" color="white">
            {positiveAU.name}
          </Text>
        </HStack>

        <Slider.Root
          value={[value]}
          min={-1}
          max={1}
          step={0.01}
          disabled={disabled}
          onValueChange={handleSliderChange}
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

      {/* Morph ↔ Bone blend slider */}
      {showBlendSlider && engine && (
        <Box pt={2} borderTop="1px solid" borderColor="gray.600">
          <HStack mb={1} justify="space-between">
            <Text fontSize="xs" color="white">Blend (Morph ↔ Bone)</Text>
            <Text fontSize="xs" color="white">
              {getMix().toFixed(2)}
            </Text>
          </HStack>
          <Slider.Root
            aria-label={["morph-bone-blend"]}
            min={0}
            max={1}
            step={0.01}
            value={[getMix()]}
            disabled={disabled}
            onValueChange={handleMixChange}
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0} boxSize={4} />
            </Slider.Control>
          </Slider.Root>
        </Box>
      )}
    </VStack>
  );
};

// Memoize to prevent rerenders when parent state changes
export default memo(ContinuumSlider);
