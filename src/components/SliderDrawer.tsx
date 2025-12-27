import { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import {
  Drawer,
  VStack,
  Box,
  Accordion,
  Button,
  HStack,
  Switch,
  Text,
  CloseButton,
} from '@chakra-ui/react';
import { useSelector } from '@xstate/react';
import { FaBars, FaPlay, FaSmile, FaComment, FaEye, FaCut, FaCubes, FaMicrophone, FaRegEyeSlash, FaGlobe } from 'react-icons/fa';
import { AU_INFO, AUInfo } from '../engine/arkit/shapeDict';
import AUSection from './au/AUSection';
import VisemeSection from './au/VisemeSection';
import TTSSection from './au/TTSSection';
import EyeHeadTrackingSection from './au/EyeHeadTrackingSection';
import BlinkSection from './au/BlinkSection';
import DockableAccordionItem from './au/DockableAccordionItem';
import PlaybackControls from './PlaybackControls';
import MeshPanel from './au/MeshPanel';
import SkyboxSection from './au/SkyboxSection';
import { useThreeState } from '../context/threeContext';
import type { NormalizedSnippet, CurvePoint } from '../latticework/animation/types';
import { EngineThree } from '../engine/EngineThree';

// Stable empty array reference - MUST be outside component to prevent re-renders
const EMPTY_SNIPPETS: NormalizedSnippet[] = [];

// CSS styles for tabs and tooltips - avoids React component overhead
const tabStyles = `
  .slider-drawer-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    transition: all 0.2s;
    background: transparent;
    color: #A0AEC0;
    position: relative;
  }
  .slider-drawer-tab:hover {
    background: #2D3748;
    color: white;
    transform: scale(1.1);
  }
  .slider-drawer-tab.active {
    background: var(--chakra-colors-brand-500, #3182CE);
    color: white;
  }
  .slider-drawer-tab.active:hover {
    background: var(--chakra-colors-brand-400, #4299E1);
  }
  .slider-drawer-tab::after {
    content: attr(data-tooltip);
    position: absolute;
    left: 100%;
    margin-left: 8px;
    padding: 4px 8px;
    background: #1A202C;
    color: white;
    font-size: 12px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 10000;
  }
  .slider-drawer-tab:hover::after {
    opacity: 1;
  }
  .slider-drawer-menu-btn {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 1400;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    background: var(--chakra-colors-brand-500, #3182CE);
    color: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: all 0.2s;
  }
  .slider-drawer-menu-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
  .tab-panel {
    display: none;
  }
  .tab-panel.active {
    display: block;
  }
`;

// Tab definitions
type TabId = 'animation' | 'speech' | 'blink' | 'aus' | 'visemes' | 'tracking' | 'meshes' | 'skybox';

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
  { id: 'meshes', icon: FaCubes, label: 'Meshes' },
  { id: 'skybox', icon: FaGlobe, label: 'Skybox' },
];

interface SliderDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  disabled?: boolean;
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

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = tabStyles;
  document.head.appendChild(style);
  stylesInjected = true;
}

// Icon components map - avoid recreating elements
const TAB_ICONS: Record<TabId, React.ReactNode> = {
  animation: <FaPlay />,
  speech: <FaMicrophone />,
  blink: <FaRegEyeSlash />,
  aus: <FaSmile />,
  visemes: <FaComment />,
  tracking: <FaEye />,
  meshes: <FaCubes />,
  skybox: <FaGlobe />,
};

// Pure CSS tab bar - uses event delegation to avoid per-button handlers
const TabBar = memo(({
  activeTab,
  onTabClick
}: {
  activeTab: TabId;
  onTabClick: (tab: TabId) => void;
}) => {
  // Inject styles on first render
  useEffect(() => {
    injectStyles();
  }, []);

  // Single click handler using event delegation
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const button = (e.target as HTMLElement).closest('button');
    if (button) {
      const tabId = button.getAttribute('data-tab') as TabId;
      if (tabId) onTabClick(tabId);
    }
  }, [onTabClick]);

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '16px 8px',
        background: '#171923',
        borderRight: '1px solid #2D3748',
        alignItems: 'center',
      }}
      onClick={handleClick}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          data-tab={tab.id}
          className={`slider-drawer-tab${activeTab === tab.id ? ' active' : ''}`}
          data-tooltip={tab.label}
          aria-label={tab.label}
          type="button"
        >
          {TAB_ICONS[tab.id]}
        </button>
      ))}
    </nav>
  );
});

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
const BlinkTabContent = memo(({ disabled }: { disabled: boolean }) => (
  <BlinkSection disabled={disabled} defaultExpanded />
));

