import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  HStack,
  IconButton,
  Slider,
  Text,
  Switch,
  Flex,
} from '@chakra-ui/react';
import { FaPlay, FaPause, FaTrashAlt, FaClock } from 'react-icons/fa';
import { useSnippetState } from '../hooks/useAnimationStream';

interface SnippetCardProps {
  snippetName: string;
  onPlay: (name: string) => void;
  onPause: (name: string) => void;
  onRemove: (name: string) => void;
  onLoopToggle: (name: string, currentLoop: boolean) => void;
  onScrubTime: (name: string, val: number) => void;
  onPlaybackRate: (name: string, val: number) => void;
  onIntensityScale: (name: string, val: number) => void;
}

/**
 * SnippetCard - Component for rendering a single animation snippet
 *
 * Uses RxJS subscription via useSnippetState hook for efficient updates.
 * Only re-renders when meaningful state changes occur (not on every tick).
 */
function SnippetCard({
  snippetName,
  onPlay,
  onPause,
  onRemove,
  onLoopToggle,
  onScrubTime,
  onPlaybackRate,
  onIntensityScale,
}: SnippetCardProps) {
  // Subscribe to snippet state via RxJS (replaces prop-based updates)
  const snippet = useSnippetState(snippetName);

  // Local state for sliders to avoid triggering parent rerenders during drag
  const [localTime, setLocalTime] = useState(snippet?.currentTime ?? 0);
  const [localRate, setLocalRate] = useState(snippet?.playbackRate ?? 1);
  const [localIntensity, setLocalIntensity] = useState(snippet?.intensityScale ?? 1);

  // Debounce refs
  const timeTimerRef = useRef<number | null>(null);
  const rateTimerRef = useRef<number | null>(null);
  const intensityTimerRef = useRef<number | null>(null);

  // Track if user is dragging time slider
  const isDraggingTime = useRef(false);

  // Sync local time with RxJS updates when not dragging
  useEffect(() => {
    if (!isDraggingTime.current && snippet) {
      const diff = Math.abs(snippet.currentTime - localTime);
      if (diff > 0.05) {
        setLocalTime(snippet.currentTime);
      }
    }
  }, [snippet?.currentTime, localTime]);

  // Sync rate with RxJS updates
  useEffect(() => {
    if (snippet && Math.abs(snippet.playbackRate - localRate) > 0.01) {
      setLocalRate(snippet.playbackRate);
    }
  }, [snippet?.playbackRate, localRate]);

  // Sync intensity with RxJS updates
  useEffect(() => {
    if (snippet && Math.abs(snippet.intensityScale - localIntensity) > 0.01) {
      setLocalIntensity(snippet.intensityScale);
    }
  }, [snippet?.intensityScale, localIntensity]);

  const handleTimeChange = useCallback((details: { value: number[] }) => {
    const val = details.value[0];
    isDraggingTime.current = true;
    setLocalTime(val);

    if (timeTimerRef.current) clearTimeout(timeTimerRef.current);
    timeTimerRef.current = window.setTimeout(() => {
      onScrubTime(snippetName, val);
      isDraggingTime.current = false;
    }, 16);
  }, [snippetName, onScrubTime]);

  const handleRateChange = useCallback((details: { value: number[] }) => {
    const val = details.value[0];
    setLocalRate(val);

    if (rateTimerRef.current) clearTimeout(rateTimerRef.current);
    rateTimerRef.current = window.setTimeout(() => {
      onPlaybackRate(snippetName, val);
    }, 16);
  }, [snippetName, onPlaybackRate]);

  const handleIntensityChange = useCallback((details: { value: number[] }) => {
    const val = details.value[0];
    setLocalIntensity(val);

    if (intensityTimerRef.current) clearTimeout(intensityTimerRef.current);
    intensityTimerRef.current = window.setTimeout(() => {
      onIntensityScale(snippetName, val);
    }, 16);
  }, [snippetName, onIntensityScale]);

  // Don't render if snippet doesn't exist
  if (!snippet) return null;

  return (
    <Box
      p={2}
      bg="gray.750"
      borderWidth="1px"
      borderColor="gray.600"
      borderRadius="md"
      boxShadow="sm"
    >
      <Flex align="center" justify="space-between">
        <Text fontWeight="semibold" fontSize="sm" color="cyan.400">
          {snippet.name}
          {snippet.isPlaying ? ' (Playing)' : ' (Stopped)'}
        </Text>
        <HStack gap={1}>
          <IconButton
            size="xs"
            colorPalette="green"
            aria-label="Play"
            onClick={() => onPlay(snippetName)}
            disabled={snippet.isPlaying}
          >
            <FaPlay />
          </IconButton>
          <IconButton
            size="xs"
            colorPalette="yellow"
            aria-label="Pause"
            onClick={() => onPause(snippetName)}
          >
            <FaPause />
          </IconButton>
          <IconButton
            size="xs"
            colorPalette="gray"
            aria-label="Remove"
            onClick={() => onRemove(snippetName)}
          >
            <FaTrashAlt />
          </IconButton>
        </HStack>
      </Flex>

      <HStack gap={2} mt={2} alignItems="center">
        <Text fontSize="xs" color="gray.300">Loop:</Text>
        <Switch.Root
          size="sm"
          checked={snippet.loop}
          onCheckedChange={() => onLoopToggle(snippetName, snippet.loop)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      <Text fontSize="xs" mt={1} color="gray.300">
        Time: {localTime.toFixed(2)} / {snippet.duration.toFixed(2)} s
      </Text>
      <Slider.Root
        min={0}
        max={snippet.duration || 1}
        step={0.01}
        value={[localTime]}
        onValueChange={handleTimeChange}
        size="sm"
        mb={2}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0}>
            <FaClock size={8} />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>

      <Text fontSize="xs" color="gray.300">
        Playback Rate: {localRate.toFixed(2)}x
      </Text>
      <Slider.Root
        min={0.1}
        max={3.0}
        step={0.1}
        value={[localRate]}
        onValueChange={handleRateChange}
        size="sm"
        mb={2}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>

      <Text fontSize="xs" color="gray.300">
        Intensity: {localIntensity.toFixed(1)}
      </Text>
      <Slider.Root
        min={0}
        max={2}
        step={0.1}
        value={[localIntensity]}
        onValueChange={handleIntensityChange}
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
  );
}

// Memoize - only re-render if snippetName or callbacks change
// The actual state updates come from RxJS subscription inside the component
export default memo(SnippetCard);
