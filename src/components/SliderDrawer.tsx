import React, { useState, useMemo } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  Box,
  IconButton,
  Accordion,
  Button,
  HStack,
  Switch,
  Text
} from '@chakra-ui/react';
import { FaBars } from 'react-icons/fa';
import { AU_INFO, AUInfo } from '../engine/arkit/shapeDict';
import AUSection from './au/AUSection';
import VisemeSection from './au/VisemeSection';
import WindSection from './au/WindSection';
import TTSSection from './au/TTSSection';
import DockableAccordionItem from './au/DockableAccordionItem';
import PlaybackControls from './PlaybackControls';
import { useThreeState } from '../context/threeContext';

interface SliderDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

type Keyframe = { time: number; value: number };

export default function SliderDrawer({ isOpen, onToggle, disabled = false }: SliderDrawerProps) {
  const { engine, windEngine } = useThreeState();

  // Track AU intensities in local state for UI
  const [auStates, setAuStates] = useState<Record<string, number>>({});
  const [visemeStates, setVisemeStates] = useState<Record<string, number>>({});
  const [showUnusedSliders, setShowUnusedSliders] = useState(false);
  const [segmentationMode, setSegmentationMode] = useState<'facePart' | 'faceArea'>('facePart');

  // Curve editor mode and keyframe data
  const [useCurveEditor, setUseCurveEditor] = useState(false);
  const [auKeyframes, setAuKeyframes] = useState<Record<string, Keyframe[]>>({});
  const [visemeKeyframes, setVisemeKeyframes] = useState<Record<string, Keyframe[]>>({});

  // Convert AU_INFO to array
  const actionUnits = useMemo(() => {
    return Object.values(AU_INFO);
  }, []);

  // Group AUs by facePart or faceArea
  const auGroups = useMemo(() => {
    const groups: Record<string, AUInfo[]> = {};
    actionUnits.forEach((au) => {
      const key = segmentationMode === 'facePart'
        ? (au.facePart || 'Other')
        : (au.faceArea || 'Other');
      if (!groups[key]) groups[key] = [];
      groups[key].push(au);
    });
    return groups;
  }, [actionUnits, segmentationMode]);

  // Filter sections to hide empty ones when showUnusedSliders is false
  const filteredSections = useMemo(() => {
    const entries = Object.entries(auGroups);
    if (showUnusedSliders) return entries;
    return entries.filter(([_, aus]) => {
      // Check if any AU in this section has a value > 0
      return aus.some(au => (auStates[au.id] ?? 0) > 0);
    });
  }, [auGroups, auStates, showUnusedSliders]);

  // Reset face to neutral
  const setFaceToNeutral = () => {
    // Zero out all AUs in engine
    Object.keys(AU_INFO).forEach(id => {
      engine?.setAU(id as any, 0);
    });
    // Clear local state
    setAuStates({});
    setVisemeStates({});
  };

  // Handle AU changes
  const handleAUChange = (id: string, value: number) => {
    setAuStates(prev => ({ ...prev, [id]: value }));
  };

  // Handle Viseme changes
  const handleVisemeChange = (key: string, value: number) => {
    setVisemeStates(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <IconButton
        icon={<FaBars />}
        onClick={onToggle}
        position="fixed"
        top="1rem"
        left="1rem"
        zIndex="overlay"
        colorScheme="teal"
        aria-label="Menu"
      />

      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onToggle}
        size="md"
      >
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            Action Units
          </DrawerHeader>

          {/* Controls Panel */}
          <Box p={4} borderBottomWidth="1px">
            <VStack spacing={3} align="stretch">
              <Button size="sm" onClick={setFaceToNeutral} colorScheme="red">
                Reset to Neutral
              </Button>

              <HStack justify="space-between">
                <Text fontSize="sm">Use curve editor</Text>
                <Switch
                  isChecked={useCurveEditor}
                  onChange={(e) => setUseCurveEditor(e.target.checked)}
                  size="sm"
                  colorScheme="teal"
                />
              </HStack>

              <HStack justify="space-between">
                <Text fontSize="sm">Show unused sliders</Text>
                <Switch
                  isChecked={showUnusedSliders}
                  onChange={(e) => setShowUnusedSliders(e.target.checked)}
                  size="sm"
                />
              </HStack>

              <HStack justify="space-between">
                <Text fontSize="sm">Group by</Text>
                <Button
                  size="xs"
                  onClick={() => setSegmentationMode(prev =>
                    prev === 'facePart' ? 'faceArea' : 'facePart'
                  )}
                >
                  {segmentationMode === 'facePart' ? 'Face Part' : 'Face Area'}
                </Button>
              </HStack>
            </VStack>
          </Box>

          <DrawerBody>
            <Accordion allowMultiple>
              {/* Text-to-Speech Section */}
              <TTSSection
                engine={engine}
                disabled={disabled}
              />

              {/* Playback Controls Section */}
              <DockableAccordionItem title="Playback Controls">
                <PlaybackControls />
              </DockableAccordionItem>

              {/* Wind Physics Section */}
              <WindSection
                windEngine={windEngine}
                disabled={disabled}
              />

              {/* Viseme Section */}
              <VisemeSection
                engine={engine}
                visemeStates={visemeStates}
                onVisemeChange={handleVisemeChange}
                disabled={disabled}
                useCurveEditor={useCurveEditor}
                visemeKeyframes={visemeKeyframes}
                onKeyframesChange={setVisemeKeyframes}
              />

              {/* AU Sections (continuum sliders appear inline with their sections) */}
              {filteredSections.map(([section, aus]) => (
                <AUSection
                  key={section}
                  section={section}
                  aus={aus}
                  auStates={auStates}
                  engine={engine}
                  showUnusedSliders={showUnusedSliders}
                  onAUChange={handleAUChange}
                  disabled={disabled}
                  useCurveEditor={useCurveEditor}
                  auKeyframes={auKeyframes}
                  onKeyframesChange={setAuKeyframes}
                />
              ))}
            </Accordion>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
