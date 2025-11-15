import React, { useState, useEffect, useRef } from 'react';
import { Box, VStack, Text, Progress, IconButton, Tooltip, HStack, Badge } from '@chakra-ui/react';
import { PhoneIcon } from '@chakra-ui/icons';
import { ModuleSettings } from '../../types/modules';
import { createTTSService } from '../../latticework/tts';
import { createTranscriptionService } from '../../latticework/transcription';
import { createLipSyncService } from '../../latticework/lipsync';
import { createConversationService } from '../../latticework/conversation';
import { createEyeHeadTrackingService } from '../../latticework/eyeHeadTracking';
import type { TTSService } from '../../latticework/tts/ttsService';
import type { TranscriptionService } from '../../latticework/transcription/transcriptionService';
import type { LipSyncService } from '../../latticework/lipsync/lipSyncService';
import type { ConversationService } from '../../latticework/conversation/conversationService';
import type { EyeHeadTrackingService } from '../../latticework/eyeHeadTracking/eyeHeadTrackingService';
import type { ConversationFlow } from '../../latticework/conversation/types';
import { frenchQuestions } from './frenchQuestions';
import WelcomeModal from './WelcomeModal';
import FinishModal from './FinishModal';
import { getJawAmountForViseme, getARKitVisemeIndex } from '../../latticework/lipsync/visemeToARKit';
import { useModulesContext } from '../../context/ModulesContext';

interface FrenchQuizAppProps {
  animationManager: any;
  settings: ModuleSettings;
  toast: any;
}

