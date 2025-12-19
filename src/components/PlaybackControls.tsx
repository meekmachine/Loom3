import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  HStack,
  Button,
  useToast,
  IconButton,
  VStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Text,
  Switch,
  Flex,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Collapse,
  Divider,
  Input,
  Select
} from '@chakra-ui/react';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaDownload,
  FaUpload,
  FaTrashAlt,
  FaFolderOpen,
  FaChevronDown,
  FaChevronRight
} from 'react-icons/fa';
import { TimeIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useThreeState } from '../context/threeContext';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PlaybackControls - Controls for the animation service
 * Provides snippet loading, playback controls, and JSON export/import
 */
export default function PlaybackControls() {
  const { anim, engine } = useThreeState();
  const toast = useToast();
  const [enginePaused, setEnginePaused] = useState(false);

  const [jsonFilename, setJsonFilename] = useState('animation.json');
  const [snippets, setSnippets] = useState<any[]>([]);

  // Categories from localStorage
  const [emotionKeys, setEmotionKeys] = useState<string[]>([]);
  const [speakingKeys, setSpeakingKeys] = useState<string[]>([]);
  const [visemeKeys, setVisemeKeys] = useState<string[]>([]);
  const [eyeHeadTrackingKeys, setEyeHeadTrackingKeys] = useState<string[]>([]);

  // Collapse states for agency groups
  const [agencyCollapseStates, setAgencyCollapseStates] = useState<Record<string, boolean>>({
    'blink': true,
    'combined': true,
    'eyeHeadTracking': true,
    'prosodic': true,
    'default': false, // Component-loaded animations expanded by default
  });

  // Load animation categories from localStorage
  const loadCategories = () => {
    function loadCategoryList(keyName: string): string[] {
      const stored = localStorage.getItem(keyName);
      if (!stored) return [];
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [];
    }
    setEmotionKeys(loadCategoryList('emotionAnimationsList'));
    setSpeakingKeys(loadCategoryList('speakingAnimationsList'));
    setVisemeKeys(loadCategoryList('visemeAnimationsList'));
    setEyeHeadTrackingKeys(loadCategoryList('eyeHeadTrackingAnimationsList'));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Subscribe to animation service state changes
  useEffect(() => {
    if (!anim) return;

    // Get initial state
    const state = anim.getState?.();
    if (state?.context?.animations) {
      setSnippets([...state.context.animations]);
    }

    // Subscribe to changes via onTransition (fires on actual state machine changes)
    const unsub = anim.onTransition?.((st: any) => {
      if (st?.context?.animations) {
        setSnippets([...st.context.animations]);
      }
    });

    return () => {
      unsub?.();
    };
  }, [anim]);

  // Group snippets by agency (snippetCategory)
  const groupedSnippets = React.useMemo(() => {
    const groups: Record<string, any[]> = {};

    snippets.forEach(sn => {
      const category = sn.snippetCategory || 'default';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(sn);
    });

    return groups;
  }, [snippets]);

  // Tropical gradient colors that cycle through
  const tropicalColors = [
    '#FF6B9D', // Hot Pink
    '#FFA07A', // Light Salmon
    '#FFD700', // Gold
    '#7FFF00', // Chartreuse
    '#00CED1', // Dark Turquoise
    '#9370DB', // Medium Purple
    '#FF69B4', // Hot Pink
    '#FF8C00', // Dark Orange
  ];

  // Agency display names and descriptions
  const agencyInfo: Record<string, { name: string; description: string; colorIndex: number }> = {
    'blink': {
      name: 'Blink Agency',
      description: 'Automatic eye blinking',
      colorIndex: 0
    },
    'combined': {
      name: 'LipSync Agency',
      description: 'Speech lip-sync with jaw coordination',
      colorIndex: 1
    },
    'eyeHeadTracking': {
      name: 'Eye/Head Tracking Agency',
      description: 'Gaze and head movement',
      colorIndex: 2
    },
    'prosodic': {
      name: 'Prosodic Agency',
      description: 'Speech prosody (emphasis, pauses)',
      colorIndex: 3
    },
    'default': {
      name: 'Component Loaded',
      description: 'Animations loaded from UI',
      colorIndex: 4
    },
    'visemeSnippet': {
      name: 'Viseme Snippets',
      description: 'Manual viseme animations',
      colorIndex: 5
    },
    'auSnippet': {
      name: 'AU Snippets',
      description: 'Action Unit animations',
      colorIndex: 6
    }
  };

  const toggleAgencyCollapse = (category: string) => {
    setAgencyCollapseStates(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Load animation from localStorage category
  function handleLoadFromCategory(category: string, key: string) {
    const fullKey = `${category}/${key}`;

    if (!anim?.loadFromLocal) {
      toast({
        title: 'Animation service not available',
        status: 'error',
        duration: 3000
      });
      return;
    }

    try {
      const priority = category === 'visemeAnimationsList' ? -100 :
                      category === 'emotionAnimationsList' ? 10 : 5;

      console.log('[PlaybackControls] Loading animation:', key);
      console.log('[PlaybackControls] anim.playing before play():', anim.playing);

      // Ensure animation service is playing
      anim.play?.();

      console.log('[PlaybackControls] anim.playing after play():', anim.playing);

      const name = anim.loadFromLocal(fullKey, category, priority);

      if (!name) {
        toast({
          title: 'Not Found',
          description: `No animation "${key}" in ${category}`,
          status: 'error',
          duration: 3000
        });
        return;
      }

      console.log('[PlaybackControls] Loaded snippet:', name);

      // Force the snippet to playing state
      setTimeout(() => {
        const state = anim.getState?.();
        const animations = state?.context?.animations || [];
        const snippet = animations.find((a: any) => a.name === name);
        console.log('[PlaybackControls] Snippet after load:', snippet);

        anim.setSnippetPlaying?.(name, true);

        const stateAfter = anim.getState?.();
        const animationsAfter = stateAfter?.context?.animations || [];
        const snippetAfter = animationsAfter.find((a: any) => a.name === name);
        console.log('[PlaybackControls] Snippet after setPlaying:', snippetAfter);
      }, 50);

      toast({
        title: 'Loaded Animation',
        description: `${key} from ${category.replace('AnimationsList', '')}`,
        status: 'info',
        duration: 2000
      });
    } catch (err: any) {
      console.error('[PlaybackControls] Error:', err);
      toast({
        title: 'Error Loading',
        description: err.message,
        status: 'error',
        duration: 3000
      });
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

        toast({
          title: 'Loaded Animation',
          description: file.name,
          status: 'success',
          duration: 3000
        });
      } catch (err: any) {
        toast({
          title: 'Error Parsing JSON',
          description: err.message,
          status: 'error',
          duration: 4000
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Download current curves as JSON
  function handleDownloadJSON() {
    if (!anim?.getState) {
      toast({
        title: 'No animation to save',
        status: 'error',
        duration: 3000
      });
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

    toast({
      title: 'Downloaded JSON',
      description: filename,
      status: 'success',
      duration: 3000
    });
  }

  // Snippet controls
  function handlePlaySnippet(name: string) {
    anim?.setSnippetPlaying?.(name, true);
  }

  function handlePauseSnippet(name: string) {
    anim?.setSnippetPlaying?.(name, false);
  }

  function handleRemoveSnippet(name: string, snippetName: string) {
    anim?.remove?.(name);
    toast({
      title: 'Snippet removed',
      description: `"${snippetName}" removed`,
      status: 'info',
      duration: 2000
    });
  }

  function handleLoopToggle(name: string, currentLoop: boolean) {
    anim?.setSnippetLoop?.(name, !currentLoop);
  }

  // Debounce refs for all sliders to prevent glitching during drag
  const scrubTimeTimers = useRef<Map<string, number>>(new Map());
  const playbackRateTimers = useRef<Map<string, number>>(new Map());
  const intensityTimers = useRef<Map<string, number>>(new Map());

  const handleScrubTime = useCallback((name: string, val: number) => {
    // Clear existing timer for this snippet
    const existingTimer = scrubTimeTimers.current.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Use shorter debounce for scrubbing (8ms) for more responsive feedback
    const timer = setTimeout(() => {
      anim?.setSnippetTime?.(name, val);
      scrubTimeTimers.current.delete(name);
    }, 8);

    scrubTimeTimers.current.set(name, timer);
  }, [anim]);

  // Immediate update for local state, debounced update for animation service
  const handlePlaybackRate = useCallback((name: string, val: number) => {
    // Clear existing timer for this snippet
    const existingTimer = playbackRateTimers.current.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer (16ms = ~1 frame at 60fps, smooth but not overwhelming)
    const timer = setTimeout(() => {
      anim?.setSnippetPlaybackRate?.(name, val);
      playbackRateTimers.current.delete(name);
    }, 16);

    playbackRateTimers.current.set(name, timer);
  }, [anim]);

  const handleIntensityScale = useCallback((name: string, val: number) => {
    // Clear existing timer for this snippet
    const existingTimer = intensityTimers.current.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer (16ms = ~1 frame at 60fps)
    const timer = setTimeout(() => {
      anim?.setSnippetIntensityScale?.(name, val);
      intensityTimers.current.delete(name);
    }, 16);

    intensityTimers.current.set(name, timer);
  }, [anim]);

  // Mixer / blending metadata updater (stored on snippet)
  const handleMixerParams = useCallback((name: string, params: any) => {
    // TODO: Implement setSnippetMixerParams in EngineFour
    // anim?.setSnippetMixerParams?.(name, params);
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
    toast({
      title: 'All snippets cleared',
      status: 'info',
      duration: 2000
    });
  }

  return (
    <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.600" bg="gray.800">
      {/* Load animation menus */}
      <HStack spacing={2} mb={4} wrap="wrap">
        <Menu>
          <MenuButton
            as={Button}
            leftIcon={<FaFolderOpen />}
            rightIcon={<ChevronDownIcon />}
            colorScheme="purple"
            size="sm"
          >
            Emotion
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto">
            {emotionKeys.length === 0 && (
              <MenuItem isDisabled>No emotion animations</MenuItem>
            )}
            {emotionKeys.map((key) => (
              <MenuItem
                key={key}
                onClick={() => handleLoadFromCategory('emotionAnimationsList', key)}
              >
                {key}
              </MenuItem>
            ))}
          </MenuList>
        </Menu>

        <Menu>
          <MenuButton
            as={Button}
            leftIcon={<FaFolderOpen />}
            rightIcon={<ChevronDownIcon />}
            colorScheme="brand"
            size="sm"
          >
            Speaking
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto">
            {speakingKeys.length === 0 && (
              <MenuItem isDisabled>No speaking animations</MenuItem>
            )}
            {speakingKeys.map((key) => (
              <MenuItem
                key={key}
                onClick={() => handleLoadFromCategory('speakingAnimationsList', key)}
              >
                {key}
              </MenuItem>
            ))}
          </MenuList>
        </Menu>

        <Menu>
          <MenuButton
            as={Button}
            leftIcon={<FaFolderOpen />}
            rightIcon={<ChevronDownIcon />}
            colorScheme="green"
            size="sm"
          >
            Viseme
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto">
            {visemeKeys.length === 0 && (
              <MenuItem isDisabled>No viseme animations</MenuItem>
            )}
            {visemeKeys.map((key) => (
              <MenuItem
                key={key}
                onClick={() => handleLoadFromCategory('visemeAnimationsList', key)}
              >
                {key}
              </MenuItem>
            ))}
          </MenuList>
        </Menu>

        <Menu>
          <MenuButton
            as={Button}
            leftIcon={<FaFolderOpen />}
            rightIcon={<ChevronDownIcon />}
            colorScheme="blue"
            size="sm"
          >
            Eye/Head Tracking
          </MenuButton>
          <MenuList maxH="300px" overflowY="auto">
            {eyeHeadTrackingKeys.length === 0 && (
              <MenuItem isDisabled>No eye/head tracking animations</MenuItem>
            )}
            {eyeHeadTrackingKeys.map((key) => (
              <MenuItem
                key={key}
                onClick={() => handleLoadFromCategory('eyeHeadTrackingAnimationsList', key)}
              >
                {key}
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      </HStack>

      {/* Global playback controls */}
      <VStack align="stretch" spacing={2} mb={4}>
        <HStack spacing={2}>
          <Button
            size="sm"
            leftIcon={<FaPlay />}
            colorScheme="green"
            onClick={() => anim?.play?.()}
          >
            Play All
          </Button>
          <Button
            size="sm"
            leftIcon={<FaPause />}
            colorScheme="yellow"
            onClick={() => anim?.pause?.()}
          >
            Pause
          </Button>
          <Button
            size="sm"
            leftIcon={<FaStop />}
            colorScheme="red"
            onClick={() => anim?.stop?.()}
          >
            Stop
          </Button>
        </HStack>

        {/* Engine-level pause (pauses all transitions) */}
        <HStack spacing={2} p={2} bg="gray.700" borderRadius="md">
          <Text fontSize="xs" fontWeight="bold" color="gray.50">Engine Transitions:</Text>
          <Button
            size="xs"
            colorScheme={enginePaused ? 'gray' : 'brand'}
            onClick={() => {
              if (enginePaused) {
                engine?.resume?.();
                setEnginePaused(false);
              } else {
                engine?.pause?.();
                setEnginePaused(true);
              }
            }}
            leftIcon={enginePaused ? <FaPlay /> : <FaPause />}
          >
            {enginePaused ? 'Resume' : 'Pause'}
          </Button>
          <Text fontSize="xs" color="gray.300">
            ({engine?.getActiveTransitionCount?.() || 0} active)
          </Text>
        </HStack>
      </VStack>

      {/* Download / Load JSON */}
      <HStack spacing={2} mb={4}>
        <Input
          size="sm"
          width="150px"
          placeholder="animation.json"
          value={jsonFilename}
          onChange={(e) => setJsonFilename(e.target.value)}
          bg="gray.700"
          borderColor="gray.600"
          color="gray.50"
          _placeholder={{ color: 'gray.400' }}
          _hover={{ borderColor: 'gray.500' }}
          _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px rgba(23, 174, 230, 0.3)' }}
        />
        <IconButton
          aria-label="Download JSON"
          icon={<FaDownload />}
          colorScheme="purple"
          size="sm"
          onClick={handleDownloadJSON}
        />
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
            icon={<FaUpload />}
            colorScheme="orange"
            size="sm"
          />
        </label>
      </HStack>

      {/* Loaded snippets grouped by agency */}
      <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.50">
        Loaded Animations:
      </Text>
      {/* Scrollable container with fixed height - always visible */}
      <Box
        h="300px"
        overflowY="auto"
        overflowX="hidden"
        borderRadius="md"
        bg="gray.900"
        p={2}
        css={{
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'var(--chakra-colors-gray-800)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--chakra-colors-gray-600)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'var(--chakra-colors-gray-500)',
          },
        }}
      >
        {snippets.length === 0 ? (
          <Flex align="center" justify="center" h="100%">
            <Text fontSize="sm" color="gray.400">
              No animations loaded.
            </Text>
          </Flex>
        ) : (
          <VStack align="stretch" spacing={2}>
            <AnimatePresence mode="popLayout">
              {Object.entries(groupedSnippets)
                .sort(([categoryA], [categoryB]) => {
                  // Sort: component-loaded first, then agencies alphabetically
                  if (categoryA === 'default') return -1;
                  if (categoryB === 'default') return 1;
                  return categoryA.localeCompare(categoryB);
                })
                .map(([category, categorySnippets]) => {
                  const info = agencyInfo[category] || {
                    name: category,
                    description: 'Unknown category',
                    colorIndex: 7
                  };
                  const isCollapsed = agencyCollapseStates[category] ?? true;
                  const currentColor = tropicalColors[info.colorIndex % tropicalColors.length];
                  const nextColor = tropicalColors[(info.colorIndex + 1) % tropicalColors.length];

                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{
                        height: { duration: 0.3, ease: 'easeInOut' },
                        opacity: { duration: 0.2 }
                      }}
                      style={{ overflow: 'hidden' }}
                    >
                      <Box>
                        {/* Agency Header */}
                        <motion.div
                          animate={{
                            background: isCollapsed
                              ? currentColor
                              : `linear-gradient(135deg, ${currentColor} 0%, ${nextColor} 100%)`
                          }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                          style={{ borderRadius: '6px' }}
                        >
                          <HStack
                            p={2}
                            cursor="pointer"
                            onClick={() => toggleAgencyCollapse(category)}
                            _hover={{ opacity: 0.9 }}
                            transition="opacity 0.2s"
                          >
                            <IconButton
                              size="xs"
                              variant="ghost"
                              icon={isCollapsed ? <FaChevronRight /> : <FaChevronDown />}
                              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                              color="white"
                              _hover={{ bg: 'whiteAlpha.200' }}
                            />
                            <VStack align="start" spacing={0} flex={1}>
                              <Text fontSize="sm" fontWeight="bold" color="white" textShadow="0 1px 2px rgba(0,0,0,0.3)">
                                {info.name}
                              </Text>
                              <Text fontSize="xs" color="whiteAlpha.900">
                                {info.description} ({categorySnippets.length} animation{categorySnippets.length !== 1 ? 's' : ''})
                              </Text>
                            </VStack>
                          </HStack>
                        </motion.div>

                        {/* Snippets in this category */}
                        <Collapse in={!isCollapsed} animateOpacity>
                          <VStack align="stretch" spacing={2} mt={2} ml={4}>
                            <AnimatePresence mode="popLayout">
                              {categorySnippets.map((sn) => (
                                <motion.div
                                  key={sn.name}
                                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                  animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                  transition={{
                                    height: { duration: 0.3, ease: 'easeInOut' },
                                    opacity: { duration: 0.2 },
                                    marginBottom: { duration: 0.3 }
                                  }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <Box
                                    p={2}
                                    bg="gray.750"
                                    borderWidth="1px"
                                    borderColor="gray.600"
                                    borderRadius="md"
                                    boxShadow="sm"
                                  >
                                    <Flex align="center" justify="space-between">
                                      <Text fontWeight="semibold" fontSize="sm" color="brand.400">
                                        {sn.name}
                                        {sn.isPlaying ? ' (Playing)' : ' (Stopped)'}
                                      </Text>
                                      <HStack spacing={1}>
                                        <IconButton
                                          size="xs"
                                          colorScheme="green"
                                          icon={<FaPlay />}
                                          aria-label="Play"
                                          onClick={() => handlePlaySnippet(sn.name)}
                                          isDisabled={sn.isPlaying}
                                        />
                                        <IconButton
                                          size="xs"
                                          colorScheme="yellow"
                                          icon={<FaPause />}
                                          aria-label="Pause"
                                          onClick={() => handlePauseSnippet(sn.name)}
                                        />
                                        <IconButton
                                          size="xs"
                                          colorScheme="gray"
                                          icon={<FaTrashAlt />}
                                          aria-label="Remove"
                                          onClick={() => handleRemoveSnippet(sn.name, sn.name)}
                                        />
                                      </HStack>
                                    </Flex>

                                    <HStack spacing={2} mt={2} alignItems="center">
                                      <Text fontSize="xs" color="gray.300">Loop:</Text>
                                      <Switch
                                        size="sm"
                                        colorScheme="brand"
                                        isChecked={sn.loop}
                                        onChange={() => handleLoopToggle(sn.name, sn.loop)}
                                      />
                                    </HStack>

                                    <Text fontSize="xs" mt={1} color="gray.300">
                                      Time: {sn.currentTime?.toFixed(2) || 0} / {(sn.duration || 0).toFixed(2)} s
                                    </Text>
                                    <Slider
                                      aria-label="time"
                                      colorScheme="brand"
                                      min={0}
                                      max={sn.duration || 1}
                                      step={0.01}
                                      value={sn.currentTime || 0}
                                      onChange={(val) => handleScrubTime(sn.name, val)}
                                      mb={2}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3}>
                                        <TimeIcon boxSize={2} />
                                      </SliderThumb>
                                    </Slider>

                                    <Text fontSize="xs" color="gray.300">
                                      Playback Rate: {sn.snippetPlaybackRate?.toFixed(2) || 1}x
                                    </Text>
                                    <Slider
                                      colorScheme="pink"
                                      min={0.1}
                                      max={3.0}
                                      step={0.1}
                                      value={sn.snippetPlaybackRate || 1}
                                      onChange={(val) => handlePlaybackRate(sn.name, val)}
                                      mb={2}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3} />
                                    </Slider>

                                    <Text fontSize="xs" color="gray.300">
                                      Intensity Scale: {sn.snippetIntensityScale?.toFixed(1) || 1}
                                    </Text>
                                    <Slider
                                      colorScheme="orange"
                                      min={0}
                                      max={2}
                                      step={0.1}
                                      value={sn.snippetIntensityScale || 1}
                                      onChange={(val) => handleIntensityScale(sn.name, val)}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3} />
                                    </Slider>

                                    <Divider my={2} />

                                    <HStack spacing={2} mb={2}>
                                      <Box flex="1">
                                        <Text fontSize="xs" color="gray.300">Blend Mode</Text>
                                        <Select
                                          size="sm"
                                          value={sn.snippetBlendMode || 'replace'}
                                          onChange={(e) => { /* TODO: anim?.setSnippetBlendMode?.(sn.name, e.target.value) */ }}
                                        >
                                          <option value="replace">Replace</option>
                                          <option value="additive">Additive</option>
                                        </Select>
                                      </Box>
                                      <Box flex="1">
                                        <Text fontSize="xs" color="gray.300">Channel</Text>
                                        <Input
                                          size="sm"
                                          placeholder="head / face / eyes"
                                          value={sn.mixerChannel || ''}
                                          onChange={(e) => handleMixerParams(sn.name, { mixerChannel: e.target.value || undefined })}
                                        />
                                      </Box>
                                    </HStack>

                                    <HStack spacing={2} mb={2}>
                                      <Box flex="1">
                                        <Text fontSize="xs" color="gray.300">Mixer Blend</Text>
                                        <Select
                                          size="sm"
                                          value={sn.mixerBlendMode || 'replace'}
                                          onChange={(e) => handleMixerParams(sn.name, { mixerBlendMode: e.target.value })}
                                        >
                                          <option value="replace">Replace</option>
                                          <option value="crossfade">Crossfade</option>
                                          <option value="fade">Fade</option>
                                          <option value="additive">Additive</option>
                                          <option value="warp">Warp</option>
                                        </Select>
                                      </Box>
                                      <Box flex="1">
                                        <Text fontSize="xs" color="gray.300">Loop Mode</Text>
                                        <Select
                                          size="sm"
                                          value={sn.mixerLoopMode || 'repeat'}
                                          onChange={(e) => handleMixerParams(sn.name, { mixerLoopMode: e.target.value })}
                                        >
                                          <option value="repeat">Repeat</option>
                                          <option value="once">Once</option>
                                          <option value="pingpong">PingPong</option>
                                        </Select>
                                      </Box>
                                    </HStack>

                                    <Text fontSize="xs" color="gray.300">
                                      Mixer Weight: {(sn.mixerWeight ?? 1).toFixed(2)}
                                    </Text>
                                    <Slider
                                      colorScheme="green"
                                      min={0}
                                      max={2}
                                      step={0.05}
                                      value={sn.mixerWeight ?? 1}
                                      onChange={(val) => handleMixerParams(sn.name, { mixerWeight: val })}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3} />
                                    </Slider>

                                    <Text fontSize="xs" color="gray.300" mt={1}>
                                      Fade (ms): {Math.round(sn.mixerFadeDurationMs ?? 300)}
                                    </Text>
                                    <Slider
                                      colorScheme="yellow"
                                      min={0}
                                      max={2000}
                                      step={50}
                                      value={sn.mixerFadeDurationMs ?? 300}
                                      onChange={(val) => handleMixerParams(sn.name, { mixerFadeDurationMs: val })}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3} />
                                    </Slider>

                                    <Text fontSize="xs" color="gray.300" mt={1}>
                                      Warp (ms): {Math.round(sn.mixerWarpDurationMs ?? 0)}
                                    </Text>
                                    <Slider
                                      colorScheme="teal"
                                      min={0}
                                      max={2000}
                                      step={50}
                                      value={sn.mixerWarpDurationMs ?? 0}
                                      onChange={(val) => handleMixerParams(sn.name, { mixerWarpDurationMs: val })}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3} />
                                    </Slider>

                                    <Text fontSize="xs" color="gray.300" mt={1}>
                                      Mixer Time Scale: {(sn.mixerTimeScale ?? 1).toFixed(2)}x
                                    </Text>
                                    <Slider
                                      colorScheme="cyan"
                                      min={0}
                                      max={3}
                                      step={0.1}
                                      value={sn.mixerTimeScale ?? 1}
                                      onChange={(val) => handleMixerParams(sn.name, { mixerTimeScale: val })}
                                      size="sm"
                                    >
                                      <SliderTrack>
                                        <SliderFilledTrack />
                                      </SliderTrack>
                                      <SliderThumb boxSize={3} />
                                    </Slider>

                                    <HStack spacing={4} mt={2} alignItems="center">
                                      <HStack>
                                        <Text fontSize="xs" color="gray.300">Additive</Text>
                                        <Switch
                                          size="sm"
                                          isChecked={!!sn.mixerAdditive}
                                          onChange={(e) => handleMixerParams(sn.name, { mixerAdditive: e.target.checked })}
                                        />
                                      </HStack>
                                      <HStack>
                                        <Text fontSize="xs" color="gray.300">Clamp</Text>
                                        <Switch
                                          size="sm"
                                          isChecked={!!sn.mixerClampWhenFinished}
                                          onChange={(e) => handleMixerParams(sn.name, { mixerClampWhenFinished: e.target.checked })}
                                        />
                                      </HStack>
                                    </HStack>
                                  </Box>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </VStack>
                        </Collapse>
                      </Box>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </VStack>
        )}
      </Box>
      {snippets.length > 0 && (
        <HStack justify="flex-end" mt={3}>
          <Button
            size="sm"
            colorScheme="red"
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        </HStack>
      )}
    </Box>
  );
}
