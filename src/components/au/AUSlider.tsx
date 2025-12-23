import React, { useState, useEffect, memo, useRef } from 'react';
import {
  Box,
  Slider,
  Tooltip,
  Text,
  Image,
  VStack,
  HStack
} from '@chakra-ui/react';
import { EngineThree } from '../../engine/EngineThree';
import { MIXED_AUS, hasLeftRightMorphs } from '../../engine/arkit/shapeDict';

interface AUSliderProps {
  au: string | number;
  name: string;
  initialIntensity?: number; // Optional initial value (uncontrolled)
  initialBalance?: number; // Optional initial balance (-1 to +1)
  muscularBasis?: string;
  links?: string[];
  engine?: EngineThree | null; // Optional: for morph/bone blend control
  disabled?: boolean;
  onValueChange?: (id: string, value: number) => void; // Optional callback for parent tracking
}

// Color interpolation helper - defined outside component to avoid recreation
const getSliderColor = (value: number): string => {
  const teal = { r: 0, g: 128, b: 128 };
  const magenta = { r: 255, g: 0, b: 255 };
  const r = Math.round(teal.r + (magenta.r - teal.r) * value);
  const g = Math.round(teal.g + (magenta.g - teal.g) * value);
  const b = Math.round(teal.b + (magenta.b - teal.b) * value);
  return `rgb(${r}, ${g}, ${b})`;
};

// Balance slider color - blue for left, orange for right
const getBalanceColor = (balance: number): string => {
  if (balance < 0) {
    const intensity = Math.abs(balance);
    return `rgba(66, 153, 225, ${0.3 + intensity * 0.7})`; // blue
  } else if (balance > 0) {
    return `rgba(237, 137, 54, ${0.3 + balance * 0.7})`; // orange
  }
  return 'rgba(128, 128, 128, 0.5)'; // neutral gray
};

/**
 * AUSlider - Controls Action Unit intensity from 0-1
 * UNCONTROLLED component - manages its own state and syncs directly to engine
 * For bilateral AUs (with L/R morphs), displays a balance slider (-1 to +1)
 * For mixed AUs (morph + bone), displays an additional blend slider
 */
