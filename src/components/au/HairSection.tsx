import React, { useEffect, useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Box,
  Input,
  Switch,
  Button,
} from '@chakra-ui/react';
import { HairService } from '../../latticework/hair/hairService';
import { HairState, HAIR_COLOR_PRESETS } from '../../latticework/hair/types';
import DockableAccordionItem from './DockableAccordionItem';

interface HairSectionProps {
  hairService: HairService | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

// Physics config interface matching HairService (updated for Ammo.js)
interface PhysicsConfig {
  enabled: boolean;
  stiffness: number;      // Spring stiffness (1-20)
  damping: number;        // Air resistance (0-1)
  inertia: number;        // Head influence (0-5)
  gravity: number;        // Gravity strength (0-40)
  responseScale: number;  // Amplification of physics to morphs (1-5)
  idleSwayAmount: number;
  idleSwaySpeed: number;
  // Wind parameters
  windStrength: number;   // Wind force strength (0-20)
  windDirectionX: number; // Wind direction X (-1 to 1)
  windDirectionZ: number; // Wind direction Z (-1 to 1)
  windTurbulence: number; // Turbulence amount (0-1)
  windFrequency: number;  // Turbulence speed (0.5-5)
}

export default function HairSection({ hairService, disabled = false, defaultExpanded = false }: HairSectionProps) {
  const [state, setState] = useState<HairState | null>(null);
  const [availableMorphs, setAvailableMorphs] = useState<string[]>([]);
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig | null>(null);

  useEffect(() => {
    if (!hairService) return;

    // Get initial state
    setState(hairService.getState());

    // Get available hair morphs
    const morphs = hairService.getAvailableHairMorphs();
    setAvailableMorphs(morphs);

    // Get initial physics config
    setPhysicsConfig(hairService.getPhysicsConfig());

    // Subscribe to state updates
    const unsubscribeState = hairService.subscribe((newState) => {
      setState(newState);
    });

    // Subscribe to physics updates
    const unsubscribePhysics = hairService.subscribeToPhysics((config) => {
      setPhysicsConfig(config);
    });

    return () => {
      unsubscribeState();
      unsubscribePhysics();
    };
  }, [hairService]);

  if (!hairService || !state) {
    return (
      <DockableAccordionItem title="Hair & Eyebrows" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">
            No hair service available
          </Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  // Hair controls
  const handleHairPresetChange = (colorKey: string) => {
    const color = HAIR_COLOR_PRESETS[colorKey];
    if (color) {
      hairService.send({ type: 'SET_HAIR_COLOR', color });
    }
  };

  const handleHairBaseColorChange = (baseColor: string) => {
    hairService.send({ type: 'SET_HAIR_BASE_COLOR', baseColor });
  };

  const handleHairGlowColorChange = (emissive: string) => {
    hairService.send({
      type: 'SET_HAIR_GLOW',
      emissive,
      intensity: state.hairColor.emissiveIntensity,
    });
  };

  const handleHairGlowIntensityChange = (intensity: number) => {
    hairService.send({
      type: 'SET_HAIR_GLOW',
      emissive: state.hairColor.emissive,
      intensity,
    });
  };

  // Eyebrow controls
  const handleEyebrowPresetChange = (colorKey: string) => {
    const color = HAIR_COLOR_PRESETS[colorKey];
    if (color) {
      hairService.send({ type: 'SET_EYEBROW_COLOR', color });
    }
  };

  const handleEyebrowBaseColorChange = (baseColor: string) => {
    hairService.send({ type: 'SET_EYEBROW_BASE_COLOR', baseColor });
  };

  const handleEyebrowGlowColorChange = (emissive: string) => {
    hairService.send({
      type: 'SET_EYEBROW_GLOW',
      emissive,
      intensity: state.eyebrowColor.emissiveIntensity,
    });
  };

  const handleEyebrowGlowIntensityChange = (intensity: number) => {
    hairService.send({
      type: 'SET_EYEBROW_GLOW',
      emissive: state.eyebrowColor.emissive,
      intensity,
    });
  };

  // Outline controls
  const handleOutlineToggle = (checked: boolean) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: checked,
    });
  };

