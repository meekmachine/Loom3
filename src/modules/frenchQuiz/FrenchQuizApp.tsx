import React, { useState, useEffect, useRef } from 'react';
import { Box, VStack, Text, Progress, IconButton, Tooltip, HStack, Badge } from '@chakra-ui/react';
import { PhoneIcon } from '@chakra-ui/icons';
import { ModuleSettings } from '../../types/modules';
import { createTTSService } from '../../latticework/tts';
import { createTranscriptionService } from '../../latticework/transcription';
import { LipSyncService } from '../../latticework/lipsync';
import { createConversationService } from '../../latticework/conversation';
import { createEyeHeadTrackingService } from '../../latticework/eyeHeadTracking';
import type { TTSService } from '../../latticework/tts/ttsService';
import type { TranscriptionService } from '../../latticework/transcription/transcriptionService';
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
    lipSyncRef.current = new LipSyncService(
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

    // Create TTS service with French voice
    // TTS service now coordinates LipSync and Prosodic agencies internally
    ttsRef.current = createTTSService(
      {
        engine: 'webSpeech',
        rate: 0.9,
        pitch: 0.9,
        volume: 1.0,
        voiceName: 'Thomas', // Male French voice

        // Agency coordination - TTS now manages these
        lipSyncService: lipSyncRef.current,
        animationManager: animationManager,
        prosodicEnabled: true,
      },
      {
        onStart: () => {
          console.log('[FrenchQuiz] TTS started');
          // TTS service now handles snippet cleanup and animation play
        },
        onEnd: () => {
          console.log('[FrenchQuiz] TTS ended');
          // TTS service now handles all cleanup
        },
        onBoundary: ({ word }) => {
          // TTS service now handles all lip sync and prosodic coordination
          console.log(`[FrenchQuiz] Word: "${word}" (coordinated by TTS service)`);
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
