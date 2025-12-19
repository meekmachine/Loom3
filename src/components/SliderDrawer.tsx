import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  Box,
  IconButton,
  Accordion,
  Button,
  HStack,
  Switch,
  Text,
  Tooltip,
  Heading
} from '@chakra-ui/react';
import { FaBars, FaPlay, FaSmile, FaComment, FaEye, FaCut, FaCubes, FaMicrophone, FaRegEyeSlash, FaGlobe } from 'react-icons/fa';
import { AU_INFO, AUInfo } from '../engine/arkit/shapeDict';
import AUSection from './au/AUSection';
import VisemeSection from './au/VisemeSection';
import TTSSection from './au/TTSSection';
import EyeHeadTrackingSection from './au/EyeHeadTrackingSection';
import HairSection from './au/HairSection';
import BlinkSection from './au/BlinkSection';
import DockableAccordionItem from './au/DockableAccordionItem';
import PlaybackControls from './PlaybackControls';
import MeshPanel from './au/MeshPanel';
import SkyboxSection from './au/SkyboxSection';

// Tab definitions
type TabId = 'animation' | 'speech' | 'blink' | 'aus' | 'visemes' | 'tracking' | 'hair' | 'meshes' | 'skybox';

interface TabDef {
  id: TabId;
  icon: React.ElementType;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'animation', icon: FaPlay, label: 'Animation' },
  { id: 'speech', icon: FaMicrophone, label: 'Speech' },
  { id: 'blink', icon: FaRegEyeSlash, label: 'Blink' },
  { id: 'aus', icon: FaSmile, label: 'Action Units' },
  { id: 'visemes', icon: FaComment, label: 'Visemes' },
  { id: 'tracking', icon: FaEye, label: 'Eye & Head' },
  { id: 'hair', icon: FaCut, label: 'Hair' },
  { id: 'meshes', icon: FaCubes, label: 'Meshes' },
  { id: 'skybox', icon: FaGlobe, label: 'Skybox' },
];
import { useThreeState } from '../context/threeContext';
import type { NormalizedSnippet, CurvePoint } from '../latticework/animation/types';
import { HairService } from '../latticework/hair/hairService';
import { BlinkService } from '../latticework/blink/blinkService';

interface SliderDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hairService?: HairService | null;
  blinkService?: BlinkService | null;
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

// Section header component - defined outside to prevent recreation on every render
const SectionHeader = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <HStack spacing={2} mb={2}>
    <Icon />
    <Heading size="sm" color="white">{label}</Heading>
  </HStack>
);

