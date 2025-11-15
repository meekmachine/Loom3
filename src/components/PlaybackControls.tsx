import React, { useEffect, useState } from 'react';
import {
  Box,
  HStack,
  Button,
  useToast,
  Input,
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
  MenuItem
} from '@chakra-ui/react';
import {
  FaPlay,
  FaPause,
  FaStop,
  FaDownload,
  FaUpload,
  FaTrashAlt,
  FaFolderOpen
} from 'react-icons/fa';
import { TimeIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useThreeState } from '../context/threeContext';

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
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Subscribe to animation service state changes
  useEffect(() => {
    if (!anim) return;

    // Get initial state
    const updateSnippets = () => {
      const state = anim.getState?.();
      if (state?.context?.animations) {
        setSnippets([...state.context.animations]);
      }
    };

    updateSnippets();

    // Subscribe to changes (if available)
    const unsub = anim.onTransition?.((st: any) => {
      if (st?.context?.animations) {
        setSnippets([...st.context.animations]);
      }
    });

    // Also poll periodically to catch any missed updates
    const interval = setInterval(updateSnippets, 100);

    return () => {
      unsub?.();
      clearInterval(interval);
    };
  }, [anim]);

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
  function handlePlaySnippet(idx: number) {
    const sn = snippets[idx];
    anim?.setSnippetPlaying?.(sn.name, true);
  }

  function handlePauseSnippet(idx: number) {
    const sn = snippets[idx];
    anim?.setSnippetPlaying?.(sn.name, false);
  }

  function handleRemoveSnippet(idx: number) {
    const sn = snippets[idx];
    anim?.remove?.(sn.name);
    toast({
      title: 'Snippet removed',
      description: `"${sn.name}" removed`,
      status: 'info',
      duration: 2000
    });
  }

  function handleLoopToggle(idx: number) {
    const sn = snippets[idx];
    anim?.setSnippetLoop?.(sn.name, !sn.loop);
  }

  function handleScrubTime(idx: number, val: number) {
    const sn = snippets[idx];
    anim?.setSnippetTime?.(sn.name, val);
  }

  function handlePlaybackRate(idx: number, val: number) {
    const sn = snippets[idx];
    anim?.setSnippetPlaybackRate?.(sn.name, val);
  }

  function handleIntensityScale(idx: number, val: number) {
    const sn = snippets[idx];
    anim?.setSnippetIntensityScale?.(sn.name, val);
  }

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

      {/* Loaded snippets */}
      <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.50">
        Loaded Animations:
      </Text>
      {snippets.length === 0 ? (
        <Text fontSize="sm" color="gray.400">
          No animations loaded.
        </Text>
      ) : (
        <>
          <VStack align="stretch" spacing={3}>
            {snippets.map((sn, idx) => (
              <Box
                key={sn.name || idx}
                p={2}
                bg="gray.750"
                borderWidth="1px"
                borderColor="gray.600"
                borderRadius="md"
                boxShadow="sm"
              >
                <Flex align="center" justify="space-between">
                  <Text fontWeight="semibold" fontSize="sm" color="brand.400">
                    {sn.name || `Snippet ${idx}`}
                    {sn.isPlaying ? ' (Playing)' : ' (Stopped)'}
                  </Text>
                  <HStack spacing={1}>
                    <IconButton
                      size="xs"
                      colorScheme="green"
                      icon={<FaPlay />}
                      aria-label="Play"
                      onClick={() => handlePlaySnippet(idx)}
                      isDisabled={sn.isPlaying}
                    />
                    <IconButton
                      size="xs"
                      colorScheme="yellow"
                      icon={<FaPause />}
                      aria-label="Pause"
                      onClick={() => handlePauseSnippet(idx)}
                    />
                    <IconButton
                      size="xs"
                      colorScheme="gray"
                      icon={<FaTrashAlt />}
                      aria-label="Remove"
                      onClick={() => handleRemoveSnippet(idx)}
                    />
                  </HStack>
                </Flex>

                <HStack spacing={2} mt={2} alignItems="center">
                  <Text fontSize="xs" color="gray.300">Loop:</Text>
                  <Switch
                    size="sm"
                    colorScheme="brand"
                    isChecked={sn.loop}
                    onChange={() => handleLoopToggle(idx)}
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
                  onChange={(val) => handleScrubTime(idx, val)}
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
                  onChange={(val) => handlePlaybackRate(idx, val)}
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
                  onChange={(val) => handleIntensityScale(idx, val)}
                  size="sm"
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb boxSize={3} />
                </Slider>
              </Box>
            ))}
          </VStack>
          <HStack justify="flex-end" mt={3}>
            <Button
              size="sm"
              colorScheme="red"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          </HStack>
        </>
      )}
    </Box>
  );
}
