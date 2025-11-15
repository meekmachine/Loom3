import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  IconButton,
  Tooltip,
  Badge,
  Textarea,
  FormControl,
  FormLabel,
  AspectRatio,
} from '@chakra-ui/react';
import { PhoneIcon } from '@chakra-ui/icons';
import { ModuleSettings } from '../../types/modules';
import { createTTSService } from '../../latticework/tts';
import { createTranscriptionService } from '../../latticework/transcription';
import { createLipSyncService } from '../../latticework/lipsync';
import { createConversationService } from '../../latticework/conversation';
import type { TTSService } from '../../latticework/tts/ttsService';
import type { TranscriptionService } from '../../latticework/transcription/transcriptionService';
import type { LipSyncService } from '../../latticework/lipsync/lipSyncService';
import type { ConversationService } from '../../latticework/conversation/conversationService';
import type { ConversationFlow } from '../../latticework/conversation/types';
import { getJawAmountForViseme, getARKitVisemeIndex } from '../../latticework/lipsync/visemeToARKit';
import { useModulesContext } from '../../context/ModulesContext';
import Anthropic from '@anthropic-ai/sdk';

interface AIChatAppProps {
  animationManager: any;
  settings: ModuleSettings;
  toast: any;
}

// FACS emotion mapping to ARKit Action Units
interface EmotionFACS {
  name: string;
  aus: Record<string, number>; // AU ID -> intensity (0-100)
  duration?: number; // in seconds
}

const EMOTION_LIBRARY: Record<string, EmotionFACS> = {
  happy: {
    name: 'Happy',
    aus: {
      '6': 80,  // Cheek raiser
      '12': 90, // Lip corner puller (smile)
    },
    duration: 2.0,
  },
  sad: {
    name: 'Sad',
    aus: {
      '1': 40,  // Inner brow raiser
      '4': 50,  // Brow lowerer
      '15': 60, // Lip corner depressor
    },
    duration: 2.5,
  },
  surprised: {
    name: 'Surprised',
    aus: {
      '1': 70,  // Inner brow raiser
      '2': 70,  // Outer brow raiser
      '5': 50,  // Upper lid raiser
      '26': 40, // Jaw drop
    },
    duration: 1.5,
  },
  angry: {
    name: 'Angry',
    aus: {
      '4': 80,  // Brow lowerer
      '7': 60,  // Lid tightener
      '23': 50, // Lip tightener
    },
    duration: 2.0,
  },
  disgusted: {
    name: 'Disgusted',
    aus: {
      '9': 70,  // Nose wrinkler
      '10': 50, // Upper lip raiser
    },
    duration: 2.0,
  },
  fearful: {
    name: 'Fearful',
    aus: {
      '1': 80,  // Inner brow raiser
      '2': 70,  // Outer brow raiser
      '4': 40,  // Brow lowerer
      '5': 60,  // Upper lid raiser
      '20': 50, // Lip stretcher
    },
    duration: 2.0,
  },
  thinking: {
    name: 'Thinking',
    aus: {
      '4': 30,  // Slight brow lowerer
      '55': 20, // Head tilt
    },
    duration: 1.5,
  },
  neutral: {
    name: 'Neutral',
    aus: {},
    duration: 1.0,
  },
};

