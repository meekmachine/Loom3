import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
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
import { useThreeState } from '../context/threeContext';
import type { NormalizedSnippet, CurvePoint } from '../latticework/animation/types';
import { HairService } from '../latticework/hair/hairService';
import { BlinkService } from '../latticework/blink/blinkService';
import { EngineThree } from '../engine/EngineThree';

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
function curvePointsToKeyframes(points: CurvePoint[]): Keyframe[] {
  return points.map(p => ({
    time: p.time,
    value: p.intensity > 1 ? p.intensity / 100 : p.intensity
  }));
}

// Memoized tab button with stable onClick
const TabButton = memo(({
  tabId,
  icon: Icon,
  label,
  isActive,
  onTabClick
}: {
  tabId: TabId;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onTabClick: (id: TabId) => void;
}) => {
  const handleClick = useCallback(() => {
    onTabClick(tabId);
  }, [tabId, onTabClick]);

  return (
    <Tooltip label={label} placement="right" hasArrow>
      <IconButton
        aria-label={label}
        icon={<Icon />}
        onClick={handleClick}
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
});

// Memoized tab bar
const TabBar = memo(({
  activeTab,
  onTabClick
}: {
  activeTab: TabId;
  onTabClick: (tab: TabId) => void;
}) => (
  <VStack
    spacing={1}
    py={4}
    px={2}
    bg="gray.900"
    borderRight="1px solid"
    borderColor="gray.700"
    align="center"
  >
    {TABS.map((tab) => (
      <TabButton
        key={tab.id}
        tabId={tab.id}
        icon={tab.icon}
        label={tab.label}
        isActive={activeTab === tab.id}
        onTabClick={onTabClick}
      />
    ))}
  </VStack>
));

// ============ Individual Tab Content Components ============

// Animation Tab
const AnimationTabContent = memo(() => (
  <DockableAccordionItem title="Playback Controls" isDefaultExpanded>
    <PlaybackControls />
  </DockableAccordionItem>
));

// Speech Tab
const SpeechTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => (
  <TTSSection engine={engine} disabled={disabled} defaultExpanded />
));

// Blink Tab
const BlinkTabContent = memo(({ blinkService, disabled }: { blinkService: BlinkService | null; disabled: boolean }) => (
  <BlinkSection blinkService={blinkService} disabled={disabled} defaultExpanded />
));

// Tracking Tab
const TrackingTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => (
  <EyeHeadTrackingSection engine={engine} disabled={disabled} defaultExpanded />
));

// Hair Tab
const HairTabContent = memo(({ hairService, disabled }: { hairService: HairService | null; disabled: boolean }) => (
  <HairSection hairService={hairService} disabled={disabled} defaultExpanded />
));

// Meshes Tab
const MeshesTabContent = memo(({ engine }: { engine: EngineThree | null }) => (
  <MeshPanel engine={engine} defaultExpanded />
));

// Skybox Tab
const SkyboxTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => (
  <SkyboxSection engine={engine} disabled={disabled} defaultExpanded />
));

// AU Controls panel
const AUControlsPanel = memo(({
  onResetToNeutral,
  useCurveEditor,
  onUseCurveEditorChange,
  showOnlyPlayingSnippets,
  onShowOnlyPlayingChange,
  segmentationMode,
  onSegmentationModeToggle
}: {
  onResetToNeutral: () => void;
  useCurveEditor: boolean;
  onUseCurveEditorChange: (v: boolean) => void;
  showOnlyPlayingSnippets: boolean;
  onShowOnlyPlayingChange: (v: boolean) => void;
  segmentationMode: 'facePart' | 'faceArea';
  onSegmentationModeToggle: () => void;
}) => (
  <Box p={3} bg="gray.750" borderRadius="md">
    <VStack spacing={2} align="stretch">
      <Button size="sm" onClick={onResetToNeutral} colorScheme="red" fontWeight="semibold">
        Reset to Neutral
      </Button>
      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.300">Use curve editor</Text>
        <Switch
          isChecked={useCurveEditor}
          onChange={(e) => onUseCurveEditorChange(e.target.checked)}
          size="sm"
          colorScheme="brand"
        />
      </HStack>
      {useCurveEditor && (
        <HStack justify="space-between">
          <Text fontSize="sm" color="gray.300">Show only playing</Text>
          <Switch
            isChecked={showOnlyPlayingSnippets}
            onChange={(e) => onShowOnlyPlayingChange(e.target.checked)}
            size="sm"
            colorScheme="green"
          />
        </HStack>
      )}
      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.300">Group by</Text>
        <Button
          size="xs"
          onClick={onSegmentationModeToggle}
          colorScheme="brand"
          variant="outline"
        >
          {segmentationMode === 'facePart' ? 'Face Part' : 'Face Area'}
        </Button>
      </HStack>
    </VStack>
  </Box>
));