// Tracking Tab
const TrackingTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => (
  <EyeHeadTrackingSection engine={engine} disabled={disabled} defaultExpanded />
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
    <VStack gap={2} align="stretch">
      <Button size="sm" onClick={onResetToNeutral} colorPalette="red" fontWeight="semibold">
        Reset to Neutral
      </Button>
      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.300">Use curve editor</Text>
        <Switch.Root
          checked={useCurveEditor}
          onCheckedChange={(details) => onUseCurveEditorChange(details.checked)}
          size="sm"
          colorPalette="brand"
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>
      {useCurveEditor && (
        <HStack justify="space-between">
          <Text fontSize="sm" color="gray.300">Show only playing</Text>
          <Switch.Root
            checked={showOnlyPlayingSnippets}
            onCheckedChange={(details) => onShowOnlyPlayingChange(details.checked)}
            size="sm"
            colorPalette="green"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </HStack>
      )}
      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.300">Group by</Text>
        <Button
          size="xs"
          onClick={onSegmentationModeToggle}
          colorPalette="brand"
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

  // Build AU curves from snippet list
  const buildAuCurves = useCallback((snippets: NormalizedSnippet[], filterPlaying: boolean) => {
    const newAuCurves: Record<string, SnippetCurveData[]> = {};

    snippets.forEach(snippet => {
      if (!snippet.curves) return;
      if (filterPlaying && !snippet.isPlaying) return;

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

    return newAuCurves;
  }, []);

  // Subscribe to animations via useSelector (efficient - only re-renders when animations change)
  const snippets = useSelector(
    anim?.actor,
    (state) => (state?.context?.animations ?? EMPTY_SNIPPETS) as NormalizedSnippet[]
  ) ?? EMPTY_SNIPPETS;

  // Build AU curves from snippets (memoized to prevent unnecessary rebuilds)
  const auSnippetCurves = useMemo(
    () => buildAuCurves(snippets, showOnlyPlayingSnippets),
    [snippets, buildAuCurves, showOnlyPlayingSnippets]
  );

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
    <VStack gap={4} align="stretch">
      <AUControlsPanel
        onResetToNeutral={handleResetToNeutral}
        useCurveEditor={useCurveEditor}
        onUseCurveEditorChange={setUseCurveEditor}
        showOnlyPlayingSnippets={showOnlyPlayingSnippets}
        onShowOnlyPlayingChange={setShowOnlyPlayingSnippets}
        segmentationMode={segmentationMode}
        onSegmentationModeToggle={handleSegmentationModeToggle}
      />
      <Accordion.Root multiple>
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
      </Accordion.Root>
    </VStack>
  );
});

// Visemes Tab - has its own curve state
const VisemesTabContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) => {
  const { anim } = useThreeState();

  const [useCurveEditor, setUseCurveEditor] = useState(false);

  const buildVisemeCurves = useCallback((snippets: NormalizedSnippet[]) => {
    const newVisemeCurves: Record<string, SnippetCurveData[]> = {};

    snippets.forEach(snippet => {
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

    return newVisemeCurves;
  }, []);

  // Subscribe to animations via useSelector (efficient - only re-renders when animations change)
  const snippets = useSelector(
    anim?.actor,
    (state) => (state?.context?.animations ?? EMPTY_SNIPPETS) as NormalizedSnippet[]
  ) ?? EMPTY_SNIPPETS;

  // Build viseme curves from snippets (memoized to prevent unnecessary rebuilds)
  const visemeSnippetCurves = useMemo(() => buildVisemeCurves(snippets), [snippets, buildVisemeCurves]);

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

// ============ Tab Content Container ============
// Manages lazy mounting of tabs and visibility via CSS

interface TabContentContainerProps {
  activeTab: TabId;
  mountedTabs: Set<TabId>;
  engine: EngineThree | null;
  disabled: boolean;
}

// Memoized content wrapper - uses CSS class for visibility (no re-render on tab switch)
const TabPanel = memo(({
  tabId,
  isActive,
  children
}: {
  tabId: TabId;
  isActive: boolean;
  children: React.ReactNode;
}) => (
  <div className={`tab-panel${isActive ? ' active' : ''}`}>
    {children}
  </div>
));

// Each tab content component is wrapped individually to prevent re-renders
const MemoizedAnimationContent = memo(() => <AnimationTabContent />);
const MemoizedSpeechContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) =>
  <SpeechTabContent engine={engine} disabled={disabled} />
);
const MemoizedBlinkContent = memo(({ disabled }: { disabled: boolean }) =>
  <BlinkTabContent disabled={disabled} />
);
const MemoizedAUContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) =>
  <AUTabContent engine={engine} disabled={disabled} />
);
const MemoizedVisemesContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) =>
  <VisemesTabContent engine={engine} disabled={disabled} />
);
const MemoizedTrackingContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) =>
  <TrackingTabContent engine={engine} disabled={disabled} />
);
const MemoizedMeshesContent = memo(({ engine }: { engine: EngineThree | null }) =>
  <MeshesTabContent engine={engine} />
);
const MemoizedSkyboxContent = memo(({ engine, disabled }: { engine: EngineThree | null; disabled: boolean }) =>
  <SkyboxTabContent engine={engine} disabled={disabled} />
);

