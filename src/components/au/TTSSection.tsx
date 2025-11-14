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
import { createProsodicService } from '../../latticework/prosodic';
import type { TTSService } from '../../latticework/tts/ttsService';
import type { LipSyncService } from '../../latticework/lipsync/lipSyncService';
import type { ProsodicService } from '../../latticework/prosodic/prosodicService';

interface TTSSectionProps {
  engine?: EngineThree;
  disabled?: boolean;
}

/**
 * TTS Section - Text-to-Speech with integrated lip-sync and prosodic gestures
 */
export default function TTSSection({ engine, disabled = false }: TTSSectionProps) {
  const [text, setText] = useState('Hello! How are you today?');
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('idle');

  // Service references
  const ttsRef = useRef<TTSService | null>(null);
  const lipSyncRef = useRef<LipSyncService | null>(null);
  const prosodicRef = useRef<ProsodicService | null>(null);
  const wordIndexRef = useRef(0);

  // Initialize services
  useEffect(() => {
    if (!engine) return;

    // Create LipSync service
    lipSyncRef.current = createLipSyncService(
      {
        engine: 'webSpeech',
        onsetIntensity: 90,
        holdMs: 140,
        speechRate: rate,
      },
      {
        onVisemeStart: (visemeId, intensity) => {
          console.log(`[LipSync] Viseme ${visemeId} at ${intensity}%`);
          // Map viseme to jaw/lip movements
          const normalizedIntensity = intensity / 100;

          // Jaw drop (AU26) for vowels
          if (visemeId >= 1 && visemeId <= 11) {
            engine.setAU(26, normalizedIntensity * 0.7);
          }

          // Lip rounding (AU18) for rounded vowels
          if (visemeId === 7 || visemeId === 8) {
            engine.setAU(18, normalizedIntensity * 0.5);
          }

          // Lip closure (AU24) for bilabials
          if (visemeId === 21) {
            engine.setAU(24, normalizedIntensity * 0.8);
          }

          // Lip stretch for alveolar sounds
          if (visemeId === 15 || visemeId === 19) {
            engine.setAU(20, normalizedIntensity * 0.3);
          }
        },
        onVisemeEnd: () => {
          // Return to neutral
          engine.setAU(26, 0);
          engine.setAU(18, 0);
          engine.setAU(24, 0);
          engine.setAU(20, 0);
        },
      }
    );

    // Create Prosodic service
    prosodicRef.current = createProsodicService(
      {
        defaultIntensity: 0.8,
        fadeSteps: 4,
        fadeStepInterval: 120,
      },
      {
        onBrowStart: () => {
          console.log('[Prosodic] Brow started');
        },
        onHeadStart: () => {
          console.log('[Prosodic] Head started');
        },
        onPulse: (channel, wordIndex) => {
          console.log(`[Prosodic] Pulse on ${channel} at word ${wordIndex}`);

          // Brow pulse
          if (channel === 'brow' || channel === 'both') {
            engine.setAU(1, 0.6); // Inner brow raise
            engine.setAU(2, 0.6); // Outer brow raise
            setTimeout(() => {
              engine.setAU(1, 0.3);
              engine.setAU(2, 0.3);
            }, 80);
          }

          // Head nod
          if (channel === 'head' || channel === 'both') {
            engine.setHeadVertical(0.4);
            setTimeout(() => {
              engine.setHeadVertical(0.1);
            }, 120);
          }
        },
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

          // Start prosodic gestures
          prosodicRef.current?.startTalking();
        },
        onEnd: () => {
          console.log('[TTS] Speech ended');
          setIsSpeaking(false);
          setStatus('idle');

          // Stop prosodic gestures
          prosodicRef.current?.stopTalking('both');

          // Stop lip-sync
          lipSyncRef.current?.stop();

          // Return to neutral
          engine.setAU(26, 0);
          engine.setAU(24, 0);
          engine.setAU(18, 0);
          engine.setAU(20, 0);
          engine.setAU(1, 0);
          engine.setAU(2, 0);
          engine.setHeadVertical(0);
        },
        onBoundary: ({ word, charIndex }) => {
          console.log(`[TTS] Word boundary: "${word}" at ${charIndex}`);

          // Lip pulse on word boundary
          lipSyncRef.current?.handleViseme(0, 60);

          // Prosodic pulse
          prosodicRef.current?.pulse(wordIndexRef.current);
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
      prosodicRef.current?.dispose();
    };
  }, [engine]);

  // Update TTS config when parameters change
  useEffect(() => {
    if (ttsRef.current) {
      ttsRef.current.updateConfig({ rate, pitch, volume });
    }
    if (lipSyncRef.current) {
      lipSyncRef.current.updateConfig({ speechRate: rate });
    }
  }, [rate, pitch, volume]);

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
    prosodicRef.current?.stop();
    setIsSpeaking(false);
    setStatus('idle');
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
