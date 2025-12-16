import React, { useState, useEffect } from 'react';
import {
  Box,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tooltip,
  Text,
  Image,
  VStack,
  HStack
} from '@chakra-ui/react';
import { EngineThree, MIXED_AUS } from '../../engine/EngineThree';

interface AUSliderProps {
  au: string | number;
  name: string;
  intensity: number;
  onChange: (newIntensity: number) => void;
  muscularBasis?: string;
  links?: string[];
  engine?: EngineThree; // Optional: for morph/bone blend control
  disabled?: boolean;
  side?: 'L' | 'R' | 'both'; // Controls which side: Left, Right, or Both (bilateral)
}

/**
 * AUSlider - Controls Action Unit intensity from 0-1
 * Calls engine.setAU() directly via onChange callback
 * For mixed AUs (morph + bone), displays an additional blend slider
 */
const AUSlider: React.FC<AUSliderProps> = ({
  au,
  name,
  intensity,
  onChange,
  muscularBasis,
  links,
  engine,
  disabled = false,
  side = 'both'
}) => {
  const [showImageTooltip, setShowImageTooltip] = useState(false);
  const [showValueTooltip, setShowValueTooltip] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mixValue, setMixValue] = useState<number>(1); // Default to 1 (full intensity)

  // Check if this AU is a mixed AU (controls both morphs and bones)
  const auId = typeof au === 'number' ? au : parseInt(String(au).replace(/[^\d]/g, ''));
  const isMixedAU = MIXED_AUS.has(auId);

  // Color interpolation: teal (0) -> magenta (1)
  const getSliderColor = (value: number): string => {
    const teal = { r: 0, g: 128, b: 128 };
    const magenta = { r: 255, g: 0, b: 255 };
    const r = Math.round(teal.r + (magenta.r - teal.r) * value);
    const g = Math.round(teal.g + (magenta.g - teal.g) * value);
    const b = Math.round(teal.b + (magenta.b - teal.b) * value);
    return `rgb(${r}, ${g}, ${b})`;
  };

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
    onChange(value);

    // Apply to engine with side suffix if needed
    if (engine) {
      if (side === 'L') {
        engine.setAU(`${auId}L` as any, value);
      } else if (side === 'R') {
        engine.setAU(`${auId}R` as any, value);
      } else {
        engine.setAU(auId, value);
      }
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

  // Display name with side indicator
  const displayName = side === 'both' ? name : `${name} (${side})`;
  const displayLabel = side === 'both' ? `${au} - ${name}` : `${au}${side} - ${displayName}`;

  return (
    <VStack width="100%" align="stretch" spacing={2}>
      <Box>
        <Text mb="2" display="inline" fontSize="sm" color="gray.50">
          {displayLabel}
          {muscularBasis && (
            <Tooltip
              label={
                <VStack align="start">
                  {muscularBasis.split(', ').map((muscle, i) => (
                    imageUrls[i]
                      ? <Image key={i} src={imageUrls[i]} alt={muscle} boxSize="100px" />
                      : <Text key={i}>{muscle}</Text>
                  ))}
                </VStack>
              }
              isOpen={showImageTooltip}
              hasArrow
            >
              <Text
                as="span"
                fontSize="xs"
                ml={2}
                color="brand.300"
                onMouseEnter={() => setShowImageTooltip(true)}
                onMouseLeave={() => setShowImageTooltip(false)}
                style={{ textDecoration: "underline", cursor: "pointer" }}
              >
                {muscularBasis}
              </Text>
            </Tooltip>
          )}
        </Text>

        <Slider
          id={String(au)}
          value={intensity}
          min={0}
          max={1}
          step={0.01}
          isDisabled={disabled}
          onChange={handleIntensityChange}
          onMouseEnter={() => setShowValueTooltip(true)}
          onMouseLeave={() => setShowValueTooltip(false)}
        >
          <SliderTrack>
            <SliderFilledTrack bg={getSliderColor(intensity)} />
          </SliderTrack>
          <Tooltip
            hasArrow
            label={`${(intensity * 100).toFixed(0)}%`}
            bg="gray.300"
            color="black"
            placement="top"
            isOpen={showValueTooltip}
          >
            <SliderThumb boxSize={6} />
          </Tooltip>
        </Slider>
      </Box>

      {/* Morph ↔ Bone blend slider (only for mixed AUs with bone bindings) */}
      {isMixedAU && engine && (
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

export default AUSlider;
