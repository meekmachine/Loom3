import React, { useEffect, useState, memo, useCallback } from 'react';
import {
  VStack,
  HStack,
  Text,
  Switch,
  Box,
  Badge,
  Slider,
  Collapsible,
  IconButton,
} from '@chakra-ui/react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { EngineThree } from '../../engine/EngineThree';
import DockableAccordionItem from './DockableAccordionItem';

interface MeshPanelProps {
  engine: EngineThree | null;
  defaultExpanded?: boolean;
}

interface MeshInfo {
  name: string;
  visible: boolean;
  category: string;
  morphCount: number;
}

interface MaterialConfig {
  renderOrder: number;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  depthTest: boolean;
  blending: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  body: 'blue',
  eye: 'purple',
  eyeOcclusion: 'cyan',
  tearLine: 'teal',
  teeth: 'gray',
  tongue: 'pink',
  hair: 'orange',
  eyebrow: 'yellow',
  cornea: 'purple',
  eyelash: 'gray',
  other: 'gray',
};

const BLENDING_OPTIONS = ['Normal', 'Additive', 'Subtractive', 'Multiply', 'None'];

// Sub-component for material config controls
function MeshMaterialConfig({
  meshName,
  engine,
}: {
  meshName: string;
  engine: EngineThree;
}) {
  const [config, setConfig] = useState<MaterialConfig | null>(null);

  // Load config on mount
  useEffect(() => {
    const c = engine.getMeshMaterialConfig(meshName);
    setConfig(c);
  }, [engine, meshName]);

  const updateConfig = useCallback((updates: Partial<MaterialConfig>) => {
    engine.setMeshMaterialConfig(meshName, updates);
    // Refresh local state
    const c = engine.getMeshMaterialConfig(meshName);
    setConfig(c);
  }, [engine, meshName]);

  if (!config) return null;

  return (
    <VStack align="stretch" gap={2} mt={2} p={2} bg="gray.800" borderRadius="md">
      {/* Render Order */}
      <Box>
        <HStack justify="space-between" mb={1}>
          <Text fontSize="xs" color="white">Render Order</Text>
          <Text fontSize="xs" color="white">{config.renderOrder}</Text>
        </HStack>
        <Slider.Root
          min={-20}
          max={20}
          step={1}
          value={[config.renderOrder]}
          onValueChange={(d) => updateConfig({ renderOrder: d.value[0] })}
          size="sm"
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} />
          </Slider.Control>
        </Slider.Root>
      </Box>

      {/* Opacity */}
      <Box>
        <HStack justify="space-between" mb={1}>
          <Text fontSize="xs" color="white">Opacity</Text>
          <Text fontSize="xs" color="white">{config.opacity.toFixed(2)}</Text>
        </HStack>
        <Slider.Root
          min={0}
          max={1}
          step={0.05}
          value={[config.opacity]}
          onValueChange={(d) => updateConfig({ opacity: d.value[0] })}
          size="sm"
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} />
          </Slider.Control>
        </Slider.Root>
      </Box>

      {/* Transparent toggle */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Transparent</Text>
        <Switch.Root
          size="sm"
          checked={config.transparent}
          onCheckedChange={(d) => updateConfig({ transparent: d.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      {/* Depth Write toggle */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Depth Write</Text>
        <Switch.Root
          size="sm"
          checked={config.depthWrite}
          onCheckedChange={(d) => updateConfig({ depthWrite: d.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      {/* Depth Test toggle */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Depth Test</Text>
        <Switch.Root
          size="sm"
          checked={config.depthTest}
          onCheckedChange={(d) => updateConfig({ depthTest: d.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      {/* Blending Mode */}
      <Box>
        <Text fontSize="xs" color="white" mb={1}>Blending</Text>
        <HStack gap={1} flexWrap="wrap">
          {BLENDING_OPTIONS.map((mode) => (
            <Badge
              key={mode}
              colorPalette={config.blending === mode ? 'cyan' : 'gray'}
              cursor="pointer"
              onClick={() => updateConfig({ blending: mode })}
              _hover={{ opacity: 0.8 }}
            >
              {mode}
            </Badge>
          ))}
        </HStack>
      </Box>
    </VStack>
  );
}

// Individual mesh row with expandable config
function MeshRow({
  mesh,
  engine,
  onToggle,
}: {
  mesh: MeshInfo;
  engine: EngineThree;
  onToggle: (name: string, visible: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box>
      <HStack justify="space-between" fontSize="xs">
        <HStack gap={1}>
          <IconButton
            size="xs"
            variant="ghost"
            aria-label="Expand material settings"
            onClick={() => setExpanded(!expanded)}
            minW={5}
            h={5}
            p={0}
          >
            {expanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
          </IconButton>
          <Text color={mesh.visible ? 'white' : 'gray.500'}>{mesh.name}</Text>
          {mesh.morphCount > 0 && (
            <Text color="white">({mesh.morphCount} morphs)</Text>
          )}
        </HStack>
        <Switch.Root
          size="sm"
          checked={mesh.visible}
          onCheckedChange={(details) => onToggle(mesh.name, details.checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      <Collapsible.Root open={expanded}>
        <Collapsible.Content>
          <MeshMaterialConfig meshName={mesh.name} engine={engine} />
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}

function MeshPanel({ engine, defaultExpanded = false }: MeshPanelProps) {
  const [meshes, setMeshes] = useState<MeshInfo[]>([]);
  const [categoryVisibility, setCategoryVisibility] = useState<Record<string, boolean>>({});

  // Refresh mesh list
  const refreshMeshes = useCallback(() => {
    if (!engine) return;
    const list = engine.getMeshList();
    setMeshes(list);

    // Build category visibility from mesh states
    const catVis: Record<string, boolean> = {};
    for (const m of list) {
      if (catVis[m.category] === undefined) {
        catVis[m.category] = m.visible;
      } else {
        // If any mesh in category is visible, category is "on"
        catVis[m.category] = catVis[m.category] || m.visible;
      }
    }
    setCategoryVisibility(catVis);
  }, [engine]);

  useEffect(() => {
    refreshMeshes();
  }, [refreshMeshes]);

  const toggleMesh = useCallback((name: string, visible: boolean) => {
    engine?.setMeshVisible(name, visible);
    refreshMeshes();
  }, [engine, refreshMeshes]);

  const toggleCategory = useCallback((category: string, visible: boolean) => {
    engine?.setCategoryVisible(category, visible);
    refreshMeshes();
  }, [engine, refreshMeshes]);

  if (!engine || meshes.length === 0) {
    return (
      <DockableAccordionItem title="Meshes" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="white">No meshes loaded</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  // Group by category
  const byCategory: Record<string, MeshInfo[]> = {};
  for (const m of meshes) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }

  const categories = Object.keys(byCategory).sort();

  return (
    <DockableAccordionItem title="Meshes" isDefaultExpanded={defaultExpanded}>
      <VStack align="stretch" gap={3} p={2}>
        <Text fontSize="xs" color="white">{meshes.length} meshes - click ▶ to expand material settings</Text>

        {categories.map(cat => (
          <Box key={cat} borderWidth="1px" borderColor="gray.600" borderRadius="md" p={2}>
            <HStack justify="space-between" mb={2}>
              <HStack>
                <Badge colorPalette={CATEGORY_COLORS[cat] || 'gray'}>{cat}</Badge>
                <Text fontSize="xs" color="white">({byCategory[cat].length})</Text>
              </HStack>
              <Switch.Root
                size="sm"
                checked={categoryVisibility[cat] ?? true}
                onCheckedChange={(details) => toggleCategory(cat, details.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </HStack>

            <VStack align="stretch" gap={1} pl={2}>
              {byCategory[cat].map(m => (
                <MeshRow
                  key={m.name}
                  mesh={m}
                  engine={engine}
                  onToggle={toggleMesh}
                />
              ))}
            </VStack>
          </Box>
        ))}
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(MeshPanel);
