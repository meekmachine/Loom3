import React, { useState, useMemo, useEffect } from 'react';
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
import EyeHeadTrackingSection from './au/EyeHeadTrackingSection';
import DockableAccordionItem from './au/DockableAccordionItem';
import PlaybackControls from './PlaybackControls';
import EngineSceneSwitcher, { EngineType, SceneType } from './au/EngineSceneSwitcher';
import { useThreeState } from '../context/threeContext';
import type { NormalizedSnippet, CurvePoint } from '../latticework/animation/types';

interface SliderDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  currentEngine?: EngineType;
  currentScene?: SceneType;
  onEngineChange?: (engine: EngineType) => void;
  onSceneChange?: (scene: SceneType) => void;
}

type Keyframe = { time: number; value: number };

type SnippetCurveData = {
  snippetName: string;
  keyframes: Keyframe[];
  snippet: NormalizedSnippet;
};

// Helper to convert CurvePoint[] to Keyframe[]
// Normalizes intensity from 0-100 to 0-1 range
function curvePointsToKeyframes(points: CurvePoint[]): Keyframe[] {
  return points.map(p => ({
    time: p.time,
    value: p.intensity > 1 ? p.intensity / 100 : p.intensity
  }));
}

export default function SliderDrawer({
  isOpen,
  onToggle,
  disabled = false,
  currentEngine = 'three',
  currentScene = 'glb',
  onEngineChange,
  onSceneChange
}: SliderDrawerProps) {
  const { engine, windEngine, anim, addFrameListener } = useThreeState();

  // Track AU intensities in local state for UI
  const [auStates, setAuStates] = useState<Record<string, number>>({});
  const [visemeStates, setVisemeStates] = useState<Record<string, number>>({});
  const [showUnusedSliders, setShowUnusedSliders] = useState(false);
  const [segmentationMode, setSegmentationMode] = useState<'facePart' | 'faceArea'>('facePart');

  // Curve editor mode and snippet data
  const [useCurveEditor, setUseCurveEditor] = useState(false);
  const [showOnlyPlayingSnippets, setShowOnlyPlayingSnippets] = useState(false);
  // Map of AU/Viseme ID -> array of snippet curve data
  const [auSnippetCurves, setAuSnippetCurves] = useState<Record<string, SnippetCurveData[]>>({});
  const [visemeSnippetCurves, setVisemeSnippetCurves] = useState<Record<string, SnippetCurveData[]>>({});

  // Animation snippets from animation service
  const [snippets, setSnippets] = useState<NormalizedSnippet[]>([]);

  // Poll machine state using Three.js frame listener
  // NOTE: Can't use onTransition because animationScheduler mutates state directly
  useEffect(() => {
    if (!anim || !addFrameListener) return;

    console.log('[SliderDrawer] Setting up frame listener to poll machine state');

    // Track animation list to detect changes
    let lastAnimationNames: string[] = [];

    const listener = (dt: number) => {
      const state = anim.getState?.();
      const animations = (state?.context?.animations as NormalizedSnippet[]) || [];

      // Check if animations list changed (new animation added/removed)
      const currentNames = animations.map(a => a.name).sort().join(',');
      const listChanged = currentNames !== lastAnimationNames.join(',');

      if (listChanged) {
        console.log('[SliderDrawer] ========== Animation list changed ==========');
        console.log('[SliderDrawer] Previous:', lastAnimationNames);
        console.log('[SliderDrawer] Current:', animations.map(a => a.name));
        lastAnimationNames = animations.map(a => a.name).sort();
      }

      // Always rebuild curve data (handles both list changes and currentTime updates)
      const newAuCurves: Record<string, SnippetCurveData[]> = {};
      const newVisemeCurves: Record<string, SnippetCurveData[]> = {};

      animations.forEach(snippet => {
        if (!snippet.curves) return;

        // Filter by playing state if enabled
        if (showOnlyPlayingSnippets && !snippet.isPlaying) return;

        // Calculate current time from wall clock if playing
        let currentTime = snippet.currentTime || 0;
        if (snippet.isPlaying && snippet.startWallTime) {
          const now = Date.now();
          const rate = snippet.snippetPlaybackRate || 1;
          currentTime = ((now - snippet.startWallTime) / 1000) * rate;

          // Handle looping
          if (snippet.loop && snippet.duration > 0) {
            currentTime = ((currentTime % snippet.duration) + snippet.duration) % snippet.duration;
          } else if (currentTime > snippet.duration) {
            currentTime = snippet.duration;
          }
        }

        if (listChanged) {
          console.log(`[SliderDrawer] Processing snippet: ${snippet.name}, category: ${snippet.snippetCategory}, isPlaying: ${snippet.isPlaying}, curves:`, Object.keys(snippet.curves));
        }

        Object.entries(snippet.curves).forEach(([curveId, points]) => {
          const keyframes = curvePointsToKeyframes(points);
          const curveData: SnippetCurveData = {
            snippetName: snippet.name,
            keyframes,
            snippet: { ...snippet, currentTime }
          };

          // Check snippet category to determine if it's AU or viseme
          // Visemes use indices 0-14, AUs use indices >= 15
          const curveIdNum = parseInt(curveId);
          const isVisemeIndex = !isNaN(curveIdNum) && curveIdNum >= 0 && curveIdNum <= 14;

          if (snippet.snippetCategory === 'visemeSnippet' || isVisemeIndex) {
            if (!newVisemeCurves[curveId]) newVisemeCurves[curveId] = [];
            newVisemeCurves[curveId].push(curveData);
          } else if (/^\d+$/.test(curveId)) {
            // Numeric IDs >= 15 are AUs
            if (!newAuCurves[curveId]) newAuCurves[curveId] = [];
            newAuCurves[curveId].push(curveData);
          } else {
            // Non-numeric IDs (like viseme names) go to visemes
            if (!newVisemeCurves[curveId]) newVisemeCurves[curveId] = [];
            newVisemeCurves[curveId].push(curveData);
          }
        });
      });

      if (listChanged) {
        console.log('[SliderDrawer] AU curves keys:', Object.keys(newAuCurves));
        console.log('[SliderDrawer] Viseme curves keys:', Object.keys(newVisemeCurves));
      }

      setAuSnippetCurves(newAuCurves);
      setVisemeSnippetCurves(newVisemeCurves);
    };

    const cleanup = addFrameListener(listener);
    return cleanup;
  }, [anim, addFrameListener, showOnlyPlayingSnippets]);

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

    // In curve editor mode, always show all sections (user can choose which to view)
    if (useCurveEditor) {
      return entries;
    }

    // In slider mode, respect the showUnusedSliders toggle
    if (showUnusedSliders) return entries;
    return entries.filter(([_, aus]) => {
      // Check if any AU has a value > 0
      return aus.some(au => (auStates[au.id] ?? 0) > 0);
    });
  }, [auGroups, auStates, showUnusedSliders, useCurveEditor]);

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
        colorScheme="brand"
        aria-label="Menu"
        size="lg"
        boxShadow="lg"
        _hover={{ transform: 'scale(1.05)', boxShadow: 'xl' }}
        transition="all 0.2s"
      />

      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onToggle}
        size="md"
      >
        <DrawerContent zIndex={9999} bg="gray.850">
          <DrawerCloseButton color="gray.400" _hover={{ color: 'gray.200', bg: 'gray.700' }} />
          <DrawerHeader borderBottomWidth="1px" borderColor="gray.700" bg="gray.800" color="gray.50" fontWeight="bold">
            Action Units
          </DrawerHeader>

          {/* Controls Panel */}
          <Box p={4} borderBottomWidth="1px" borderColor="gray.700" bg="gray.800">
            <VStack spacing={3} align="stretch">
              <Button size="sm" onClick={setFaceToNeutral} colorScheme="red" fontWeight="semibold">
                Reset to Neutral
              </Button>

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.300">Use curve editor</Text>
                <Switch
                  isChecked={useCurveEditor}
                  onChange={(e) => setUseCurveEditor(e.target.checked)}
                  size="sm"
                  colorScheme="brand"
                />
              </HStack>

              {useCurveEditor && (
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.300">Show only playing</Text>
                  <Switch
                    isChecked={showOnlyPlayingSnippets}
                    onChange={(e) => setShowOnlyPlayingSnippets(e.target.checked)}
                    size="sm"
                    colorScheme="green"
                  />
                </HStack>
              )}

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.300">Show unused sliders</Text>
                <Switch
                  isChecked={showUnusedSliders}
                  onChange={(e) => setShowUnusedSliders(e.target.checked)}
                  size="sm"
                  colorScheme="brand"
                />
              </HStack>

              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.300">Group by</Text>
                <Button
                  size="xs"
                  onClick={() => setSegmentationMode(prev =>
                    prev === 'facePart' ? 'faceArea' : 'facePart'
                  )}
                  colorScheme="brand"
                  variant="outline"
                >
                  {segmentationMode === 'facePart' ? 'Face Part' : 'Face Area'}
                </Button>
              </HStack>
            </VStack>
          </Box>

          <DrawerBody bg="gray.850">
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

              {/* Eye and Head Tracking Section */}
              <EyeHeadTrackingSection
                engine={engine}
                disabled={disabled}
              />

              {/* Wind Physics Section */}
              <WindSection
                windEngine={windEngine}
                disabled={disabled}
              />

              {/* Engine and Scene Switcher */}
              {onEngineChange && onSceneChange && (
                <DockableAccordionItem title="Engine & Scene Switcher">
                  <EngineSceneSwitcher
                    currentEngine={currentEngine}
                    currentScene={currentScene}
                    onEngineChange={onEngineChange}
                    onSceneChange={onSceneChange}
                  />
                </DockableAccordionItem>
              )}

              {/* Viseme Section */}
              <VisemeSection
                engine={engine}
                visemeStates={visemeStates}
                onVisemeChange={handleVisemeChange}
                disabled={disabled}
                useCurveEditor={useCurveEditor}
                visemeSnippetCurves={visemeSnippetCurves}
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
                  auSnippetCurves={auSnippetCurves}
                />
              ))}
            </Accordion>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
