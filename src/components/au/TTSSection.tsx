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
import type { LipSyncService } from '../../latticework/lipsync/lipSyncService';
import { useThreeState } from '../../context/threeContext';
import { getARKitVisemeKey, getARKitVisemeIndex, getJawAmountForViseme } from '../../latticework/lipsync/visemeToARKit';

interface TTSSectionProps {
  engine?: EngineThree;
  disabled?: boolean;
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
export default function TTSSection({ engine, disabled = false }: TTSSectionProps) {
  const { anim } = useThreeState();
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
  const lipSyncRef = useRef<LipSyncService | null>(null);
  const wordIndexRef = useRef(0);
  const currentVisemeSnippetRef = useRef<string | null>(null);
  const browSnippetRef = useRef<string | null>(null);

  // Initialize services
  useEffect(() => {
    if (!engine || !anim) return;

    // Create LipSync service (for phoneme extraction only)
    lipSyncRef.current = createLipSyncService(
      {
        engine: 'webSpeech',
        onsetIntensity: 90,
        holdMs: 100,
        speechRate: rate,
        jawActivation,
        lipsyncIntensity,
      },
      {}
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

          // Start animation playback
          anim.play();
        },
        onEnd: () => {
          console.log('[TTS] Speech ended');
          setIsSpeaking(false);
          setStatus('idle');

          // Remove ALL viseme and jaw snippets from animation service
          if (anim) {
            const state = anim.getState?.();
            const animations = (state?.context?.animations as any[]) || [];

            // Find and remove all viseme and jaw snippets
            animations.forEach(snippet => {
              if (snippet.name?.startsWith('viseme_') || snippet.name?.startsWith('jaw_')) {
                anim.remove(snippet.name);
              }
            });

            // Schedule a final neutral snippet to return ALL visemes and jaw to zero
            const neutralSnippet = `neutral_${Date.now()}`;
            const neutralCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

            // Add neutral curves for all 15 ARKit viseme indices (0-14)
            for (let i = 0; i < 15; i++) {
              neutralCurves[i.toString()] = [
                { time: 0.0, intensity: 0 },
                { time: 0.3, intensity: 0 },
              ];
            }

            // Add jaw closure
            neutralCurves['26'] = [
              { time: 0.0, intensity: 0 },
              { time: 0.3, intensity: 0 },
            ];

            anim.schedule({
              name: neutralSnippet,
              curves: neutralCurves,
              maxTime: 0.3,
              loop: false,
              snippetCategory: 'visemeSnippet',
              snippetPriority: 60, // Higher priority to override lingering visemes
              snippetPlaybackRate: 1.0,
              snippetIntensityScale: 1.0,
            });

            // Remove neutral snippet after it completes
            setTimeout(() => {
              anim.remove(neutralSnippet);
            }, 350);
          }

          currentVisemeSnippetRef.current = null;

          // Remove brow snippet
          if (browSnippetRef.current) {
            anim.remove(browSnippetRef.current);
            browSnippetRef.current = null;
          }
        },
        onBoundary: ({ word, charIndex }) => {
          console.log(`[TTS] Word boundary: "${word}" at ${charIndex}`);

          // Extract visemes for this word using phoneme extraction
          if (lipSyncRef.current && word && anim) {
            const visemeTimeline = lipSyncRef.current.extractVisemeTimeline(word);
            console.log(`[TTS] Extracted ${visemeTimeline.length} visemes for "${word}":`, visemeTimeline);

            // Build viseme snippet with curves for animation service
            const visemeCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

            // Track jaw movements in separate curves object for AU snippet
            const jawCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

            // Add viseme keyframes to curves with smooth transitions
            visemeTimeline.forEach((visemeEvent, idx) => {
              // Convert SAPI viseme ID to ARKit viseme index (0-14) for proper morph mapping
              const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
              const visemeId = arkitIndex.toString();
              const timeInSec = visemeEvent.offsetMs / 1000;
              const durationInSec = visemeEvent.durationMs / 1000;

              if (!visemeCurves[visemeId]) {
                visemeCurves[visemeId] = [];
              }

              // Snappy transitions - each viseme activates fully then returns to zero
              const anticipationTime = durationInSec * 0.15; // Quick onset
              const peakTime = durationInSec * 0.65;

              // Start at zero
              visemeCurves[visemeId].push({
                time: timeInSec,
                intensity: 0,
              });

              // Reach peak quickly (apply lipsync intensity multiplier)
              visemeCurves[visemeId].push({
                time: timeInSec + anticipationTime,
                intensity: 100 * lipsyncIntensity,
              });

              // Hold at peak (apply lipsync intensity multiplier)
              visemeCurves[visemeId].push({
                time: timeInSec + peakTime,
                intensity: 100 * lipsyncIntensity,
              });

              // Return to zero - ALWAYS go to zero for clean transitions
              // This ensures each viseme is discrete and doesn't blend with others
              visemeCurves[visemeId].push({
                time: timeInSec + durationInSec,
                intensity: 0,
              });

              // Add jaw activation with smooth transitions (apply jaw activation multiplier)
              const jawAmount = getJawAmountForViseme(visemeEvent.visemeId);
              if (jawAmount > 0) {
                // Initialize jaw curve if needed
                if (!jawCurves['26']) {
                  jawCurves['26'] = [];
                }

                // Jaw opening
                jawCurves['26'].push({
                  time: timeInSec,
                  intensity: 0,
                });

                jawCurves['26'].push({
                  time: timeInSec + anticipationTime,
                  intensity: jawAmount * 100 * jawActivation,
                });

                jawCurves['26'].push({
                  time: timeInSec + peakTime,
                  intensity: jawAmount * 100 * jawActivation,
                });

                // Jaw closing - ALWAYS return to zero for clean transitions
                jawCurves['26'].push({
                  time: timeInSec + durationInSec,
                  intensity: 0,
                });
              }
            });

            // Calculate max time and add neutral hold period
            const lastVisemeEndTime = visemeTimeline.length > 0
              ? Math.max(...visemeTimeline.map(v => (v.offsetMs + v.durationMs) / 1000))
              : 0;

            // Add 100ms neutral hold AFTER the last viseme to ensure mouth closes
            const neutralHoldDuration = 0.1; // 100ms
            const maxTime = lastVisemeEndTime + neutralHoldDuration;

            // Add explicit neutral keyframes for ALL viseme curves at the end
            Object.keys(visemeCurves).forEach(curveId => {
              const curve = visemeCurves[curveId];
              // Ensure the curve ends at zero and stays there
              if (curve.length > 0) {
                const lastKeyframe = curve[curve.length - 1];
                // If last keyframe isn't already at maxTime, add a hold at zero
                if (lastKeyframe.time < maxTime) {
                  curve.push({
                    time: maxTime,
                    intensity: 0,
                  });
                }
              }
            });

            // Ensure jaw also returns to neutral and holds
            if (jawCurves['26'] && jawCurves['26'].length > 0) {
              const jawCurve = jawCurves['26'];
              const lastJawKeyframe = jawCurve[jawCurve.length - 1];
              if (lastJawKeyframe.time < maxTime) {
                jawCurve.push({
                  time: maxTime,
                  intensity: 0,
                });
              }
            }

            // DON'T remove previous snippet - let them blend together naturally
            // Each word snippet will overlap and the animation service will blend them

            // Schedule viseme snippet (for mouth shapes)
            const visemeSnippetName = `viseme_${Date.now()}`;
            anim.schedule({
              name: visemeSnippetName,
              curves: visemeCurves,
              maxTime,
              loop: false,
              snippetCategory: 'visemeSnippet', // This tells scheduler to map indices to VISEME_KEYS
              snippetPriority: 50, // Higher priority for lip sync
              snippetPlaybackRate: rate,
              snippetIntensityScale: 1.0,
            });

            // Schedule jaw snippet separately (as AU snippet, not viseme)
            if (Object.keys(jawCurves).length > 0) {
              const jawSnippetName = `jaw_${Date.now()}`;
              anim.schedule({
                name: jawSnippetName,
                curves: jawCurves,
                maxTime,
                loop: false,
                snippetCategory: 'auSnippet', // This tells scheduler to apply as AU IDs
                snippetPriority: 50, // Same priority as visemes
                snippetPlaybackRate: rate,
                snippetIntensityScale: 1.0,
              });
            }

            // Store snippet name but don't remove old ones during speech
            // They'll auto-remove when they finish playing
            currentVisemeSnippetRef.current = visemeSnippetName;

            // Schedule brow raise every few words for prosodic emphasis
            if (wordIndexRef.current % 3 === 0 && anim) {
              // Remove previous brow snippet
              if (browSnippetRef.current) {
                anim.remove(browSnippetRef.current);
              }

              const browName = `brow_${Date.now()}`;
              anim.schedule({
                name: browName,
                curves: {
                  '1': [ // Inner brow raiser
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 35 },
                    { time: 0.35, intensity: 45 },
                    { time: 0.65, intensity: 0 },
                  ],
                  '2': [ // Outer brow raiser
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 25 },
                    { time: 0.35, intensity: 35 },
                    { time: 0.65, intensity: 0 },
                  ],
                },
                maxTime: 0.65,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.8,
              });

              browSnippetRef.current = browName;
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

      // Remove any remaining snippets
      if (currentVisemeSnippetRef.current) {
        anim.remove(currentVisemeSnippetRef.current);
      }
      if (browSnippetRef.current) {
        anim.remove(browSnippetRef.current);
      }
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
    lipSyncRef.current?.stop();
    setIsSpeaking(false);
    setStatus('idle');

    // Remove ALL viseme and jaw snippets from animation service
    if (anim) {
      const state = anim.getState?.();
      const animations = (state?.context?.animations as any[]) || [];

      // Find and remove all viseme and jaw snippets
      animations.forEach(snippet => {
        if (snippet.name?.startsWith('viseme_') || snippet.name?.startsWith('jaw_')) {
          anim.remove(snippet.name);
        }
      });

      // Schedule a final neutral snippet to return ALL visemes and jaw to zero
      const neutralSnippet = `neutral_stop_${Date.now()}`;
      const neutralCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

      // Add neutral curves for all 15 ARKit viseme indices (0-14)
      for (let i = 0; i < 15; i++) {
        neutralCurves[i.toString()] = [
          { time: 0.0, intensity: 0 },
          { time: 0.3, intensity: 0 },
        ];
      }

      // Add jaw closure
      neutralCurves['26'] = [
        { time: 0.0, intensity: 0 },
        { time: 0.3, intensity: 0 },
      ];

      anim.schedule({
        name: neutralSnippet,
        curves: neutralCurves,
        maxTime: 0.3,
        loop: false,
        snippetCategory: 'visemeSnippet',
        snippetPriority: 60, // Higher priority to override lingering visemes
        snippetPlaybackRate: 1.0,
        snippetIntensityScale: 1.0,
      });

      // Remove neutral snippet after it completes
      setTimeout(() => {
        anim.remove(neutralSnippet);
      }, 350);
    }

    currentVisemeSnippetRef.current = null;

    // Remove brow snippet
    if (browSnippetRef.current) {
      anim.remove(browSnippetRef.current);
      browSnippetRef.current = null;
    }
  };

  return (
    <DockableAccordionItem title="Text-to-Speech">
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