// AU Tab - complex, has its own state
const AUTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => {
  const { anim } = useThreeState();

  const [segmentationMode, setSegmentationMode] = useState<'facePart' | 'faceArea'>('facePart');
  const [useCurveEditor, setUseCurveEditor] = useState(false);
  const [showOnlyPlayingSnippets, setShowOnlyPlayingSnippets] = useState(false);
  const [auSnippetCurves, setAuSnippetCurves] = useState<Record<string, SnippetCurveData[]>>({});

  const showOnlyPlayingRef = useRef(showOnlyPlayingSnippets);
  showOnlyPlayingRef.current = showOnlyPlayingSnippets;

  const processAnimationSnapshot = useCallback((snapshot: any) => {
    const animations = (snapshot?.context?.animations as NormalizedSnippet[]) || [];
    const newAuCurves: Record<string, SnippetCurveData[]> = {};

    animations.forEach(snippet => {
      if (!snippet.curves) return;
      if (showOnlyPlayingRef.current && !snippet.isPlaying) return;

      const currentTime = snippet.currentTime || 0;

      Object.entries(snippet.curves).forEach(([curveId, points]) => {
        const curveIdNum = parseInt(curveId);
        const isVisemeIndex = !isNaN(curveIdNum) && curveIdNum >= 0 && curveIdNum <= 14;

        // Only process AU curves (not visemes)
        if (snippet.snippetCategory === 'visemeSnippet' || isVisemeIndex) return;
        if (!/^\d+$/.test(curveId)) return;

        const keyframes = curvePointsToKeyframes(points);
        if (!newAuCurves[curveId]) newAuCurves[curveId] = [];
        newAuCurves[curveId].push({
          snippetName: snippet.name,
          keyframes,
          snippet: { ...snippet, currentTime }
        });
      });
    });

    setAuSnippetCurves(newAuCurves);
  }, []);

  useEffect(() => {
    if (!anim?.onTransition) return;
    const unsubscribe = anim.onTransition(processAnimationSnapshot);
    return unsubscribe;
  }, [anim, processAnimationSnapshot]);

  const actionUnits = useMemo(() => Object.values(AU_INFO), []);

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

  const filteredSections = useMemo(() => {
    const sectionNames = Object.keys(auGroups).sort();
    return sectionNames.map(name => ({
      name,
      aus: auGroups[name]
    }));
  }, [auGroups]);

  const handleResetToNeutral = useCallback(() => {
    engine?.resetToNeutral();
  }, [engine]);

  const handleSegmentationModeToggle = useCallback(() => {
    setSegmentationMode(prev => prev === 'facePart' ? 'faceArea' : 'facePart');
  }, []);

  return (
    <VStack spacing={4} align="stretch">
      <AUControlsPanel
        onResetToNeutral={handleResetToNeutral}
        useCurveEditor={useCurveEditor}
        onUseCurveEditorChange={setUseCurveEditor}
        showOnlyPlayingSnippets={showOnlyPlayingSnippets}
        onShowOnlyPlayingChange={setShowOnlyPlayingSnippets}
        segmentationMode={segmentationMode}
        onSegmentationModeToggle={handleSegmentationModeToggle}
      />
      <Accordion allowMultiple>
        {filteredSections.map((sectionData) => (
          <AUSection
            key={sectionData.name}
            section={sectionData.name}
            aus={sectionData.aus}
            engine={engine}
            disabled={disabled}
            useCurveEditor={useCurveEditor}
            auSnippetCurves={auSnippetCurves}
          />
        ))}
      </Accordion>
    </VStack>
  );
});