const AUSlider: React.FC<AUSliderProps> = ({
  au,
  name,
  initialIntensity = 0,
  initialBalance = 0,
  muscularBasis,
  links,
  engine,
  disabled = false,
  onValueChange
}) => {
  // Internal state - component is uncontrolled
  const [intensity, setIntensity] = useState(initialIntensity);
  const [balance, setBalance] = useState(initialBalance);
  const [showImageTooltip, setShowImageTooltip] = useState(false);
  const [showValueTooltip, setShowValueTooltip] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mixValue, setMixValue] = useState<number>(1); // Default to 1 (full intensity)

  // Stable ref for callback to avoid recreating handlers
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  // Check AU properties
  const auId = typeof au === 'number' ? au : parseInt(String(au).replace(/[^\d]/g, ''));
  const auIdStr = String(au);
  const isMixedAU = MIXED_AUS.has(auId);
  const isBilateralAU = hasLeftRightMorphs(auId);

  // Fetch Wikipedia images for muscle info
  useEffect(() => {
    const fetchMainImageFromWikipedia = async (pageUrl: string): Promise<string | null> => {
      const pageName = pageUrl.split('/wiki/')[1];
      if (!pageName) return null;

      const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${pageName}&prop=pageimages&format=json&origin=*&pithumbsize=100`;

      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        const pages = data.query.pages;
        const firstPage = pages[Object.keys(pages)[0]];
        return firstPage.thumbnail ? firstPage.thumbnail.source : null;
      } catch (err) {
        console.error("Failed to fetch Wikipedia image:", err);
        return null;
      }
    };

    const loadImages = async () => {
      if (!links || !Array.isArray(links)) return;
      const results = await Promise.all(links.map(link => fetchMainImageFromWikipedia(link)));
      setImageUrls(results.filter(Boolean) as string[]);
    };
    loadImages();
  }, [links]);

  const handleIntensityChange = (value: number) => {
    setIntensity(value);

    // Notify parent if callback provided (for tracking visible sliders)
    onValueChangeRef.current?.(auIdStr, value);

    // Apply to engine with current balance
    if (engine) {
      engine.setAU(auId, value, balance);
    }
  };

  const handleBalanceChange = (value: number) => {
    setBalance(value);

    // Re-apply AU with same intensity but new balance
    if (engine) {
      engine.setAU(auId, intensity, value);
    }
  };

  // Get current mix value from engine, or use local state
  const getMix = () => {
    if (engine && isMixedAU) {
      return engine.getAUMixWeight(auId) ?? mixValue;
    }
    return mixValue;
  };

  // Update mix weight in engine and local state
  const handleMixChange = (v: number) => {
    setMixValue(v);
    if (engine && isMixedAU) {
      engine.setAUMixWeight(auId, v);
    }
  };

  // Get current balance (local state only)
  const getBalance = () => balance;

  const displayLabel = `${au} - ${name}`;

  return (
    <VStack width="100%" align="stretch" gap={2}>
      <Box>
        <Box mb="2" display="inline" fontSize="sm" color="gray.50">
          {displayLabel}
          {muscularBasis && (
            <Tooltip.Root open={showImageTooltip}>
              <Tooltip.Trigger asChild>
                <Box
                  as="span"
                  fontSize="xs"
                  ml={2}
                  color="brand.300"
                  onMouseEnter={() => setShowImageTooltip(true)}
                  onMouseLeave={() => setShowImageTooltip(false)}
                  style={{ textDecoration: "underline", cursor: "pointer" }}
                >
                  {muscularBasis}
                </Box>
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  <VStack align="start">
                    {muscularBasis.split(', ').map((muscle, i) => (
                      imageUrls[i]
                        ? <Image key={i} src={imageUrls[i]} alt={muscle} boxSize="100px" />
                        : <Box as="span" key={i}>{muscle}</Box>
                    ))}
                  </VStack>
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          )}
        </Box>

        <Slider.Root
          value={[intensity]}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          onValueChange={(details) => handleIntensityChange(details.value[0])}
          onMouseEnter={() => setShowValueTooltip(true)}
          onMouseLeave={() => setShowValueTooltip(false)}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range style={{ background: getSliderColor(intensity) }} />
            </Slider.Track>
            <Tooltip.Root open={showValueTooltip}>
              <Tooltip.Trigger asChild>
                <Slider.Thumb index={0} boxSize={6} />
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content bg="gray.300" color="black">
                  {`${(intensity * 100).toFixed(0)}%`}
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          </Slider.Control>
        </Slider.Root>
      </Box>

      {/* Balance slider (L ↔ R) for bilateral AUs */}
      {isBilateralAU && engine && (
        <Box pt={2} borderTop="1px solid" borderColor="gray.600">
          <HStack mb={1} justify="space-between">
            <Text fontSize="xs" color="blue.300">L</Text>
            <Text fontSize="xs" color="gray.300">
              Balance {getBalance().toFixed(2)}
            </Text>
            <Text fontSize="xs" color="orange.300">R</Text>
          </HStack>
          <Slider.Root
            min={-1}
            max={1}
            step={0.01}
            value={[getBalance()]}
            disabled={disabled}
            onValueChange={(details) => handleBalanceChange(details.value[0])}
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range style={{ background: getBalanceColor(getBalance()) }} />
              </Slider.Track>
              <Slider.Thumb index={0} boxSize={4} />
            </Slider.Control>
          </Slider.Root>
        </Box>
      )}

      {/* Morph ↔ Bone blend slider (only for mixed AUs with bone bindings) */}
      {isMixedAU && engine && (
        <Box pt={2} borderTop="1px solid" borderColor="gray.600">
          <HStack mb={1} justify="space-between">
            <Text fontSize="xs" color="gray.300">Blend (Morph ↔ Bone)</Text>
            <Text fontSize="xs" color="gray.400">
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
            onValueChange={(details) => handleMixChange(details.value[0])}
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
export default memo(AUSlider);