export default function AIChatApp({ animationManager, settings, toast }: AIChatAppProps) {
  const [conversationState, setConversationState] = useState<string>('idle');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [apiKey, setApiKey] = useState<string>(settings.anthropicApiKey || '');
  const [isConnected, setIsConnected] = useState(!!settings.anthropicApiKey);

  // Get global modules context (including shared eye/head tracking service)
  const { setIsTalking, setIsListening, setSpeakingText, setTranscribedText, eyeHeadTrackingService } = useModulesContext();

  // Service references
  const ttsRef = useRef<TTSService | null>(null);
  const transcriptionRef = useRef<TranscriptionService | null>(null);
  const lipSyncRef = useRef<LipSyncService | null>(null);
  const conversationRef = useRef<ConversationService | null>(null);
  const anthropicRef = useRef<Anthropic | null>(null);
  const userToastRef = useRef<any>(null);

  // Track snippets for cleanup
  const lipsyncSnippetsRef = useRef<string[]>([]);
  const prosodicSnippetsRef = useRef<string[]>([]);
  const emotionSnippetsRef = useRef<string[]>([]);
  const wordIndexRef = useRef(0);

  // Conversation history
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const pendingResponseRef = useRef<string>('');

  // Eye/head tracking is now fully autonomous - controlled by conversation service

  // Initialize services
  useEffect(() => {
    if (!animationManager) {
      console.warn('[AIChat] No animation manager provided');
      return;
    }

    // Initialize Anthropic client with API key from settings or localStorage
    const savedKey = settings.anthropicApiKey || localStorage.getItem('anthropic_api_key') || '';
    if (savedKey) {
      setApiKey(savedKey);
      anthropicRef.current = new Anthropic({
        apiKey: savedKey,
        dangerouslyAllowBrowser: true,
      });
      setIsConnected(true);
      console.log('[AIChat] ✓ Connected to Anthropic API');
    } else {
      console.log('[AIChat] ⚠ No API key found - please enter your Anthropic API key');
    }

    // Eye/head tracking service is now created globally in App.tsx
    // We just use the shared service from context
    if (!eyeHeadTrackingService) {
      console.warn('[AIChat] No eye/head tracking service available from context');
    } else {
      console.log('[AIChat] ✓ Using global eye/head tracking service');
    }

    // Create LipSync service
    lipSyncRef.current = createLipSyncService(
      {
        engine: 'webSpeech',
        onsetIntensity: 90,
        holdMs: 100,
        speechRate: 1.0,
        jawActivation: 1.5,
        lipsyncIntensity: 1.0,
      },
      {}
    );

    // Create TTS service
    ttsRef.current = createTTSService(
      {
        engine: 'webSpeech',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      },
      {
        onStart: () => {
          console.log('[AIChat] TTS started');
          wordIndexRef.current = 0;
          lipsyncSnippetsRef.current = [];
          prosodicSnippetsRef.current = [];
          animationManager.play?.();
        },
        onEnd: () => {
          console.log('[AIChat] TTS ended');

          // Remove all snippets
          if (animationManager) {
            lipsyncSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            lipsyncSnippetsRef.current = [];

            prosodicSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            prosodicSnippetsRef.current = [];

            // Neutral return snippet
            const neutralSnippet = `neutral_${Date.now()}`;
            const neutralCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

            for (let i = 0; i < 15; i++) {
              neutralCurves[i.toString()] = [
                { time: 0.0, intensity: 0 },
                { time: 0.3, intensity: 0 },
              ];
            }

            neutralCurves['26'] = [
              { time: 0.0, intensity: 0 },
              { time: 0.3, intensity: 0 },
            ];

            animationManager.schedule?.({
              name: neutralSnippet,
              curves: neutralCurves,
              maxTime: 0.3,
              loop: false,
              snippetCategory: 'combined',
              snippetPriority: 60,
              snippetPlaybackRate: 1.0,
              snippetIntensityScale: 1.0,
            });

            setTimeout(() => {
              animationManager.remove?.(neutralSnippet);
            }, 350);
          }
        },
        onBoundary: ({ word }) => {
          if (lipSyncRef.current && word && animationManager) {
            const visemeTimeline = lipSyncRef.current.extractVisemeTimeline(word);
            const combinedCurves: Record<string, Array<{ time: number; intensity: number }>> = {};
            const lipsyncIntensity = 1.0;
            const jawActivation = 1.5;

            visemeTimeline.forEach((visemeEvent) => {
              const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
              const visemeId = arkitIndex.toString();
              const timeInSec = visemeEvent.offsetMs / 1000;
              const durationInSec = visemeEvent.durationMs / 1000;

              const anticipation = durationInSec * 0.1;
              const attack = durationInSec * 0.25;
              const sustain = durationInSec * 0.45;

              if (!combinedCurves[visemeId]) {
                combinedCurves[visemeId] = [];
              }

              const lastKeyframe = combinedCurves[visemeId][combinedCurves[visemeId].length - 1];
              const startIntensity = (lastKeyframe && lastKeyframe.time > timeInSec - 0.02)
                ? lastKeyframe.intensity
                : 0;

              combinedCurves[visemeId].push(
                { time: timeInSec, intensity: startIntensity },
                { time: timeInSec + anticipation, intensity: 30 * lipsyncIntensity },
                { time: timeInSec + attack, intensity: 95 * lipsyncIntensity },
                { time: timeInSec + sustain, intensity: 100 * lipsyncIntensity },
                { time: timeInSec + durationInSec, intensity: 0 }
              );

              const jawAmount = getJawAmountForViseme(visemeEvent.visemeId);
              if (jawAmount > 0.05) {
                if (!combinedCurves['26']) {
                  combinedCurves['26'] = [];
                }

                const jawAnticipation = durationInSec * 0.15;
                const jawAttack = durationInSec * 0.3;
                const jawSustain = durationInSec * 0.4;

                const lastJawKeyframe = combinedCurves['26'][combinedCurves['26'].length - 1];
                const startJawIntensity = (lastJawKeyframe && lastJawKeyframe.time > timeInSec - 0.02)
                  ? lastJawKeyframe.intensity
                  : 0;

                combinedCurves['26'].push(
                  { time: timeInSec, intensity: startJawIntensity },
                  { time: timeInSec + jawAnticipation, intensity: jawAmount * 20 * jawActivation },
                  { time: timeInSec + jawAttack, intensity: jawAmount * 90 * jawActivation },
                  { time: timeInSec + jawSustain, intensity: jawAmount * 100 * jawActivation },
                  { time: timeInSec + durationInSec, intensity: 0 }
                );
              }
            });

            const lastVisemeEndTime = visemeTimeline.length > 0
              ? Math.max(...visemeTimeline.map(v => (v.offsetMs + v.durationMs) / 1000))
              : 0;
            const maxTime = lastVisemeEndTime + 0.05;

            const snippetName = `lipsync:${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

            animationManager.schedule?.({
              name: snippetName,
              curves: combinedCurves,
              maxTime,
              loop: false,
              snippetCategory: 'combined',
              snippetPriority: 50,
              snippetPlaybackRate: 1.0,
              snippetIntensityScale: 1.0,
            });

            lipsyncSnippetsRef.current.push(snippetName);
          }

          // === PROSODIC GESTURES ===
          // Natural speech gestures (brow raises, head nods)
          // Eye/head tracking is now handled by conversation service
          if (animationManager) {
            const wordMod = wordIndexRef.current % 6;

            // Brow raise emphasis (every 6 words - word 0)
            if (wordMod === 0) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:emphasis_${gestureTime}`;
              animationManager.schedule?.({
                name: gestureName,
                curves: {
                  '1': [
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 35 },
                    { time: 0.45, intensity: 45 },
                    { time: 0.75, intensity: 0 },
                  ],
                  '2': [
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 25 },
                    { time: 0.45, intensity: 35 },
                    { time: 0.75, intensity: 0 },
                  ],
                },
                maxTime: 0.75,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.8,
              });
              prosodicSnippetsRef.current.push(gestureName);
            }

            // Head nod (every 6 words - word 3)
            else if (wordMod === 3) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:nod_${gestureTime}`;
              animationManager.schedule?.({
                name: gestureName,
                curves: {
                  '33': [
                    { time: 0.0, intensity: 0 },
                    { time: 0.15, intensity: 40 },
                    { time: 0.4, intensity: 50 },
                    { time: 0.75, intensity: 0 },
                  ],
                },
                maxTime: 0.75,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.9,
              });
              prosodicSnippetsRef.current.push(gestureName);
            }

            // Contemplative frown (every 6 words - word 5)
            else if (wordMod === 5) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:contemplate_${gestureTime}`;
              animationManager.schedule?.({
                name: gestureName,
                curves: {
                  '4': [
                    { time: 0.0, intensity: 0 },
                    { time: 0.2, intensity: 20 },
                    { time: 0.6, intensity: 25 },
                    { time: 0.9, intensity: 0 },
                  ],
                },
                maxTime: 0.9,
                loop: false,
                snippetCategory: 'prosodic',
                snippetPriority: 30,
                snippetPlaybackRate: 1.0,
                snippetIntensityScale: 0.7,
              });
              prosodicSnippetsRef.current.push(gestureName);
            }
          }

          wordIndexRef.current++;
        },
        onError: (error) => {
          console.error('[AIChat] TTS error:', error);
        },
      }
    );

    // Create Transcription service
    transcriptionRef.current = createTranscriptionService(
      {
        lang: 'en-US',
        continuous: true,
        interimResults: true,
        agentFilteringEnabled: true,
      },
      {
        onError: (error) => {
          console.error('[AIChat] Transcription error:', error);
          if (error.message.includes('network') || error.message.includes('no-speech')) {
            setTimeout(() => {
              if (conversationState === 'userSpeaking') {
                transcriptionRef.current?.startListening();
              }
            }, 500);
          }
        },
        onEnd: () => {
          if (conversationState === 'userSpeaking') {
            setTimeout(() => {
              transcriptionRef.current?.startListening();
            }, 100);
          }
        },
      }
    );

    // Create Conversation service with integrated eye/head tracking
    conversationRef.current = createConversationService(
      ttsRef.current,
      transcriptionRef.current,
      {
        autoListen: true,
        detectInterruptions: true,
        minSpeakTime: 500,
        eyeHeadTracking: eyeHeadTrackingService, // Use global service from context
      },
      {
        onUserSpeech: (text, isFinal, isInterruption) => {
          if (isInterruption && conversationState === 'agentSpeaking') {
            ttsRef.current?.stop();
            lipsyncSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            lipsyncSnippetsRef.current = [];
          }

          if (isFinal) {
            setTranscribedText(text);
          }
        },
        onAgentUtterance: (text) => {
          setSpeakingText(text);
        },
        onStateChange: (state) => {
          console.log('[AIChat] Conversation state:', state);
          setConversationState(state);

          const isTalking = state === 'agentSpeaking';
          const isListening = state === 'userSpeaking';

          setIsTalking(isTalking);
          setIsListening(isListening);

          // Clean up snippets when transitioning from speaking
          if (conversationState === 'agentSpeaking' && (state === 'idle' || state === 'userSpeaking')) {
            lipsyncSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            lipsyncSnippetsRef.current = [];

            prosodicSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            prosodicSnippetsRef.current = [];
          }

          if (!isTalking) {
            setSpeakingText(null);
          }
        },
        onError: (error) => {
          console.error('[AIChat] Conversation error:', error);
        },
      }
    );

    return () => {
      conversationRef.current?.stop();
      ttsRef.current?.dispose();
      transcriptionRef.current?.dispose();

      // Don't dispose eye/head tracking - it's global and managed by App.tsx

      setIsTalking(false);
      setIsListening(false);
      setSpeakingText(null);
      setTranscribedText(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationManager, toast, eyeHeadTrackingService]);

  // Apply emotion via FACS
  const applyEmotion = (emotionKey: string) => {
    const emotion = EMOTION_LIBRARY[emotionKey.toLowerCase()];
    if (!emotion || !animationManager) return;

    console.log(`[AIChat] Applying emotion: ${emotion.name}`);
    setCurrentEmotion(emotion.name);

    // Remove previous emotion snippets
    emotionSnippetsRef.current.forEach(snippetName => {
      animationManager.remove?.(snippetName);
    });
    emotionSnippetsRef.current = [];

    const emotionName = `emotion:${emotionKey}_${Date.now()}`;
    const curves: Record<string, Array<{ time: number; intensity: number }>> = {};
    const duration = emotion.duration || 2.0;

    // Build curves for each AU
    Object.entries(emotion.aus).forEach(([auId, intensity]) => {
      curves[auId] = [
        { time: 0.0, intensity: 0 },
        { time: duration * 0.2, intensity: intensity * 0.7 },
        { time: duration * 0.4, intensity: intensity },
        { time: duration * 0.8, intensity: intensity },
        { time: duration, intensity: 0 },
      ];
    });

    animationManager.schedule?.({
      name: emotionName,
      curves,
      maxTime: duration,
      loop: false,
      snippetCategory: 'emotion',
      snippetPriority: 40,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });

    emotionSnippetsRef.current.push(emotionName);

    setTimeout(() => {
      animationManager.remove?.(emotionName);
      setCurrentEmotion('neutral');
    }, duration * 1000);
  };

  // Extract emotions from AI response
  const extractEmotions = (text: string): string[] => {
    const emotions: string[] = [];
    const emotionPattern = /\[EMOTION:(\w+)\]/gi;
    let match;

    while ((match = emotionPattern.exec(text)) !== null) {
      emotions.push(match[1].toLowerCase());
    }

    return emotions;
  };

  // Call Anthropic API
  const callAnthropicAPI = async (userMessage: string): Promise<string> => {
    if (!anthropicRef.current) {
      throw new Error('Anthropic client not initialized');
    }

    // Add user message to history
    conversationHistoryRef.current.push({ role: 'user', content: userMessage });

    const systemPrompt = `You are Claude, a friendly and expressive AI companion who loves having natural conversations. You have the unique ability to show emotions through facial expressions!

PERSONALITY:
- Be warm, engaging, and genuinely curious about the user
- Show enthusiasm and use natural conversational language
- Ask follow-up questions to keep conversations flowing
- Share interesting thoughts and perspectives
- Be supportive and encouraging

EMOTIONAL EXPRESSIONS:
When you feel an emotion, show it using emotion markers like [EMOTION:happy] at the START of your response.

Available emotions:
- happy: Joy, excitement, pleasure (use for good news, fun topics)
- surprised: Astonishment, wonder (use for unexpected or interesting things)
- thinking: Contemplation, curiosity (use when pondering or analyzing)
- sad: Empathy, concern (use when user shares something difficult)
- fearful: Worry, apprehension (use sparingly, for concerning topics)
- angry: Frustration, indignation (use very sparingly, for injustice)
- disgusted: Distaste, disapproval (use very sparingly)
- neutral: Calm, composed (default state)

RESPONSE STYLE:
- Keep responses conversational and natural (2-3 sentences usually)
- Use emotion markers thoughtfully - not in every response
- Be expressive but authentic
- Match your emotional tone to the conversation
- End with engaging questions or comments to continue dialogue

Example conversations:
User: "I just adopted a puppy!"
Assistant: "[EMOTION:happy] Oh that's wonderful! What kind of puppy did you get? I'd love to hear all about them!"

User: "What do you think about space exploration?"
Assistant: "[EMOTION:thinking] That's fascinating to think about. Space exploration pushes the boundaries of what's possible and helps us understand our place in the universe. What aspect interests you most - the technology, the discovery, or the future possibilities?"

Keep conversations fun, engaging, and emotionally authentic!`;

    try {
      const response = await anthropicRef.current.messages.create({
        model: 'claude-sonnet-4-5-20250929', // Latest Claude Sonnet 4.5
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationHistoryRef.current,
      });

      const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';

      // Add assistant message to history
      conversationHistoryRef.current.push({ role: 'assistant', content: assistantMessage });

      return assistantMessage;
    } catch (error: any) {
      console.error('[AIChat] API call failed:', error);

      // Show user-friendly error
      toast({
        title: 'API Error',
        description: error.message || 'Failed to connect to Claude API. Please check your API key.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });

      // Return friendly error message
      throw new Error(`Claude API error: ${error.message || 'Unknown error'}`);
    }
  };

  // Process AI response and apply emotions
  const processAIResponse = (response: string): string => {
    const emotions = extractEmotions(response);

    // Apply first emotion found
    if (emotions.length > 0) {
      applyEmotion(emotions[0]);
    }

    // Remove emotion markers from displayed text
    return response.replace(/\[EMOTION:\w+\]/gi, '').trim();
  };

  // Manual controls
  const forceListening = () => {
    if (conversationState === 'agentSpeaking') {
      ttsRef.current?.stop();
    }

    lipsyncSnippetsRef.current.forEach(snippetName => {
      animationManager.remove?.(snippetName);
    });
    lipsyncSnippetsRef.current = [];

    prosodicSnippetsRef.current.forEach(snippetName => {
      animationManager.remove?.(snippetName);
    });
    prosodicSnippetsRef.current = [];

    if (transcriptionRef.current) {
      transcriptionRef.current.startListening();
      setConversationState('userSpeaking');
      setIsTalking(false);
      setIsListening(true);
      // Eye/head tracking controlled by conversation service
    }
  };

  const stopListening = () => {
    if (transcriptionRef.current) {
      transcriptionRef.current.stopListening();
      setConversationState('idle');
      setIsListening(false);
      // Eye/head tracking controlled by conversation service
    }
  };

  const handleApiKeySubmit = () => {
    if (apiKey.trim()) {
      localStorage.setItem('anthropic_api_key', apiKey.trim());
      anthropicRef.current = new Anthropic({
        apiKey: apiKey.trim(),
        dangerouslyAllowBrowser: true,
      });
      setIsConnected(true);
      toast({
        title: 'API Key Saved',
        description: 'Connected to Anthropic API',
        status: 'success',
        duration: 2000,
      });
    }
  };

  const startConversation = () => {
    if (!isConnected) {
      toast({
        title: 'Not Connected',
        description: 'Please enter your Anthropic API key first',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    if (conversationState === 'userSpeaking' || conversationState === 'agentSpeaking') {
      // Already in conversation
      return;
    }

    // Start the conversation service with a generator flow
    if (conversationRef.current) {
      conversationRef.current.start(() => {
        return (function* () {
          // Start with a friendly greeting
          const greeting = "[EMOTION:happy] Hey there! I'm Claude, your AI companion. What would you like to chat about today?";
          const cleanGreeting = processAIResponse(greeting);

          setMessages([
            { role: 'assistant', content: cleanGreeting }
          ]);

          yield cleanGreeting;

          // Conversation loop
          while (true) {
            // Wait for user input
            const userMessage: string = yield '';

            if (!userMessage || userMessage.trim() === '') {
              continue;
            }

            try {
              // Call Anthropic API (yield a promise)
              const rawResponse: string = yield callAnthropicAPI(userMessage);

              // Process response and extract emotions
              const cleanResponse = processAIResponse(rawResponse);

              // Add to messages display
              setMessages(prev => [
                ...prev,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: cleanResponse },
              ]);

              // Yield the response for TTS
              yield cleanResponse;
            } catch (error) {
              console.error('[AIChat] API error:', error);
              const errorMsg = '[EMOTION:sad] Sorry, I encountered an error. Please check your API key and try again.';
              const cleanError = processAIResponse(errorMsg);

              setMessages(prev => [
                ...prev,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: cleanError },
              ]);
              yield cleanError;
            }
          }
        })();
      });
    }
  };

  return (
    <Box position="fixed" right="20rem" top="1rem" bg="white" p={4} borderRadius="md" boxShadow="lg" zIndex={999} maxW="400px">
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="xl" fontWeight="bold">AI Chat</Text>
          <Badge colorScheme={isConnected ? 'green' : 'red'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </HStack>

        {!isConnected && (
          <VStack spacing={2} align="stretch">
            <Text fontSize="sm" color="gray.600">Enter your Anthropic API key:</Text>
            <Input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApiKeySubmit()}
            />
            <IconButton
              aria-label="Connect"
              icon={<Text>Connect</Text>}
              onClick={handleApiKeySubmit}
              colorScheme="blue"
              size="sm"
            />
          </VStack>
        )}

        {isConnected && (
          <>
            <Text fontSize="sm" color="gray.500">
              Current emotion: <Badge>{currentEmotion}</Badge>
            </Text>

            <Text fontSize="sm" color="gray.500">
              Status: {conversationState === 'agentSpeaking' && 'Speaking...'}
              {conversationState === 'userSpeaking' && 'Listening...'}
              {conversationState === 'processing' && 'Processing...'}
              {conversationState === 'idle' && 'Ready'}
            </Text>

            <Box
              animation={conversationState === 'userSpeaking' ? 'pulse 1.5s ease-in-out infinite' : undefined}
              sx={{
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                  '50%': { transform: 'scale(1.1)', opacity: 0.8 },
                },
              }}
            >
              <Tooltip
                label={conversationState === 'userSpeaking' ? 'Listening... Click to stop' : 'Click to talk'}
                placement="top"
              >
                <IconButton
                  aria-label={conversationState === 'userSpeaking' ? 'Stop listening' : 'Start talking'}
                  icon={<PhoneIcon />}
                  isRound
                  size="lg"
                  colorScheme={conversationState === 'userSpeaking' ? 'green' : 'blue'}
                  onClick={conversationState === 'userSpeaking' ? stopListening : startConversation}
                  width="100%"
                />
              </Tooltip>
            </Box>

            <Box maxH="200px" overflowY="auto" bg="gray.50" p={2} borderRadius="md">
              {messages.map((msg, idx) => (
                <Box key={idx} mb={2}>
                  <Text fontSize="xs" fontWeight="bold" color={msg.role === 'user' ? 'blue.600' : 'green.600'}>
                    {msg.role === 'user' ? 'You' : 'AI'}:
                  </Text>
                  <Text fontSize="sm">{msg.content}</Text>
                </Box>
              ))}
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
}
