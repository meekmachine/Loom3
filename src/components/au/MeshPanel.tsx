import React, { useEffect, useState } from 'react';
import {
  VStack,
  HStack,
  Text,
  Switch,
  Box,
  Badge,
} from '@chakra-ui/react';
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

export default function MeshPanel({ engine, defaultExpanded = false }: MeshPanelProps) {
  const [meshes, setMeshes] = useState<MeshInfo[]>([]);
  const [categoryVisibility, setCategoryVisibility] = useState<Record<string, boolean>>({});

  // Refresh mesh list
  const refreshMeshes = () => {
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
  };

  useEffect(() => {
    refreshMeshes();
  }, [engine]);

  const toggleMesh = (name: string, visible: boolean) => {
    engine?.setMeshVisible(name, visible);
    refreshMeshes();
  };

  const toggleCategory = (category: string, visible: boolean) => {
    engine?.setCategoryVisible(category, visible);
    refreshMeshes();
  };

  if (!engine || meshes.length === 0) {
    return (
      <DockableAccordionItem title="Meshes" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">No meshes loaded</Text>
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
      <VStack align="stretch" spacing={3} p={2}>
        <Text fontSize="xs" color="gray.400">{meshes.length} meshes loaded</Text>

        {categories.map(cat => (
          <Box key={cat} borderWidth="1px" borderColor="gray.600" borderRadius="md" p={2}>
            <HStack justify="space-between" mb={2}>
              <HStack>
                <Badge colorScheme={CATEGORY_COLORS[cat] || 'gray'}>{cat}</Badge>
                <Text fontSize="xs" color="gray.400">({byCategory[cat].length})</Text>
              </HStack>
              <Switch
                size="sm"
                isChecked={categoryVisibility[cat] ?? true}
                onChange={(e) => toggleCategory(cat, e.target.checked)}
              />
            </HStack>

            <VStack align="stretch" spacing={1} pl={2}>
              {byCategory[cat].map(m => (
                <HStack key={m.name} justify="space-between" fontSize="xs">
                  <HStack spacing={2}>
                    <Text color={m.visible ? 'white' : 'gray.500'}>{m.name}</Text>
                    {m.morphCount > 0 && (
                      <Text color="gray.500">({m.morphCount} morphs)</Text>
                    )}
                  </HStack>
                  <Switch
                    size="sm"
                    isChecked={m.visible}
                    onChange={(e) => toggleMesh(m.name, e.target.checked)}
                  />
                </HStack>
              ))}
            </VStack>
          </Box>
        ))}
      </VStack>
    </DockableAccordionItem>
  );
}
