import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  Box,
  HStack,
  Button,
  IconButton,
  VStack,
  Text,
  Flex,
  Menu,
  Portal,
  Input,
  Collapsible,
} from '@chakra-ui/react';
import { toaster } from './ui/toaster';
import SnippetCard from './SnippetCard';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaDownload,
  FaUpload,
  FaFolderOpen,
  FaChevronDown,
  FaChevronRight
} from 'react-icons/fa';
import { ChevronDown } from 'lucide-react';
import { useThreeState } from '../context/threeContext';
import { useSnippets } from '../hooks/useAnimationStream';

// Agency info type
interface AgencyInfo {
  name: string;
  description: string;
  colorIndex: number;
}

// Props for the memoized AgencyGroup component
interface AgencyGroupProps {
  category: string;
  snippetNames: string[];
  snippetCount: number;
  info: AgencyInfo;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentColor: string;
  nextColor: string;
  // Callbacks for snippet controls
  onPlay: (name: string) => void;
  onPause: (name: string) => void;
  onRemove: (name: string) => void;
  onLoopToggle: (name: string, currentLoop: boolean) => void;
  onScrubTime: (name: string, val: number) => void;
  onPlaybackRate: (name: string, val: number) => void;
  onIntensityScale: (name: string, val: number) => void;
}