const TabContentContainer = memo(({ activeTab, mountedTabs, engine, disabled }: TabContentContainerProps) => {
  return (
    <>
      {mountedTabs.has('animation') && (
        <TabPanel tabId="animation" isActive={activeTab === 'animation'}>
          <MemoizedAnimationContent />
        </TabPanel>
      )}
      {mountedTabs.has('speech') && (
        <TabPanel tabId="speech" isActive={activeTab === 'speech'}>
          <MemoizedSpeechContent engine={engine} disabled={disabled} />
        </TabPanel>
      )}
      {mountedTabs.has('blink') && (
        <TabPanel tabId="blink" isActive={activeTab === 'blink'}>
          <MemoizedBlinkContent disabled={disabled} />
        </TabPanel>
      )}
      {mountedTabs.has('aus') && (
        <TabPanel tabId="aus" isActive={activeTab === 'aus'}>
          <MemoizedAUContent engine={engine} disabled={disabled} />
        </TabPanel>
      )}
      {mountedTabs.has('visemes') && (
        <TabPanel tabId="visemes" isActive={activeTab === 'visemes'}>
          <MemoizedVisemesContent engine={engine} disabled={disabled} />
        </TabPanel>
      )}
      {mountedTabs.has('tracking') && (
        <TabPanel tabId="tracking" isActive={activeTab === 'tracking'}>
          <MemoizedTrackingContent engine={engine} disabled={disabled} />
        </TabPanel>
      )}
      {mountedTabs.has('meshes') && (
        <TabPanel tabId="meshes" isActive={activeTab === 'meshes'}>
          <MemoizedMeshesContent engine={engine} />
        </TabPanel>
      )}
      {mountedTabs.has('skybox') && (
        <TabPanel tabId="skybox" isActive={activeTab === 'skybox'}>
          <MemoizedSkyboxContent engine={engine} disabled={disabled} />
        </TabPanel>
      )}
    </>
  );
});

// ============ Main Drawer Component ============

export default function SliderDrawer({
  isOpen,
  onToggle,
  disabled = false,
}: SliderDrawerProps) {
  const { engine } = useThreeState();

  const [activeTab, setActiveTab] = useState<TabId>('animation');

  // Track which tabs have been mounted (for lazy loading)
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(['animation']));

  // Lazy rendering - only render content after first open
  const hasBeenOpenedRef = useRef(false);
  if (isOpen && !hasBeenOpenedRef.current) {
    hasBeenOpenedRef.current = true;
  }
  const hasBeenOpened = hasBeenOpenedRef.current;

  // Stable tab click handler that mounts new tabs lazily
  const handleTabClick = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    setMountedTabs(prev => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
  }, []);

  // Ensure styles are injected
  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <>
      <button
        className="slider-drawer-menu-btn"
        onClick={onToggle}
        aria-label="Menu"
      >
        <FaBars />
      </button>

      <Drawer.Root
        open={isOpen}
        placement="start"
        onOpenChange={(details) => { if (!details.open) onToggle(); }}
        size="md"
      >
        <Drawer.Positioner>
          {!isOpen && !hasBeenOpened ? null : (
            <Drawer.Content zIndex={9999} bg="gray.800">
              <Drawer.CloseTrigger asChild>
                <CloseButton
                  position="absolute"
                  top={2}
                  right={2}
                  color="gray.400"
                  _hover={{ color: 'gray.200', bg: 'gray.700' }}
                />
              </Drawer.CloseTrigger>

              <HStack align="stretch" h="100%" gap={0}>
                <TabBar activeTab={activeTab} onTabClick={handleTabClick} />

                <Box flex={1} display="flex" flexDirection="column" overflow="hidden">
                  <Drawer.Body bg="transparent" flex={1} overflowY="auto" pt={4}>
                    <TabContentContainer
                      activeTab={activeTab}
                      mountedTabs={mountedTabs}
                      engine={engine}
                      disabled={disabled}
                    />
                  </Drawer.Body>
                </Box>
              </HStack>
            </Drawer.Content>
          )}
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