// Visemes Tab - has its own curve state
const VisemesTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => {
  const { anim } = useThreeState();

  const [useCurveEditor, setUseCurveEditor] = useState(false);
  const [visemeSnippetCurves, setVisemeSnippetCurves] = useState<Record<string, SnippetCurveData[]>>({});

  const processAnimationSnapshot = useCallback((snapshot: any) => {
    const animations = (snapshot?.context?.animations as NormalizedSnippet[]) || [];
    const newVisemeCurves: Record<string, SnippetCurveData[]> = {};

    animations.forEach(snippet => {
      if (!snippet.curves) return;

      const currentTime = snippet.currentTime || 0;

      Object.entries(snippet.curves).forEach(([curveId, points]) => {
        const curveIdNum = parseInt(curveId);
        const isVisemeIndex = !isNaN(curveIdNum) && curveIdNum >= 0 && curveIdNum <= 14;

        // Only process viseme curves
        if (snippet.snippetCategory !== 'visemeSnippet' && !isVisemeIndex && /^\d+$/.test(curveId)) return;

        const keyframes = curvePointsToKeyframes(points);
        if (!newVisemeCurves[curveId]) newVisemeCurves[curveId] = [];
        newVisemeCurves[curveId].push({
          snippetName: snippet.name,
          keyframes,
          snippet: { ...snippet, currentTime }
        });
      });
    });

    setVisemeSnippetCurves(newVisemeCurves);
  }, []);

  useEffect(() => {
    if (!anim?.onTransition) return;
    const unsubscribe = anim.onTransition(processAnimationSnapshot);
    return unsubscribe;
  }, [anim, processAnimationSnapshot]);

  return (
    <VisemeSection
      engine={engine}
      disabled={disabled}
      useCurveEditor={useCurveEditor}
      visemeSnippetCurves={visemeSnippetCurves}
      defaultExpanded
    />
  );
});

// ============ Main Drawer Component ============

export default function SliderDrawer({
  isOpen,
  onToggle,
  disabled = false,
  hairService,
  blinkService
}: SliderDrawerProps) {
  const { engine } = useThreeState();

  const [activeTab, setActiveTab] = useState<TabId>('animation');

  // Lazy rendering - only render content after first open
  const hasBeenOpenedRef = useRef(false);
  if (isOpen && !hasBeenOpenedRef.current) {
    hasBeenOpenedRef.current = true;
  }
  const hasBeenOpened = hasBeenOpenedRef.current;

  // Stable tab click handler
  const handleTabClick = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
  }, []);

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
        motionPreset="none"
      >
        {!isOpen && !hasBeenOpened ? null : (
          <DrawerContent zIndex={9999} bg="gray.800">
            <DrawerCloseButton color="gray.400" _hover={{ color: 'gray.200', bg: 'gray.700' }} />

            <HStack align="stretch" h="100%" spacing={0}>
              <TabBar activeTab={activeTab} onTabClick={handleTabClick} />

              <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
                <DrawerBody bg="transparent" flex={1} overflowY="auto" pt={4}>
                  {activeTab === 'animation' && <AnimationTabContent />}
                  {activeTab === 'speech' && <SpeechTabContent engine={engine} disabled={disabled} />}
                  {activeTab === 'blink' && <BlinkTabContent blinkService={blinkService ?? null} disabled={disabled} />}
                  {activeTab === 'aus' && <AUTabContent engine={engine} disabled={disabled} />}
                  {activeTab === 'visemes' && <VisemesTabContent engine={engine} disabled={disabled} />}
                  {activeTab === 'tracking' && <TrackingTabContent engine={engine} disabled={disabled} />}
                  {activeTab === 'hair' && <HairTabContent hairService={hairService ?? null} disabled={disabled} />}
                  {activeTab === 'meshes' && <MeshesTabContent engine={engine} />}
                  {activeTab === 'skybox' && <SkyboxTabContent engine={engine} disabled={disabled} />}
                </DrawerBody>
              </Box>
            </HStack>
          </DrawerContent>
        )}
      </Drawer>
    </>
  );
}