export default function SliderDrawer({
  isOpen,
  onToggle,
  disabled = false,
  hairService,
  blinkService
}: SliderDrawerProps) {
  const { engine, anim } = useThreeState();

  // Refs for each section to enable scroll-to-section
  const sectionRefs = useRef<Record<TabId, HTMLDivElement | null>>({
    animation: null,
    speech: null,
    blink: null,
    aus: null,
    visemes: null,
    tracking: null,
    hair: null,
    meshes: null,
    skybox: null,
  });

  // Active tab state (for visual indicator)
  const [activeTab, setActiveTab] = useState<TabId>('animation');

  // Scroll to section when tab is clicked
  const scrollToSection = (tabId: TabId) => {
    setActiveTab(tabId);
    const sectionEl = sectionRefs.current[tabId];
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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

  // Use ref to avoid re-subscribing when showOnlyPlayingSnippets changes
  const showOnlyPlayingRef = useRef(showOnlyPlayingSnippets);
  showOnlyPlayingRef.current = showOnlyPlayingSnippets;

  // Stable callback to process animation snapshots - prevents circular re-renders
  const processAnimationSnapshot = useCallback((snapshot: any) => {
    const animations = (snapshot?.context?.animations as NormalizedSnippet[]) || [];

    // Rebuild curve data from current animations
    const newAuCurves: Record<string, SnippetCurveData[]> = {};
    const newVisemeCurves: Record<string, SnippetCurveData[]> = {};

    animations.forEach(snippet => {
      if (!snippet.curves) return;

      // Filter by playing state if enabled (use ref to get current value)
      if (showOnlyPlayingRef.current && !snippet.isPlaying) return;

      const currentTime = snippet.currentTime || 0;

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

    setAuSnippetCurves(newAuCurves);
    setVisemeSnippetCurves(newVisemeCurves);
  }, []); // No dependencies - uses refs for mutable values

  // Subscribe to animation machine state transitions
  // This only fires when animations are added/removed/played/paused - NOT every frame
  useEffect(() => {
    if (!anim?.onTransition) return;

    const unsubscribe = anim.onTransition(processAnimationSnapshot);
    return unsubscribe;
  }, [anim, processAnimationSnapshot]);

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

  // Reset face to neutral - uses comprehensive engine method that resets both morphs and bones
  const setFaceToNeutral = () => {
    engine?.resetToNeutral();
    // Clear local UI state
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
        <DrawerContent
          zIndex={9999}
          bg="rgba(255, 255, 255, 0.5)"
          backdropFilter="blur(10px)"
          sx={{
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <DrawerCloseButton color="gray.400" _hover={{ color: 'gray.200', bg: 'gray.700' }} />

          {/* Main layout: vertical tabs on left, content on right */}
          <HStack align="stretch" h="100%" spacing={0}>
            {/* Vertical Tab Bar */}
            <VStack
              spacing={1}
              py={4}
              px={2}
              bg="gray.900"
              borderRight="1px solid"
              borderColor="gray.700"
              align="center"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <Tooltip key={tab.id} label={tab.label} placement="right" hasArrow>
                    <IconButton
                      aria-label={tab.label}
                      icon={<Icon />}
                      onClick={() => scrollToSection(tab.id)}
                      variant={isActive ? 'solid' : 'ghost'}
                      colorScheme={isActive ? 'brand' : 'gray'}
                      size="lg"
                      fontSize="xl"
                      color={isActive ? 'white' : 'gray.300'}
                      bg={isActive ? 'brand.500' : 'transparent'}
                      _hover={{
                        bg: isActive ? 'brand.400' : 'gray.700',
                        color: 'white',
                        transform: 'scale(1.1)',
                      }}
                      transition="all 0.2s"
                    />
                  </Tooltip>
                );
              })}
            </VStack>

            {/* Content Area - All sections scrollable */}
            <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
              <DrawerBody bg="transparent" flex={1} overflowY="auto" pt={4}>
                <VStack spacing={6} align="stretch">
                  {/* Animation Section */}
                  <Box ref={(el) => { sectionRefs.current.animation = el; }}>
                    <SectionHeader icon={FaPlay} label="Animation" />
                    <DockableAccordionItem title="Playback Controls" isDefaultExpanded>
                      <PlaybackControls />
                    </DockableAccordionItem>
                  </Box>

                  {/* Speech Section */}
                  <Box ref={(el) => { sectionRefs.current.speech = el; }}>
                    <SectionHeader icon={FaMicrophone} label="Speech" />
                    <TTSSection engine={engine} disabled={disabled} defaultExpanded />
                  </Box>

                  {/* Blink Section */}
                  <Box ref={(el) => { sectionRefs.current.blink = el; }}>
                    <SectionHeader icon={FaRegEyeSlash} label="Blink" />
                    <BlinkSection blinkService={blinkService} disabled={disabled} defaultExpanded />
                  </Box>

                  {/* Action Units Section */}
                  <Box ref={(el) => { sectionRefs.current.aus = el; }}>
                    <SectionHeader icon={FaSmile} label="Action Units" />
                    <VStack spacing={4} align="stretch">
                      {/* AU Controls */}
                      <Box p={3} bg="gray.750" borderRadius="md">
                        <VStack spacing={2} align="stretch">
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
                      <Accordion allowMultiple>
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
                    </VStack>
                  </Box>

                  {/* Visemes Section */}
                  <Box ref={(el) => { sectionRefs.current.visemes = el; }}>
                    <SectionHeader icon={FaComment} label="Visemes" />
                    <VisemeSection
                      engine={engine}
                      visemeStates={visemeStates}
                      onVisemeChange={handleVisemeChange}
                      disabled={disabled}
                      useCurveEditor={useCurveEditor}
                      visemeSnippetCurves={visemeSnippetCurves}
                      defaultExpanded
                    />
                  </Box>

                  {/* Eye & Head Tracking Section */}
                  <Box ref={(el) => { sectionRefs.current.tracking = el; }}>
                    <SectionHeader icon={FaEye} label="Eye & Head Tracking" />
                    <EyeHeadTrackingSection engine={engine} disabled={disabled} defaultExpanded />
                  </Box>

                  {/* Hair Section */}
                  <Box ref={(el) => { sectionRefs.current.hair = el; }}>
                    <SectionHeader icon={FaCut} label="Hair" />
                    <HairSection hairService={hairService} disabled={disabled} defaultExpanded />
                  </Box>

                  {/* Meshes Section */}
                  <Box ref={(el) => { sectionRefs.current.meshes = el; }}>
                    <SectionHeader icon={FaCubes} label="Meshes" />
                    <MeshPanel engine={engine} defaultExpanded />
                  </Box>

                  {/* Skybox Section */}
                  <Box ref={(el) => { sectionRefs.current.skybox = el; }}>
                    <SectionHeader icon={FaGlobe} label="Skybox" />
                    <SkyboxSection engine={engine} disabled={disabled} defaultExpanded />
                  </Box>
                </VStack>
              </DrawerBody>
            </Box>
          </HStack>
        </DrawerContent>
      </Drawer>
    </>
  );
}
