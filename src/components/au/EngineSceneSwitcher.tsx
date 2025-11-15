import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Select,
  Box,
  Badge,
  Divider
} from '@chakra-ui/react';

export type EngineType = 'three' | 'fiber';
export type SceneType = 'glb' | 'fiber';

interface EngineSceneSwitcherProps {
  currentEngine: EngineType;
  currentScene: SceneType;
  onEngineChange: (engine: EngineType) => void;
  onSceneChange: (scene: SceneType) => void;
}

/**
 * EngineSceneSwitcher - UI component for switching between rendering engines and scenes
 *
 * This component allows users to toggle between:
 * - EngineThree (vanilla Three.js) and EngineFour (React Three Fiber)
 * - CharacterGLBScene (vanilla Three.js) and CharacterFiberScene (React Three Fiber)
 */
export default function EngineSceneSwitcher({
  currentEngine,
  currentScene,
  onEngineChange,
  onSceneChange
}: EngineSceneSwitcherProps) {
  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* Engine Selector */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.300" fontWeight="medium">
              Rendering Engine
            </Text>
            <Badge
              colorScheme={currentEngine === 'fiber' ? 'green' : 'blue'}
              fontSize="xs"
            >
              {currentEngine === 'fiber' ? 'R3F' : 'Three.js'}
            </Badge>
          </HStack>
          <Select
            value={currentEngine}
            onChange={(e) => onEngineChange(e.target.value as EngineType)}
            size="sm"
            bg="gray.700"
            borderColor="gray.600"
            color="gray.100"
            _hover={{ borderColor: 'gray.500' }}
            _focus={{ borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)' }}
          >
            <option value="three" style={{ background: '#2D3748' }}>
              EngineThree (Vanilla Three.js)
            </option>
            <option value="fiber" style={{ background: '#2D3748' }}>
              EngineFour (React Three Fiber)
            </option>
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            {currentEngine === 'three'
              ? 'Classic imperative Three.js engine with manual RAF loop'
              : 'Declarative React Three Fiber engine with useFrame hooks'}
          </Text>
        </Box>

        <Divider borderColor="gray.700" />

        {/* Scene Selector */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.300" fontWeight="medium">
              Scene Renderer
            </Text>
            <Badge
              colorScheme={currentScene === 'fiber' ? 'green' : 'blue'}
              fontSize="xs"
            >
              {currentScene === 'fiber' ? 'R3F' : 'Three.js'}
            </Badge>
          </HStack>
          <Select
            value={currentScene}
            onChange={(e) => onSceneChange(e.target.value as SceneType)}
            size="sm"
            bg="gray.700"
            borderColor="gray.600"
            color="gray.100"
            _hover={{ borderColor: 'gray.500' }}
            _focus={{ borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)' }}
          >
            <option value="glb" style={{ background: '#2D3748' }}>
              CharacterGLBScene (Three.js Canvas)
            </option>
            <option value="fiber" style={{ background: '#2D3748' }}>
              CharacterFiberScene (R3F Canvas)
            </option>
          </Select>
          <Text fontSize="xs" color="gray.500" mt={1}>
            {currentScene === 'glb'
              ? 'Manual WebGL renderer with custom loading animation'
              : 'Declarative R3F canvas with Suspense and Environment'}
          </Text>
        </Box>
      </VStack>

      {/* Info Box */}
      <Box
        mt={4}
        p={3}
        bg="blue.900"
        borderRadius="md"
        borderWidth="1px"
        borderColor="blue.700"
      >
        <Text fontSize="xs" color="blue.200" fontWeight="medium" mb={1}>
          💡 Tip
        </Text>
        <Text fontSize="xs" color="blue.300">
          Both engines implement the same interface, so all AU sliders and controls work identically.
          Try switching between them to see the difference!
        </Text>
      </Box>
    </Box>
  );
}