export default function FrenchQuizApp({ animationManager, settings, toast }: FrenchQuizAppProps) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showFinish, setShowFinish] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [conversationState, setConversationState] = useState<string>('idle');
  const [lastFeedback, setLastFeedback] = useState('');

  // Get global modules context
  const { setIsTalking, setIsListening, setSpeakingText, setTranscribedText } = useModulesContext();

  // Service references
  const ttsRef = useRef<TTSService | null>(null);
  const transcriptionRef = useRef<TranscriptionService | null>(null);
  const lipSyncRef = useRef<LipSyncService | null>(null);
  const conversationRef = useRef<ConversationService | null>(null);
  const eyeHeadTrackingRef = useRef<EyeHeadTrackingService | null>(null);
  const userToastRef = useRef<any>(null);

  // Quiz state refs (for use in generator)
  const questionIndexRef = useRef(0);
  const correctAnswersRef = useRef(0);

  // Track snippets for cleanup (separate by category)
  const lipsyncSnippetsRef = useRef<string[]>([]); // LipSync: visemes + jaw
  const prosodicSnippetsRef = useRef<string[]>([]); // Prosodic: brow raises, head nods
  const wordIndexRef = useRef(0); // Track word count for prosodic patterns

  // Eye/head tracking is now fully autonomous - controlled by conversation service

  // Initialize services once
  useEffect(() => {
    if (!animationManager) {
      console.warn('[FrenchQuiz] No animation manager provided');
      return;
    }

    // Create Eye/Head Tracking service
    eyeHeadTrackingRef.current = createEyeHeadTrackingService({
      eyeTrackingEnabled: true,
      headTrackingEnabled: true,
      headFollowEyes: true,
      idleVariation: true,
      idleVariationInterval: 3000,
      eyeBlinkRate: 15,
      eyeSaccadeSpeed: 0.2,
      eyeSmoothPursuit: true,
      headFollowDelay: 200,
      headSpeed: 0.3,
      lookAtSpeaker: true,
    });

    console.log('[FrenchQuiz] Starting eye/head tracking');
    eyeHeadTrackingRef.current.start();

    // Create LipSync service for phoneme extraction
    lipSyncRef.current = createLipSyncService(
      {
        engine: 'webSpeech',
        onsetIntensity: 90,
        holdMs: 100,
        speechRate: 0.9,
        jawActivation: 1.5,
        lipsyncIntensity: 1.0,
      },
      {}
    );

    // Create TTS service with French voice and lip-sync integration
    ttsRef.current = createTTSService(
      {
        engine: 'webSpeech',
        rate: 0.9,
        pitch: 0.9,
        volume: 1.0,
        voiceName: 'Thomas', // Male French voice
      },
      {
        onStart: () => {
          console.log('[FrenchQuiz] TTS started');
          wordIndexRef.current = 0;

          // Clear previous snippets from both categories
          lipsyncSnippetsRef.current = [];
          prosodicSnippetsRef.current = [];

          animationManager.play?.();
        },
        onEnd: () => {
          console.log('[FrenchQuiz] TTS ended');

          // Remove all snippets from both categories
          if (animationManager) {
            // Remove LipSync snippets (visemes + jaw)
            lipsyncSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            lipsyncSnippetsRef.current = [];

            // Remove Prosodic snippets (brow raises, head nods)
            prosodicSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            prosodicSnippetsRef.current = [];

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

            // Add jaw closure (AU 26)
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

            // Remove neutral snippet after it completes
            setTimeout(() => {
              animationManager.remove?.(neutralSnippet);
            }, 350);
          }
        },
        onBoundary: ({ word }) => {
          console.log(`[FrenchQuiz] Word boundary: "${word}"`);

          // Extract visemes for this word using phoneme extraction
          if (lipSyncRef.current && word && animationManager) {
            const visemeTimeline = lipSyncRef.current.extractVisemeTimeline(word);
            console.log(`[FrenchQuiz] Extracted ${visemeTimeline.length} visemes for "${word}"`);

            // Create combined curves for both visemes AND jaw in ONE snippet
            const combinedCurves: Record<string, Array<{ time: number; intensity: number }>> = {};
            const lipsyncIntensity = 1.0;
            const jawActivation = 1.5;

            // Process each viseme and add both viseme and jaw curves
            visemeTimeline.forEach((visemeEvent) => {
              // Convert SAPI viseme ID to ARKit viseme index (0-14) for proper morph mapping
              const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
              const visemeId = arkitIndex.toString();
              const timeInSec = visemeEvent.offsetMs / 1000;
              const durationInSec = visemeEvent.durationMs / 1000;

              // Smoother, more natural timing with anticipation
              const anticipation = durationInSec * 0.1; // Small anticipation
              const attack = durationInSec * 0.25; // Attack to peak
              const sustain = durationInSec * 0.45; // Hold at peak

              // Initialize curve array if needed
              if (!combinedCurves[visemeId]) {
                combinedCurves[visemeId] = [];
              }

              // Check if previous viseme was same - if so, don't go to zero
              const lastKeyframe = combinedCurves[visemeId][combinedCurves[visemeId].length - 1];
              const startIntensity = (lastKeyframe && lastKeyframe.time > timeInSec - 0.02)
                ? lastKeyframe.intensity
                : 0;

              // Viseme animation with smooth, natural motion
              combinedCurves[visemeId].push(
                { time: timeInSec, intensity: startIntensity }, // Start from previous or zero
                { time: timeInSec + anticipation, intensity: 30 * lipsyncIntensity }, // Gentle anticipation
                { time: timeInSec + attack, intensity: 95 * lipsyncIntensity }, // Quick to peak
                { time: timeInSec + sustain, intensity: 100 * lipsyncIntensity }, // Hold at peak
                { time: timeInSec + durationInSec, intensity: 0 } // Smooth release
              );

              // Add jaw activation coordinated with viseme
              const jawAmount = getJawAmountForViseme(visemeEvent.visemeId);
              if (jawAmount > 0.05) { // Only animate jaw if significant movement
                if (!combinedCurves['26']) {
                  combinedCurves['26'] = [];
                }

                // Jaw moves slower and smoother than lips
                const jawAnticipation = durationInSec * 0.15;
                const jawAttack = durationInSec * 0.3;
                const jawSustain = durationInSec * 0.4;

                const lastJawKeyframe = combinedCurves['26'][combinedCurves['26'].length - 1];
                const startJawIntensity = (lastJawKeyframe && lastJawKeyframe.time > timeInSec - 0.02)
                  ? lastJawKeyframe.intensity
                  : 0;

                combinedCurves['26'].push(
                  { time: timeInSec, intensity: startJawIntensity },
                  { time: timeInSec + jawAnticipation, intensity: jawAmount * 20 * jawActivation }, // Gentle start
                  { time: timeInSec + jawAttack, intensity: jawAmount * 90 * jawActivation }, // Rise to peak
                  { time: timeInSec + jawSustain, intensity: jawAmount * 100 * jawActivation }, // Hold
                  { time: timeInSec + durationInSec, intensity: 0 } // Smooth close
                );
              }
            });

            // Calculate max time with neutral hold
            const lastVisemeEndTime = visemeTimeline.length > 0
              ? Math.max(...visemeTimeline.map(v => (v.offsetMs + v.durationMs) / 1000))
              : 0;
            const maxTime = lastVisemeEndTime + 0.05; // Short 50ms neutral hold

            // Create a SINGLE snippet with both visemes and jaw
            const snippetName = `lipsync:${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

            animationManager.schedule?.({
              name: snippetName,
              curves: combinedCurves,
              maxTime,
              loop: false,
              snippetCategory: 'combined', // Combined visemes + AU
              snippetPriority: 50,
              snippetPlaybackRate: 0.9,
              snippetIntensityScale: 1.0,
            });

            // Track snippet for cleanup (LipSync agency)
            lipsyncSnippetsRef.current.push(snippetName);
            console.log(`[FrenchQuiz] Scheduled snippet "${snippetName}" with ${Object.keys(combinedCurves).length} curves, duration: ${maxTime.toFixed(3)}s`);
          }

          // === PROSODIC EXPRESSION AGENCY (SEPARATE FROM LIP-SYNC) ===
          // Varied prosodic gestures for natural speech emphasis
          if (animationManager) {
            const wordMod = wordIndexRef.current % 6;

            // Pattern 1: Brow raise + subtle head tilt (every 3 words)
            if (wordMod === 0) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:emphasis_${gestureTime}`;
              animationManager.schedule?.({
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
              animationManager.schedule?.({
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
                snippetIntensityScale: 0.9,
              });
              prosodicSnippetsRef.current.push(gestureName);
              console.log(`[Prosodic] Head nod "${gestureName}"`);
            }

            // Pattern 3: Subtle frown for contemplative tone (every 5 words)
            else if (wordMod === 4) {
              const gestureTime = Date.now();
              const gestureName = `prosodic:contemplate_${gestureTime}`;
              animationManager.schedule?.({
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
          console.error('[FrenchQuiz] TTS error:', error);
          toast({
            title: 'Speech Error',
            description: 'Could not speak',
            status: 'error',
            duration: 3000,
          });
        },
      }
    );

    // Create Transcription service
    transcriptionRef.current = createTranscriptionService(
      {
        lang: 'en-US',
        continuous: true, // Enable continuous mode for better reliability
        interimResults: true,
        agentFilteringEnabled: true, // Filter out agent echo
      },
      {
        onError: (error) => {
          console.error('[FrenchQuiz] Transcription error:', error);

          // Auto-retry on network errors
          if (error.message.includes('network') || error.message.includes('no-speech')) {
            console.log('[FrenchQuiz] Auto-retrying transcription...');
            setTimeout(() => {
              if (conversationState === 'userSpeaking') {
                transcriptionRef.current?.startListening();
              }
            }, 500);
          } else {
            toast({
              title: 'Listening Error',
              description: 'Could not hear you. Click mic to retry.',
              status: 'error',
              duration: 3000,
            });
          }
        },
        onEnd: () => {
          console.log('[FrenchQuiz] Transcription ended');
          // If we're still supposed to be listening, restart
          if (conversationState === 'userSpeaking') {
            console.log('[FrenchQuiz] Restarting listening after unexpected end');
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
        eyeHeadTracking: eyeHeadTrackingRef.current, // Conversation service handles gaze coordination
      },
      {
        onUserSpeech: (text, isFinal, isInterruption) => {
          updateUserToast(text, isFinal, isInterruption);

          // If user is interrupting, stop TTS immediately
          if (isInterruption && conversationState === 'agentSpeaking') {
            console.log('[FrenchQuiz] User interrupting - stopping TTS');
            ttsRef.current?.stop();

            // Clean up lip sync snippets
            lipsyncSnippetsRef.current.forEach(snippetName => {
              animationManager.remove?.(snippetName);
            });
            lipsyncSnippetsRef.current = [];
          }

          // Update global context with transcribed text
          if (isFinal) {
            setTranscribedText(text);
          }
        },
        onAgentUtterance: (text) => {
          // Update global context with speaking text
          setSpeakingText(text);

          toast({
            title: 'Agent',
            description: text,
            status: 'info',
            duration: 3000,
          });
        },
        onStateChange: (state) => {
          console.log('[FrenchQuiz] State:', state);
          setConversationState(state);

          // Update global talking/listening state
          const isTalking = state === 'agentSpeaking';
          const isListening = state === 'userSpeaking';

          setIsTalking(isTalking);
          setIsListening(isListening);

          // Eye/head tracking now handled by conversation service

          // If transitioning from speaking to idle, clean up all snippets
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

          // Clear speaking text when done talking
          if (!isTalking) {
            setSpeakingText(null);
          }
        },
        onError: (error) => {
          console.error('[FrenchQuiz] Conversation error:', error);
        },
      }
    );

    return () => {
      conversationRef.current?.stop();
      ttsRef.current?.dispose();
      transcriptionRef.current?.dispose();
      eyeHeadTrackingRef.current?.dispose();

      // Reset global context
      setIsTalking(false);
      setIsListening(false);
      setSpeakingText(null);
      setTranscribedText(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationManager, toast]);

  // Update user speech toast
  const updateUserToast = (text: string, isFinal: boolean, isInterruption: boolean) => {
    const title = isInterruption
      ? isFinal
        ? 'You (interrupting - final)'
        : 'You (interrupting...)'
      : isFinal
      ? 'You (final)'
      : 'You (listening...)';

    if (isFinal) {
      if (userToastRef.current && toast.update) {
        toast.update(userToastRef.current, {
          title,
          description: text,
          status: isInterruption ? 'warning' : 'success',
          duration: 2500,
          isClosable: true,
        });
      }
      userToastRef.current = null;
    } else {
      if (!userToastRef.current) {
        userToastRef.current = toast({
          title,
          description: text,
          status: isInterruption ? 'warning' : 'info',
          duration: null,
          isClosable: false,
        });
      } else if (toast.update) {
        toast.update(userToastRef.current, {
          title,
          description: text,
        });
      }
    }
  };

  // French quiz generator function
  const createQuizFlow = (): ConversationFlow => {
    return (function* () {
      // Welcome
      yield 'Commençons le quiz de vocabulaire en français !';

      // Quiz loop
      while (questionIndexRef.current < frenchQuestions.length) {
        const question = frenchQuestions[questionIndexRef.current];
        const questionText = `Que veut dire ${question.french} en anglais ?`;

        // Ask question
        const userAnswer: string = yield questionText;

        // Check answer
        const userAns = userAnswer.trim().toLowerCase();
        const correctAns = question.english.toLowerCase();

        let feedback = '';
        if (userAns.includes(correctAns) || correctAns.includes(userAns)) {
          correctAnswersRef.current++;
          setCorrectAnswers(correctAnswersRef.current);
          feedback = 'Correct !';
          console.log('✓ Correct!');
        } else {
          feedback = `Incorrect. La réponse correcte est: ${question.english}`;
          console.log(`✗ Incorrect. Answer: ${question.english}`);
        }

        setLastFeedback(feedback);
        questionIndexRef.current++;
        setCurrentQuestionIndex(questionIndexRef.current);

        // Give feedback
        yield feedback;
      }

      // End quiz
      const finalMessage = `Vous avez terminé le quiz ! Vous avez obtenu ${correctAnswersRef.current} bonnes réponses sur ${frenchQuestions.length}.`;
      yield finalMessage;

      // Show finish modal
      setShowFinish(true);

      return 'Quiz terminé!';
    })();
  };

  // Start quiz
  const startQuiz = () => {
    setShowWelcome(false);
    questionIndexRef.current = 0;
    correctAnswersRef.current = 0;
    setCurrentQuestionIndex(0);
    setCorrectAnswers(0);
    setLastFeedback('');

    console.log('[FrenchQuiz] Starting quiz...');
    conversationRef.current?.start(createQuizFlow);
  };

  // Manual control: Stop agent speaking and start listening
  const forceListening = () => {
    console.log('[FrenchQuiz] Force listening - stopping speech');

    // Stop TTS if speaking
    if (conversationState === 'agentSpeaking') {
      ttsRef.current?.stop();
    }

    // Clean up all animation snippets
    lipsyncSnippetsRef.current.forEach(snippetName => {
      animationManager.remove?.(snippetName);
    });
    lipsyncSnippetsRef.current = [];

    prosodicSnippetsRef.current.forEach(snippetName => {
      animationManager.remove?.(snippetName);
    });
    prosodicSnippetsRef.current = [];

    // Start listening
    if (transcriptionRef.current) {
      transcriptionRef.current.startListening();
      setConversationState('userSpeaking');

      // Update tracking
      setIsTalking(false);
      setIsListening(true);
      if (eyeHeadTrackingRef.current) {
        eyeHeadTrackingRef.current.setSpeaking(false);
        eyeHeadTrackingRef.current.setListening(true);
      }
    }
  };

  // Manual control: Stop listening
  const stopListening = () => {
    console.log('[FrenchQuiz] Stop listening');

    if (transcriptionRef.current) {
      transcriptionRef.current.stopListening();
      setConversationState('idle');

      // Update tracking
      setIsListening(false);
      if (eyeHeadTrackingRef.current) {
        eyeHeadTrackingRef.current.setListening(false);
      }
    }
  };

  const currentQuestion = frenchQuestions[currentQuestionIndex] || frenchQuestions[0];

  return (
    <Box>
      {showWelcome && <WelcomeModal isOpen={true} onClose={startQuiz} />}

      {showFinish && (
        <FinishModal
          isOpen={true}
          onClose={() => {
            setShowFinish(false);
            setShowWelcome(true);
          }}
        />
      )}

      {!showWelcome && !showFinish && (
        <Box
          position="fixed"
          bottom="20px"
          left="50%"
          transform="translateX(-50%)"
          bg="white"
          p={6}
          borderRadius="md"
          boxShadow="lg"
          minWidth="400px"
          zIndex={1000}
        >
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="center">
              <Text fontSize="sm" color="gray.600">
                Question {currentQuestionIndex + 1} of {frenchQuestions.length}
              </Text>

            </HStack>

            <Progress
              value={((currentQuestionIndex + 1) / frenchQuestions.length) * 100}
              colorScheme="blue"
              size="sm"
            />

            <Text fontSize="lg" fontWeight="bold">
              Que veut dire "{currentQuestion.french}" en anglais ?
            </Text>

            <Text fontSize="sm" color="gray.500">
              Status:{' '}
              {conversationState === 'agentSpeaking' && 'Speaking question...'}
              {conversationState === 'userSpeaking' && 'Listening for your answer...'}
              {conversationState === 'processing' && 'Processing...'}
              {conversationState === 'idle' && 'Ready'}
            </Text>

            {/* Manual Control - Mic Icon */}
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
                label={
                  conversationState === 'userSpeaking'
                    ? 'Listening... Click to stop'
                    : 'Click to listen'
                }
                placement="top"
              >
                <IconButton
                  aria-label={conversationState === 'userSpeaking' ? 'Stop listening' : 'Start listening'}
                  icon={<PhoneIcon />}
                  isRound
                  size="lg"
                  colorScheme={conversationState === 'userSpeaking' ? 'green' : 'gray'}
                  onClick={conversationState === 'userSpeaking' ? stopListening : forceListening}
                />
              </Tooltip>
            </Box>

            {lastFeedback && (
              <Text fontSize="md" color="blue.600" fontWeight="semibold">
                {lastFeedback}
              </Text>
            )}

            <Text fontSize="sm" color="gray.600">
              Score: {correctAnswers} / {Math.max(currentQuestionIndex, 1)}
            </Text>
          </VStack>
        </Box>
      )}
    </Box>
  );
}