  const handleOutlineColorChange = (color: string) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: state.showOutline,
      color,
    });
  };

  const handleOutlineOpacityChange = (opacity: number) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: state.showOutline,
      opacity,
    });
  };

  const handlePartVisibilityToggle = (partName: string, visible: boolean) => {
    hairService.send({
      type: 'SET_PART_VISIBILITY',
      partName,
      visible,
    });
  };

  const handleReset = () => {
    hairService.send({ type: 'RESET_TO_DEFAULT' });
  };

  const handleAnimateHairMorph = (morphKey: string, value: number) => {
    hairService.animateHairMorph(morphKey, value, 300);
  };

  // Physics handlers
  const handlePhysicsToggle = (enabled: boolean) => {
    hairService.setPhysicsEnabled(enabled);
  };

  const handlePhysicsConfigChange = (key: keyof PhysicsConfig, value: number) => {
    hairService.updatePhysicsConfig({ [key]: value });
  };

  const colorPresetKeys = Object.keys(HAIR_COLOR_PRESETS);

  return (
    <DockableAccordionItem title="Hair & Eyebrows" isDefaultExpanded={defaultExpanded}>
      <VStack spacing={4} align="stretch" p={2}>
        {/* HAIR SECTION */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
            HAIR
          </Text>

          {/* Hair Preset */}
          <VStack align="stretch" spacing={2} mb={3}>
            <Text fontSize="xs" color="gray.50">Preset</Text>
            <Select
              size="sm"
              value=""
              onChange={(e) => handleHairPresetChange(e.target.value)}
              isDisabled={disabled}
            >
              <option value="">Select Preset...</option>
              {colorPresetKeys.map((key) => (
                <option key={key} value={key}>
                  {HAIR_COLOR_PRESETS[key].name}
                </option>
              ))}
            </Select>
          </VStack>

          {/* Hair Base Color */}
          <VStack align="stretch" spacing={1} mb={3}>
            <Text fontSize="xs" color="gray.50">Base Color</Text>
            <HStack spacing={2}>
              <Input
                type="color"
                value={state.hairColor.baseColor}
                onChange={(e) => handleHairBaseColorChange(e.target.value)}
                w="60px"
                h="32px"
                p={1}
                isDisabled={disabled}
              />
              <Input
                type="text"
                value={state.hairColor.baseColor.toUpperCase()}
                onChange={(e) => handleHairBaseColorChange(e.target.value)}
                placeholder="#000000"
                size="sm"
                fontFamily="mono"
                textTransform="uppercase"
                isDisabled={disabled}
              />
            </HStack>
          </VStack>

          {/* Hair Glow Color */}
          <VStack align="stretch" spacing={1} mb={3}>
            <Text fontSize="xs" color="gray.50">Glow Color</Text>
            <HStack spacing={2}>
              <Input
                type="color"
                value={state.hairColor.emissive}
                onChange={(e) => handleHairGlowColorChange(e.target.value)}
                w="60px"
                h="32px"
                p={1}
                isDisabled={disabled}
              />
              <Input
                type="text"
                value={state.hairColor.emissive.toUpperCase()}
                onChange={(e) => handleHairGlowColorChange(e.target.value)}
                placeholder="#000000"
                size="sm"
                fontFamily="mono"
                textTransform="uppercase"
                isDisabled={disabled}
              />
            </HStack>
          </VStack>

          {/* Hair Glow Intensity */}
          <VStack align="stretch" spacing={1} mb={3}>
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.50">Glow Intensity</Text>
              <Text fontSize="xs" color="gray.300">
                {state.hairColor.emissiveIntensity.toFixed(2)}
              </Text>
            </HStack>
            <Slider
              value={state.hairColor.emissiveIntensity}
              onChange={handleHairGlowIntensityChange}
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
        </Box>

        {/* EYEBROWS SECTION */}
        <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
          <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
            EYEBROWS
          </Text>

          {/* Eyebrow Preset */}
          <VStack align="stretch" spacing={2} mb={3}>
            <Text fontSize="xs" color="gray.50">Preset</Text>
            <Select
              size="sm"
              value=""
              onChange={(e) => handleEyebrowPresetChange(e.target.value)}
              isDisabled={disabled}
            >
              <option value="">Select Preset...</option>
              {colorPresetKeys.map((key) => (
                <option key={key} value={key}>
                  {HAIR_COLOR_PRESETS[key].name}
                </option>
              ))}
            </Select>
          </VStack>

          {/* Eyebrow Base Color */}
          <VStack align="stretch" spacing={1} mb={3}>
            <Text fontSize="xs" color="gray.50">Base Color</Text>
            <HStack spacing={2}>
              <Input
                type="color"
                value={state.eyebrowColor.baseColor}
                onChange={(e) => handleEyebrowBaseColorChange(e.target.value)}
                w="60px"
                h="32px"
                p={1}
                isDisabled={disabled}
              />
              <Input
                type="text"
                value={state.eyebrowColor.baseColor.toUpperCase()}
                onChange={(e) => handleEyebrowBaseColorChange(e.target.value)}
                placeholder="#000000"
                size="sm"
                fontFamily="mono"
                textTransform="uppercase"
                isDisabled={disabled}
              />
            </HStack>
          </VStack>

          {/* Eyebrow Glow Color */}
          <VStack align="stretch" spacing={1} mb={3}>
            <Text fontSize="xs" color="gray.50">Glow Color</Text>
            <HStack spacing={2}>
              <Input
                type="color"
                value={state.eyebrowColor.emissive}
                onChange={(e) => handleEyebrowGlowColorChange(e.target.value)}
                w="60px"
                h="32px"
                p={1}
                isDisabled={disabled}
              />
              <Input
                type="text"
                value={state.eyebrowColor.emissive.toUpperCase()}
                onChange={(e) => handleEyebrowGlowColorChange(e.target.value)}
                placeholder="#000000"
                size="sm"
                fontFamily="mono"
                textTransform="uppercase"
                isDisabled={disabled}
              />
            </HStack>
          </VStack>

          {/* Eyebrow Glow Intensity */}
          <VStack align="stretch" spacing={1} mb={3}>
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.50">Glow Intensity</Text>
              <Text fontSize="xs" color="gray.300">
                {state.eyebrowColor.emissiveIntensity.toFixed(2)}
              </Text>
            </HStack>
            <Slider
              value={state.eyebrowColor.emissiveIntensity}
              onChange={handleEyebrowGlowIntensityChange}
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
        </Box>

        {/* OUTLINE SECTION */}
        <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
          <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
            OUTLINE
          </Text>

          <HStack justify="space-between" mb={3}>
            <Text fontSize="xs" color="gray.50">Show Outline</Text>
            <Switch
              isChecked={state.showOutline}
              onChange={(e) => handleOutlineToggle(e.target.checked)}
              isDisabled={disabled}
              size="sm"
              colorScheme="brand"
            />
          </HStack>

          {state.showOutline && (
            <VStack align="stretch" spacing={3}>
              <HStack spacing={2}>
                <Text fontSize="xs" color="gray.50" w="60px">Color</Text>
                <Input
                  type="color"
                  value={state.outlineColor}
                  onChange={(e) => handleOutlineColorChange(e.target.value)}
                  w="60px"
                  h="32px"
                  p={1}
                  isDisabled={disabled}
                />
              </HStack>

              <VStack align="stretch" spacing={1}>
                <HStack justify="space-between">
                  <Text fontSize="xs" color="gray.50">Opacity</Text>
                  <Text fontSize="xs" color="gray.300">
                    {state.outlineOpacity.toFixed(1)}
                  </Text>
                </HStack>
                <Slider
                  value={state.outlineOpacity}
                  onChange={handleOutlineOpacityChange}
                  min={0}
                  max={1}
                  step={0.1}
                  isDisabled={disabled}
                  colorScheme="brand"
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
              </VStack>
            </VStack>
          )}
        </Box>

        {/* INDIVIDUAL PARTS */}
        {Object.keys(state.parts).length > 0 && (
          <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
            <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
              PARTS
            </Text>
            <VStack align="stretch" spacing={2}>
              {Object.keys(state.parts).map((partName) => {
                const part = state.parts[partName];
                return (
                  <HStack key={partName} justify="space-between">
                    <Text fontSize="xs" color="gray.50">{partName}</Text>
                    <Switch
                      isChecked={part.visible}
                      onChange={(e) => handlePartVisibilityToggle(partName, e.target.checked)}
                      isDisabled={disabled}
                      size="sm"
                      colorScheme="brand"
                    />
                  </HStack>
                );
              })}
            </VStack>
          </Box>
        )}

        {/* HAIR PHYSICS SECTION */}
        {physicsConfig && (
          <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
            <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
              HAIR PHYSICS
            </Text>
            <Text fontSize="xs" color="gray.400" mb={3}>
              Simulates hair movement based on head motion
            </Text>

            {/* Enable/Disable Toggle */}
            <HStack justify="space-between" mb={4}>
              <Text fontSize="xs" color="gray.50">Enable Physics</Text>
              <Switch
                isChecked={physicsConfig.enabled}
                onChange={(e) => handlePhysicsToggle(e.target.checked)}
                isDisabled={disabled}
                size="sm"
                colorScheme="cyan"
              />
            </HStack>

            {physicsConfig.enabled && (
              <VStack align="stretch" spacing={3}>
                {/* Head Influence - how much head movement affects hair */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Head Influence</Text>
                    <Text fontSize="xs" color="gray.300">
                      {physicsConfig.inertia.toFixed(1)}
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.inertia}
                    onChange={(v) => handlePhysicsConfigChange('inertia', v)}
                    min={0}
                    max={5}
                    step={0.2}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>

                {/* Stiffness - spring stiffness pulling hair back */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Stiffness</Text>
                    <Text fontSize="xs" color="gray.300">
                      {physicsConfig.stiffness.toFixed(1)}
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.stiffness}
                    onChange={(v) => handlePhysicsConfigChange('stiffness', v)}
                    min={1}
                    max={20}
                    step={0.5}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>

                {/* Damping - air resistance */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Air Resistance</Text>
                    <Text fontSize="xs" color="gray.300">
                      {physicsConfig.damping.toFixed(2)}
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.damping}
                    onChange={(v) => handlePhysicsConfigChange('damping', v)}
                    min={0}
                    max={1}
                    step={0.05}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>

                {/* Gravity */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Gravity</Text>
                    <Text fontSize="xs" color="gray.300">
                      {physicsConfig.gravity?.toFixed(1) ?? '9.8'}
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.gravity ?? 9.8}
                    onChange={(v) => handlePhysicsConfigChange('gravity', v)}
                    min={0}
                    max={40}
                    step={0.5}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>

                {/* Response Scale - amplification of physics effect */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Response Scale</Text>
                    <Text fontSize="xs" color="gray.300">
                      {(physicsConfig.responseScale ?? 2).toFixed(1)}x
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.responseScale ?? 2}
                    onChange={(v) => handlePhysicsConfigChange('responseScale', v)}
                    min={1}
                    max={5}
                    step={0.25}
                    isDisabled={disabled}
                    colorScheme="yellow"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                  <Text fontSize="xs" color="gray.500">
                    Higher = more dramatic hair movement
                  </Text>
                </VStack>

                {/* Idle Sway Amount */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Idle Sway</Text>
                    <Text fontSize="xs" color="gray.300">
                      {physicsConfig.idleSwayAmount.toFixed(2)}
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.idleSwayAmount}
                    onChange={(v) => handlePhysicsConfigChange('idleSwayAmount', v)}
                    min={0}
                    max={0.5}
                    step={0.02}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>

                {/* Idle Sway Speed */}
                <VStack align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">Sway Speed</Text>
                    <Text fontSize="xs" color="gray.300">
                      {physicsConfig.idleSwaySpeed.toFixed(1)}
                    </Text>
                  </HStack>
                  <Slider
                    value={physicsConfig.idleSwaySpeed}
                    onChange={(v) => handlePhysicsConfigChange('idleSwaySpeed', v)}
                    min={0.2}
                    max={2}
                    step={0.1}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>

                {/* Wind Simulation Section */}
                <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={3} mt={2}>
                  <Text fontSize="xs" fontWeight="bold" color="teal.300" mb={2}>
                    WIND SIMULATION
                  </Text>

                  {/* Wind Strength */}
                  <VStack align="stretch" spacing={1} mb={3}>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.50">Wind Strength</Text>
                      <Text fontSize="xs" color="gray.300">
                        {(physicsConfig.windStrength ?? 0).toFixed(1)}
                      </Text>
                    </HStack>
                    <Slider
                      value={physicsConfig.windStrength ?? 0}
                      onChange={(v) => handlePhysicsConfigChange('windStrength', v)}
                      min={0}
                      max={20}
                      step={0.5}
                      isDisabled={disabled}
                      colorScheme="teal"
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </VStack>

                  {/* Wind Direction X */}
                  <VStack align="stretch" spacing={1} mb={3}>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.50">Direction (Left/Right)</Text>
                      <Text fontSize="xs" color="gray.300">
                        {(physicsConfig.windDirectionX ?? 1).toFixed(2)}
                      </Text>
                    </HStack>
                    <Slider
                      value={physicsConfig.windDirectionX ?? 1}
                      onChange={(v) => handlePhysicsConfigChange('windDirectionX', v)}
                      min={-1}
                      max={1}
                      step={0.1}
                      isDisabled={disabled}
                      colorScheme="teal"
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </VStack>

                  {/* Wind Direction Z */}
                  <VStack align="stretch" spacing={1} mb={3}>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.50">Direction (Front/Back)</Text>
                      <Text fontSize="xs" color="gray.300">
                        {(physicsConfig.windDirectionZ ?? 0).toFixed(2)}
                      </Text>
                    </HStack>
                    <Slider
                      value={physicsConfig.windDirectionZ ?? 0}
                      onChange={(v) => handlePhysicsConfigChange('windDirectionZ', v)}
                      min={-1}
                      max={1}
                      step={0.1}
                      isDisabled={disabled}
                      colorScheme="teal"
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </VStack>

                  {/* Wind Turbulence */}
                  <VStack align="stretch" spacing={1} mb={3}>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.50">Turbulence</Text>
                      <Text fontSize="xs" color="gray.300">
                        {(physicsConfig.windTurbulence ?? 0.3).toFixed(2)}
                      </Text>
                    </HStack>
                    <Slider
                      value={physicsConfig.windTurbulence ?? 0.3}
                      onChange={(v) => handlePhysicsConfigChange('windTurbulence', v)}
                      min={0}
                      max={1}
                      step={0.05}
                      isDisabled={disabled}
                      colorScheme="teal"
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
                      <Text fontSize="xs" color="gray.50">Gust Speed</Text>
                      <Text fontSize="xs" color="gray.300">
                        {(physicsConfig.windFrequency ?? 2).toFixed(1)}
                      </Text>
                    </HStack>
                    <Slider
                      value={physicsConfig.windFrequency ?? 2}
                      onChange={(v) => handlePhysicsConfigChange('windFrequency', v)}
                      min={0.5}
                      max={5}
                      step={0.1}
                      isDisabled={disabled}
                      colorScheme="teal"
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </VStack>
                </Box>
              </VStack>
            )}
          </Box>
        )}

        {/* HAIR ANIMATION SECTION */}
        {availableMorphs.length > 0 && (
          <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
            <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
              HAIR ANIMATION
            </Text>
            <Text fontSize="xs" color="gray.400" mb={3}>
              Animate hair shape keys (morph targets)
            </Text>
            <VStack align="stretch" spacing={3}>
              {availableMorphs.map((morphKey) => (
                <VStack key={morphKey} align="stretch" spacing={1}>
                  <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.50">{morphKey}</Text>
                    <Text fontSize="xs" color="gray.300">0.0</Text>
                  </HStack>
                  <Slider
                    defaultValue={0}
                    onChange={(value) => handleAnimateHairMorph(morphKey, value)}
                    min={0}
                    max={1}
                    step={0.1}
                    isDisabled={disabled}
                    colorScheme="cyan"
                  >
                    <SliderTrack>
                      <SliderFilledTrack />
                    </SliderTrack>
                    <SliderThumb />
                  </Slider>
                </VStack>
              ))}
            </VStack>
          </Box>
        )}

        {/* RESET BUTTON */}
        <Button
          size="sm"
          colorScheme="orange"
          onClick={handleReset}
          isDisabled={disabled}
        >
          Reset to Default
        </Button>
      </VStack>
    </DockableAccordionItem>
  );
}
