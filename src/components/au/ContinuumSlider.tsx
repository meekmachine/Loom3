import React, { useState } from 'react';
import {
  Box,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tooltip,
  Text,
  HStack,
  VStack
} from '@chakra-ui/react';
import { AUInfo, AU_MIX_DEFAULTS } from '../../engine/arkit/shapeDict';
import { EngineThree } from '../../engine/EngineThree';

interface ContinuumSliderProps {
  negativeAU: AUInfo;
  positiveAU: AUInfo;
  value: number; // -1 to 1
  onChange: (value: number) => void;
  engine?: EngineThree; // Optional: for morph/bone blend control
  showBlendSlider?: boolean; // Whether to show the morph/bone blend slider
  disabled?: boolean;
}

/**
 * ContinuumSlider - Bidirectional slider for paired AUs (e.g., Head Left <-> Right)
 * Range: -1 (negative AU) to +1 (positive AU)
 * Calls engine.setContinuum() directly for unified morph + bone handling.
 */
const ContinuumSlider: React.FC<ContinuumSliderProps> = ({
  negativeAU,
  positiveAU,
  value,
  onChange,
  engine,
  showBlendSlider = false,
  disabled = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const negId = parseInt(negativeAU.id);
  const posId = parseInt(positiveAU.id);

  // Handle slider change - calls engine.setContinuum directly (like AUSlider calls setAU)
  const handleSliderChange = (val: number) => {
    onChange(val);
    engine?.setContinuum(negId, posId, val);
  };

  // Color: blue for negative, neutral in center, orange for positive
  const getSliderColor = (val: number): string => {
    if (val < 0) {
      const intensity = Math.abs(val);
      return `rgba(66, 153, 225, ${intensity})`; // blue
    } else {
      return `rgba(237, 137, 54, ${val})`; // orange
    }
  };

  // Determine which AU is the "base" for mix weight:
  let baseAUId: number;
  if ((negId === 61 && posId === 62) || (negId === 31 && posId === 32) || (negId === 55 && posId === 56)) {
    // Horizontal/yaw or tilt: use negative (left) AU
    baseAUId = negId;
  } else {
    // Vertical/pitch: use positive (up) AU
    baseAUId = posId;
  }

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
  const handleMixChange = (v: number) => {
    setMixValue(v);
    if (engine) {
      engine.setAUMixWeight(negId, v);
      engine.setAUMixWeight(posId, v);
    }
  };

  return (
    <VStack width="100%" align="stretch" spacing={2}>
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.300">
            {negativeAU.name}
          </Text>
          <Text fontSize="xs" fontWeight="semibold" color="gray.50">
            {value.toFixed(2)}
          </Text>
          <Text fontSize="xs" color="gray.300">
            {positiveAU.name}
          </Text>
        </HStack>

        <Slider
          value={value}
          min={-1}
          max={1}
          step={0.01}
          isDisabled={disabled}
          onChange={handleSliderChange}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
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
            isOpen={showTooltip}
          >
            <SliderThumb boxSize={6} />
          </Tooltip>
        </Slider>
      </Box>

      {/* Morph ↔ Bone blend slider */}
      {showBlendSlider && engine && (
        <Box pt={2} borderTop="1px solid" borderColor="gray.600">
          <HStack mb={1} justify="space-between">
            <Text fontSize="xs" color="gray.300">Blend (Morph ↔ Bone)</Text>
            <Text fontSize="xs" color="gray.400">
              {getMix().toFixed(2)}
            </Text>
          </HStack>
          <Slider
            aria-label="morph-bone-blend"
            min={0}
            max={1}
            step={0.01}
            value={getMix()}
            isDisabled={disabled}
            onChange={handleMixChange}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb boxSize={4} />
          </Slider>
        </Box>
      )}
    </VStack>
  );
};

export default ContinuumSlider;
