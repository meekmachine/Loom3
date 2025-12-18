import React, { useState, useRef, useEffect } from 'react';
import {
  VStack,
  Textarea,
  Button,
  HStack,
  Select,
  Text,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Box,
  Badge,
} from '@chakra-ui/react';
import DockableAccordionItem from './DockableAccordionItem';
import { EngineThree } from '../../engine/EngineThree';
import { createTTSService } from '../../latticework/tts';
import { createLipSyncService } from '../../latticework/lipsync';
import type { TTSService } from '../../latticework/tts/ttsService';
import type { LipSyncServiceAPI } from '../../latticework/lipsync';
import { useEngineState } from '../../context/engineContext';

interface TTSSectionProps {
  engine?: EngineThree | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

/**
 * TTS Section - Text-to-Speech with integrated lip-sync and prosodic gestures
 *
 * Features:
 * - WebSpeech API for cross-platform text-to-speech
 * - Phoneme extraction → SAPI viseme mapping → ARKit morphs
 * - Animation service scheduling for smooth, wall-clock anchored playback
 * - Natural motion with easing curves (anticipation, overshoot, settle, decay)
 * - Coarticulation modeling (15% residual between adjacent visemes)
 * - Dynamic durations (vowels 150ms, consonants 80ms)
 * - Automatic neutral return at word boundaries and speech end
 * - Coordinated jaw movements (AU 26) with viseme shapes
 * - Optional prosodic gestures (brow raises every 3 words)
 *
 * Architecture:
 * 1. TTS service fires word boundary events
 * 2. LipSync service extracts phonemes → visemes for each word
 * 3. Build animation snippet with smooth curves for all visemes
 * 4. Schedule through animation service at priority 50 (high)
 * 5. Animation scheduler applies to ARKit morphs at 60fps
 * 6. Smooth return to neutral state after word/speech ends
 */
export default function TTSSection({ engine, disabled = false, defaultExpanded = false }: TTSSectionProps) {
  const { anim } = useEngineState();
  const [text, setText] = useState('The saddest aspect of life right now is that science gathers knowledge faster than society gathers wisdom.');
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('idle');
  const [jawActivation, setJawActivation] = useState(1.5); // Default to 1.5x for more visible jaw movement
  const [lipsyncIntensity, setLipsyncIntensity] = useState(1.0);

  // Service references
  const ttsRef = useRef<TTSService | null>(null);
  const lipSyncRef = useRef<LipSyncServiceAPI | null>(null);
  const wordIndexRef = useRef(0);

  // Track prosodic gestures only (LipSync agency handles its own snippets now)
  const prosodicSnippetsRef = useRef<string[]>([]); // Prosodic agency: brow raises

  // Initialize services
  useEffect(() => {
    if (!engine || !anim) return;

    // Create LipSync service with animation service integration
    lipSyncRef.current = createLipSyncService(
      {
        jawActivation,
        lipsyncIntensity,
        speechRate: rate,
      },
      {
        onSpeechStart: () => {
          console.log('[LipSync] Speech started');
        },
        onSpeechEnd: () => {
          console.log('[LipSync] Speech ended');
        },
      },
      {
        scheduleSnippet: (snippet) => anim.schedule(snippet),
        removeSnippet: (name) => anim.remove(name),
      }
    );

    // Create TTS service
    ttsRef.current = createTTSService(
      {
        engine: 'webSpeech',
        rate,
        pitch,
        volume,
        voiceName: selectedVoice,
      },
      {
        onStart: () => {
          console.log('[TTS] Speech started');
          setIsSpeaking(true);
          setStatus('speaking');
          wordIndexRef.current = 0;

          // Clear previous prosodic snippets
          prosodicSnippetsRef.current = [];

          // Start LipSync agency
          lipSyncRef.current?.startSpeech();

          // Start animation playback
          anim.play();
        },
        onEnd: () => {
          console.log('[TTS] Speech ended');
          setIsSpeaking(false);
          setStatus('idle');

          // End LipSync agency (handles neutral return internally)
          lipSyncRef.current?.endSpeech();

          // Remove Prosodic agency snippets
          if (anim) {
            prosodicSnippetsRef.current.forEach(snippetName => {
              anim.remove(snippetName);
            });
            prosodicSnippetsRef.current = [];
          }
        },
        onBoundary: ({ word, charIndex }) => {
          console.log(`[TTS] Word boundary: "${word}" at ${charIndex}`);

          // Process word through LipSync agency (handles everything internally)
          if (lipSyncRef.current && word) {
            lipSyncRef.current.processWord(word, wordIndexRef.current);
          }

          // === PROSODIC EXPRESSION AGENCY (SEPARATE FROM LIP-SYNC) ===
          // Varied prosodic gestures for natural speech emphasis
          if (anim) {
            const wordMod = wordIndexRef.current % 6;

            // Pattern 1: Brow raise + subtle head tilt (every 3 words)
            if (wordMod === 0) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:emphasis_${gestureTime}`;
              anim.schedule({
                name: gestureName,
                curves: {
                  '1': [ // Inner brow raiser (AU1)
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 35 },
                    { time: 0.45, intensity: 45 },
                    { time: 0.75, intensity: 0 },
                  ],
                  '2': [ // Outer brow raiser (AU2)
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 25 },
                    { time: 0.45, intensity: 35 },
                    { time: 0.75, intensity: 0 },
                  ],
                  '55': [ // Head tilt left (AU55) - subtle
                    { time: 0.0, intensity: 0 },
                    { time: 0.25, intensity: 15 },
                    { time: 0.65, intensity: 15 },
                    { time: 0.95, intensity: 0 },
                  ],
                },
                maxTime: 0.95,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.8,
              });
              prosodicSnippetsRef.current.push(gestureName);
              console.log(`[Prosodic] Brow + tilt emphasis "${gestureName}"`);
            }

            // Pattern 2: Head nod (every 4 words) - more pronounced
            else if (wordMod === 3) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:nod_${gestureTime}`;
              anim.schedule({
                name: gestureName,
                curves: {
                  '33': [ // Head turn up (AU33) - nod down motion (increased intensity)
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 40 },  // Faster attack, higher intensity
                    { time: 0.4, intensity: 50 },   // Higher peak
                    { time: 0.75, intensity: 0 },   // Slightly longer duration
                  ],
                },
                maxTime: 0.75,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.9,  // Increased from 0.7 to 0.9
              });
              prosodicSnippetsRef.current.push(gestureName);
              console.log(`[Prosodic] Head nod "${gestureName}"`);
            }

            // Pattern 3: Subtle frown for contemplative tone (every 5 words)
            else if (wordMod === 4) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:contemplate_${gestureTime}`;
              anim.schedule({
                name: gestureName,
                curves: {
                  '4': [ // Brow lowerer (AU4) - subtle frown
                    { time: 0.0, intensity: 0 },
                    { time: 0.2, intensity: 18 },
                    { time: 0.6, intensity: 22 },
                    { time: 1.0, intensity: 0 },
                  ],
                  '1': [ // Inner brow raiser (AU1) - slight counter for pensiveness
                    { time: 0.0, intensity: 0 },
                    { time: 0.25, intensity: 12 },
                    { time: 0.65, intensity: 12 },
                    { time: 1.0, intensity: 0 },
                  ],
                },
                maxTime: 1.0,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.6,
              });
              prosodicSnippetsRef.current.push(gestureName);
              console.log(`[Prosodic] Contemplative frown "${gestureName}"`);
            }
          }

          wordIndexRef.current++;
        },
        onError: (error) => {
          console.error('[TTS] Error:', error);
          setStatus('error');
          setIsSpeaking(false);
        },
      }
    );

    // Load voices
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(availableVoices[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Cleanup
    return () => {
      ttsRef.current?.dispose();
      lipSyncRef.current?.dispose();

      // Remove any remaining prosodic snippets (LipSync handles its own)
      prosodicSnippetsRef.current.forEach(snippetName => {
        anim.remove(snippetName);
      });
      prosodicSnippetsRef.current = [];
    };
  }, [engine, anim, rate, jawActivation, lipsyncIntensity]);

  // Update TTS config when parameters change
  useEffect(() => {
    if (ttsRef.current) {
      ttsRef.current.updateConfig({ rate, pitch, volume });
    }
    if (lipSyncRef.current) {
      lipSyncRef.current.updateConfig({
        speechRate: rate,
        jawActivation,
        lipsyncIntensity,
      });
    }
  }, [rate, pitch, volume, jawActivation, lipsyncIntensity]);

  // Update voice
  useEffect(() => {
    if (ttsRef.current && selectedVoice) {
      ttsRef.current.setVoice(selectedVoice);
    }
  }, [selectedVoice]);

  const handleSpeak = async () => {
    if (!ttsRef.current || !text.trim()) return;

    try {
      setStatus('loading');
      await ttsRef.current.speak(text);
    } catch (error) {
      console.error('Speech error:', error);
      setStatus('error');
    }
  };

  const handleStop = () => {
    ttsRef.current?.stop();
    lipSyncRef.current?.stop(); // LipSync agency handles cleanup internally
    setIsSpeaking(false);
    setStatus('idle');

    // Remove Prosodic agency snippets only
    if (anim) {
      prosodicSnippetsRef.current.forEach(snippetName => {
        anim.remove(snippetName);
      });
      prosodicSnippetsRef.current = [];
    }
  };

  return (
    <DockableAccordionItem title="Text-to-Speech" isDefaultExpanded={defaultExpanded}>
      <VStack spacing={4} mt={2} align="stretch">
        {/* Status Badge */}
        <HStack>
          <Text fontSize="xs" fontWeight="bold">Status:</Text>
          <Badge
            colorScheme={
              status === 'speaking' ? 'green' :
              status === 'loading' ? 'yellow' :
              status === 'error' ? 'red' :
              'gray'
            }
          >
            {status.toUpperCase()}
          </Badge>
        </HStack>

        {/* Text Input */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to speak..."
          size="sm"
          rows={4}
          disabled={disabled || isSpeaking}
        />

        {/* Voice Selection */}
        <Box>
          <Text fontSize="xs" mb={1}>Voice</Text>
          <Select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            size="sm"
            disabled={disabled || isSpeaking}
          >
            {voices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </Select>
        </Box>

        {/* Rate Control */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs">Rate</Text>
            <Text fontSize="xs" fontWeight="bold">{rate.toFixed(1)}x</Text>
          </HStack>
          <Slider
            value={rate}
            onChange={setRate}
            min={0.5}
            max={2.0}
            step={0.1}
            isDisabled={disabled || isSpeaking}
          >
            <SliderTrack>
              <SliderFilledTrack bg="teal.400" />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        {/* Pitch Control */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs">Pitch</Text>
            <Text fontSize="xs" fontWeight="bold">{pitch.toFixed(1)}</Text>
          </HStack>
          <Slider
            value={pitch}
            onChange={setPitch}
            min={0.5}
            max={2.0}
            step={0.1}
            isDisabled={disabled || isSpeaking}
          >
            <SliderTrack>
              <SliderFilledTrack bg="purple.400" />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        {/* Volume Control */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs">Volume</Text>
            <Text fontSize="xs" fontWeight="bold">{Math.round(volume * 100)}%</Text>
          </HStack>
          <Slider
            value={volume}
            onChange={setVolume}
            min={0}
            max={1.0}
            step={0.1}
            isDisabled={disabled || isSpeaking}
          >
            <SliderTrack>
              <SliderFilledTrack bg="blue.400" />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        {/* Jaw Activation Control */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs">Jaw Activation</Text>
            <Text fontSize="xs" fontWeight="bold">{jawActivation.toFixed(1)}x</Text>
          </HStack>
          <Slider
            value={jawActivation}
            onChange={setJawActivation}
            min={0}
            max={2.0}
            step={0.1}
            isDisabled={disabled || isSpeaking}
          >
            <SliderTrack>
              <SliderFilledTrack bg="orange.400" />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        {/* Lipsync Intensity Control */}
        <Box>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="xs">Lipsync Intensity</Text>
            <Text fontSize="xs" fontWeight="bold">{lipsyncIntensity.toFixed(1)}x</Text>
          </HStack>
          <Slider
            value={lipsyncIntensity}
            onChange={setLipsyncIntensity}
            min={0}
            max={2.0}
            step={0.1}
            isDisabled={disabled || isSpeaking}
          >
            <SliderTrack>
              <SliderFilledTrack bg="pink.400" />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </Box>

        {/* Control Buttons */}
        <HStack spacing={2}>
          <Button
            onClick={handleSpeak}
            colorScheme="teal"
            size="sm"
            isDisabled={disabled || isSpeaking || !text.trim()}
            flex={1}
          >
            Speak
          </Button>
          <Button
            onClick={handleStop}
            colorScheme="red"
            size="sm"
            isDisabled={disabled || !isSpeaking}
            flex={1}
          >
            Stop
          </Button>
        </HStack>

        {/* Info */}
        <Text fontSize="2xs" color="gray.500">
          Integrated: TTS + LipSync + Prosodic Gestures
        </Text>
      </VStack>
    </DockableAccordionItem>
  );
}