// Memoized agency group - only rerenders when its specific category's snippets change
const AgencyGroup = memo(function AgencyGroup({
  category,
  snippetNames,
  snippetCount,
  info,
  isCollapsed,
  onToggleCollapse,
  currentColor,
  nextColor,
  onPlay,
  onPause,
  onRemove,
  onLoopToggle,
  onScrubTime,
  onPlaybackRate,
  onIntensityScale,
}: AgencyGroupProps) {
  return (
    <Box>
      {/* Agency Header */}
      <Box
        bg={isCollapsed
          ? currentColor
          : `linear-gradient(135deg, ${currentColor} 0%, ${nextColor} 100%)`}
        borderRadius="6px"
        transition="background 0.3s ease-in-out"
      >
        <HStack
          p={2}
          cursor="pointer"
          onClick={onToggleCollapse}
          _hover={{ opacity: 0.9 }}
          transition="opacity 0.2s"
        >
          <IconButton
            size="xs"
            variant="ghost"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            color="white"
            _hover={{ bg: 'whiteAlpha.200' }}
          >
            {isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
          </IconButton>
          <VStack align="start" gap={0} flex={1}>
            <Text fontSize="sm" fontWeight="bold" color="white" textShadow="0 1px 2px rgba(0,0,0,0.3)">
              {info.name}
            </Text>
            <Text fontSize="xs" color="whiteAlpha.900">
              {info.description} ({snippetCount} animation{snippetCount !== 1 ? 's' : ''})
            </Text>
          </VStack>
        </HStack>
      </Box>

      {/* Snippets in this category */}
      <Collapsible.Root open={!isCollapsed}>
        <Collapsible.Content>
          <VStack align="stretch" gap={2} mt={2} ml={4}>
            {snippetNames.map((name, idx) => (
              <SnippetCard
                key={`${name}-${idx}`}
                snippetName={name}
                onPlay={onPlay}
                onPause={onPause}
                onRemove={onRemove}
                onLoopToggle={onLoopToggle}
                onScrubTime={onScrubTime}
                onPlaybackRate={onPlaybackRate}
                onIntensityScale={onIntensityScale}
              />
            ))}
          </VStack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}, (prev, next) => {
  // Custom comparison - only rerender if relevant props changed
  return (
    prev.category === next.category &&
    prev.isCollapsed === next.isCollapsed &&
    prev.snippetNames === next.snippetNames && // Reference equality
    prev.snippetCount === next.snippetCount &&
    prev.info === next.info &&
    prev.currentColor === next.currentColor &&
    prev.nextColor === next.nextColor
    // Callbacks are memoized with useCallback, so reference equality works
  );
});

// Static constants - defined outside component to avoid recreation
const TROPICAL_COLORS = [
  '#FF6B9D', // Hot Pink
  '#FFA07A', // Light Salmon
  '#FFD700', // Gold
  '#7FFF00', // Chartreuse
  '#00CED1', // Dark Turquoise
  '#9370DB', // Medium Purple
  '#FF69B4', // Hot Pink
  '#FF8C00', // Dark Orange
];

const AGENCY_INFO: Record<string, AgencyInfo> = {
  'blink': { name: 'Blink Agency', description: 'Automatic eye blinking', colorIndex: 0 },
  'combined': { name: 'LipSync Agency', description: 'Speech lip-sync with jaw coordination', colorIndex: 1 },
  'eyeHeadTracking': { name: 'Eye/Head Tracking Agency', description: 'Gaze and head movement', colorIndex: 2 },
  'prosodic': { name: 'Prosodic Agency', description: 'Speech prosody (emphasis, pauses)', colorIndex: 3 },
  'default': { name: 'Component Loaded', description: 'Animations loaded from UI', colorIndex: 4 },
  'visemeSnippet': { name: 'Viseme Snippets', description: 'Manual viseme animations', colorIndex: 5 },
  'auSnippet': { name: 'AU Snippets', description: 'Action Unit animations', colorIndex: 6 },
};

const DEFAULT_AGENCY_INFO: AgencyInfo = { name: 'Unknown', description: 'Unknown category', colorIndex: 7 };

/**
 * PlaybackControls - Controls for the animation service
 * Provides snippet loading, playback controls, and JSON export/import
 */
function PlaybackControls() {
  const { anim, engine } = useThreeState();
  const [enginePaused, setEnginePaused] = useState(false);

  const [jsonFilename, setJsonFilename] = useState('animation.json');

  // Use RxJS hook for efficient state subscriptions
  // Only re-renders when meaningful events occur (not on every tick)
  const snippets = useSnippets();

  // Collapse states for agency groups
  const [agencyCollapseStates, setAgencyCollapseStates] = useState<Record<string, boolean>>({
    'blink': true,
    'combined': true,
    'eyeHeadTracking': true,
    'prosodic': true,
    'default': false, // Component-loaded animations expanded by default
  });

  // Load animation categories from localStorage - computed once on mount
  const [categoryKeys] = useState<{
    emotion: string[];
    speaking: string[];
    viseme: string[];
    eyeHeadTracking: string[];
  }>(() => {
    function loadCategoryList(keyName: string): string[] {
      const stored = localStorage.getItem(keyName);
      if (!stored) return [];
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [];
    }
    return {
      emotion: loadCategoryList('emotionAnimationsList'),
      speaking: loadCategoryList('speakingAnimationsList'),
      viseme: loadCategoryList('visemeAnimationsList'),
      eyeHeadTracking: loadCategoryList('eyeHeadTrackingAnimationsList'),
    };
  });

  const { emotion: emotionKeys, speaking: speakingKeys, viseme: visemeKeys, eyeHeadTracking: eyeHeadTrackingKeys } = categoryKeys;

  // Group snippets by category - uses snippets for real-time updates
  const groupedSnippets = React.useMemo(() => {
    const groups: Record<string, string[]> = {};
    snippets.forEach(sn => {
      const cat = sn.category || 'default';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(sn.name);
    });
    return groups;
  }, [snippets]);

  // Memoized toggle handlers per category to prevent AgencyGroup rerenders
  const toggleHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {};
    const categories = ['blink', 'combined', 'eyeHeadTracking', 'prosodic', 'default', 'visemeSnippet', 'auSnippet'];
    categories.forEach(cat => {
      handlers[cat] = () => setAgencyCollapseStates(prev => ({ ...prev, [cat]: !prev[cat] }));
    });
    return handlers;
  }, []);

  // Load animation from localStorage category
  function handleLoadFromCategory(category: string, key: string) {
    const fullKey = `${category}/${key}`;

    if (!anim?.loadFromLocal) {
      toaster.error({ title: 'Animation service not available' });
      return;
    }

    try {
      const priority = category === 'visemeAnimationsList' ? -100 :
                      category === 'emotionAnimationsList' ? 10 : 5;

      anim.play?.();
      const name = anim.loadFromLocal(fullKey, category, priority);

      if (!name) {
        toaster.error({ title: 'Not Found', description: `No animation "${key}" in ${category}` });
        return;
      }

      setTimeout(() => {
        anim.setSnippetPlaying?.(name, true);
      }, 50);

      toaster.success({ title: 'Loaded Animation', description: `${key} from ${category.replace('AnimationsList', '')}` });
    } catch (err: any) {
      toaster.error({ title: 'Error Loading', description: err.message });
    }
  }

  // Load animation from JSON file
  function handleLoadFromFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const base = file.name.replace(/\.\w+$/, '');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        parsed.name = parsed.name || base;
        anim?.schedule?.(parsed, { priority: 0 });
        toaster.success({ title: 'Loaded Animation', description: file.name });
      } catch (err: any) {
        toaster.error({ title: 'Error Parsing JSON', description: err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Download current curves as JSON
  function handleDownloadJSON() {
    if (!anim?.getState) {
      toaster.error({ title: 'No animation to save' });
      return;
    }

    const state = anim.getState();
    const animations = state?.context?.animations || [];
    const data = { snippets: animations };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = jsonFilename.endsWith('.json')
      ? jsonFilename
      : `${jsonFilename}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toaster.success({ title: 'Downloaded JSON', description: filename });
  }

  // Snippet controls - memoized to prevent SnippetCard rerenders
  const handlePlaySnippet = useCallback((name: string) => {
    anim?.setSnippetPlaying?.(name, true);
  }, [anim]);

  const handlePauseSnippet = useCallback((name: string) => {
    anim?.setSnippetPlaying?.(name, false);
  }, [anim]);

  const handleRemoveSnippet = useCallback((name: string) => {
    anim?.remove?.(name);
    toaster.info({ title: 'Snippet removed', description: `"${name}" removed` });
  }, [anim]);

  const handleLoopToggle = useCallback((name: string, currentLoop: boolean) => {
    anim?.setSnippetLoop?.(name, !currentLoop);
  }, [anim]);

  // Debounce refs for all sliders
  const scrubTimeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const playbackRateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const intensityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleScrubTime = useCallback((name: string, val: number) => {
    const existingTimer = scrubTimeTimers.current.get(name);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      anim?.setSnippetTime?.(name, val);
      scrubTimeTimers.current.delete(name);
    }, 8);

    scrubTimeTimers.current.set(name, timer);
  }, [anim]);

  const handlePlaybackRate = useCallback((name: string, val: number) => {
    const existingTimer = playbackRateTimers.current.get(name);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      anim?.setSnippetPlaybackRate?.(name, val);
      playbackRateTimers.current.delete(name);
    }, 16);

    playbackRateTimers.current.set(name, timer);
  }, [anim]);

  const handleIntensityScale = useCallback((name: string, val: number) => {
    const existingTimer = intensityTimers.current.get(name);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      anim?.setSnippetIntensityScale?.(name, val);
      intensityTimers.current.delete(name);
    }, 16);

    intensityTimers.current.set(name, timer);
  }, [anim]);


  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      scrubTimeTimers.current.forEach(timer => clearTimeout(timer));
      playbackRateTimers.current.forEach(timer => clearTimeout(timer));
      intensityTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  function handleClearAll() {
    snippets.forEach(sn => {
      anim?.remove?.(sn.name);
    });
    toaster.info({ title: 'All snippets cleared' });
  }

  return (
    <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.600" bg="gray.800">
      {/* Load animation menus */}
      <HStack gap={2} mb={4} flexWrap="wrap">
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button colorPalette="purple" size="sm">
              <FaFolderOpen /> Emotion <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxH="300px" overflowY="auto">
                {emotionKeys.length === 0 && (
                  <Menu.Item value="none" disabled>No emotion animations</Menu.Item>
                )}
                {emotionKeys.map((key) => (
                  <Menu.Item
                    key={key}
                    value={key}
                    onClick={() => handleLoadFromCategory('emotionAnimationsList', key)}
                  >
                    {key}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger asChild>
            <Button colorPalette="cyan" size="sm">
              <FaFolderOpen /> Speaking <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxH="300px" overflowY="auto">
                {speakingKeys.length === 0 && (
                  <Menu.Item value="none" disabled>No speaking animations</Menu.Item>
                )}
                {speakingKeys.map((key) => (
                  <Menu.Item
                    key={key}
                    value={key}
                    onClick={() => handleLoadFromCategory('speakingAnimationsList', key)}
                  >
                    {key}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger asChild>
            <Button colorPalette="green" size="sm">
              <FaFolderOpen /> Viseme <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxH="300px" overflowY="auto">
                {visemeKeys.length === 0 && (
                  <Menu.Item value="none" disabled>No viseme animations</Menu.Item>
                )}
                {visemeKeys.map((key) => (
                  <Menu.Item
                    key={key}
                    value={key}
                    onClick={() => handleLoadFromCategory('visemeAnimationsList', key)}
                  >
                    {key}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger asChild>
            <Button colorPalette="blue" size="sm">
              <FaFolderOpen /> Eye/Head <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxH="300px" overflowY="auto">
                {eyeHeadTrackingKeys.length === 0 && (
                  <Menu.Item value="none" disabled>No eye/head tracking animations</Menu.Item>
                )}
                {eyeHeadTrackingKeys.map((key) => (
                  <Menu.Item
                    key={key}
                    value={key}
                    onClick={() => handleLoadFromCategory('eyeHeadTrackingAnimationsList', key)}
                  >
                    {key}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      {/* Global playback controls */}
      <VStack align="stretch" gap={2} mb={4}>
        <HStack gap={2}>
          <Button size="sm" colorPalette="green" onClick={() => anim?.play?.()}>
            <FaPlay /> Play All
          </Button>
          <Button size="sm" colorPalette="yellow" onClick={() => anim?.pause?.()}>
            <FaPause /> Pause
          </Button>
          <Button size="sm" colorPalette="red" onClick={() => anim?.stop?.()}>
            <FaStop /> Stop
          </Button>
        </HStack>

        {/* Engine-level pause */}
        <HStack gap={2} p={2} bg="gray.700" borderRadius="md">
          <Text fontSize="xs" fontWeight="bold" color="gray.50">Engine Transitions:</Text>
          <Button
            size="xs"
            colorPalette={enginePaused ? 'gray' : 'cyan'}
            onClick={() => {
              if (enginePaused) {
                engine?.resume?.();
                setEnginePaused(false);
              } else {
                engine?.pause?.();
                setEnginePaused(true);
              }
            }}
          >
            {enginePaused ? <FaPlay /> : <FaPause />}
            {enginePaused ? 'Resume' : 'Pause'}
          </Button>
          <Text fontSize="xs" color="white">
            ({engine?.getActiveTransitionCount?.() || 0} active)
          </Text>
        </HStack>
      </VStack>

      {/* Download / Load JSON */}
      <HStack gap={2} mb={4}>
        <Input
          size="sm"
          width="150px"
          placeholder="animation.json"
          value={jsonFilename}
          onChange={(e) => setJsonFilename(e.target.value)}
          bg="gray.700"
          borderColor="gray.600"
          color="gray.50"
        />
        <IconButton
          aria-label="Download JSON"
          colorPalette="purple"
          size="sm"
          onClick={handleDownloadJSON}
        >
          <FaDownload />
        </IconButton>
        <input
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          id="json-file-input"
          onChange={handleLoadFromFile}
        />
        <label htmlFor="json-file-input">
          <IconButton
            as="span"
            aria-label="Load from JSON"
            colorPalette="orange"
            size="sm"
          >
            <FaUpload />
          </IconButton>
        </label>
      </HStack>

      {/* Loaded snippets grouped by agency */}
      <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.50">
        Loaded Animations:
      </Text>
      <Box
        h="300px"
        overflowY="auto"
        overflowX="hidden"
        borderRadius="md"
        bg="gray.900"
        p={2}
      >
        {snippets.length === 0 ? (
          <Flex align="center" justify="center" h="100%">
            <Text fontSize="sm" color="white">
              No animations loaded.
            </Text>
          </Flex>
        ) : (
          <VStack align="stretch" gap={2}>
            {Object.entries(groupedSnippets)
              .sort(([categoryA], [categoryB]) => {
                if (categoryA === 'default') return -1;
                if (categoryB === 'default') return 1;
                return categoryA.localeCompare(categoryB);
              })
              .map(([category, snippetNames]) => {
                const info = AGENCY_INFO[category] || DEFAULT_AGENCY_INFO;
                const isCollapsed = agencyCollapseStates[category] ?? true;
                const currentColor = TROPICAL_COLORS[info.colorIndex % TROPICAL_COLORS.length];
                const nextColor = TROPICAL_COLORS[(info.colorIndex + 1) % TROPICAL_COLORS.length];

                return (
                  <AgencyGroup
                    key={category}
                    category={category}
                    snippetNames={snippetNames}
                    snippetCount={snippetNames.length}
                    info={info}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleHandlers[category] || (() => {})}
                    currentColor={currentColor}
                    nextColor={nextColor}
                    onPlay={handlePlaySnippet}
                    onPause={handlePauseSnippet}
                    onRemove={handleRemoveSnippet}
                    onLoopToggle={handleLoopToggle}
                    onScrubTime={handleScrubTime}
                    onPlaybackRate={handlePlaybackRate}
                    onIntensityScale={handleIntensityScale}
                  />
                );
              })}
          </VStack>
        )}
      </Box>
      {snippets.length > 0 && (
        <HStack justify="flex-end" mt={3}>
          <Button size="sm" colorPalette="red" onClick={handleClearAll}>
            Clear All
          </Button>
        </HStack>
      )}
    </Box>
  );
}

// Memoize to prevent re-renders when parent state changes
export default memo(PlaybackControls);
