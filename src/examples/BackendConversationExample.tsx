/**
 * Complete example of using the integrated backend conversation service
 *
 * This demonstrates:
 * - Starting a conversation with LiveKit
 * - Handling SSE events
 * - Sending messages
 * - Managing state
 * - Error handling
 */

import { useEffect, useState, useRef } from 'react';
import { Box, Button, VStack, HStack, Text, Input, Badge } from '@chakra-ui/react';
import { createIntegratedConversationService } from '../services/integratedConversationService';
import type { IntegratedConversationService } from '../services/integratedConversationService';

interface Message {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

export function BackendConversationExample() {
  const [conversation, setConversation] = useState<IntegratedConversationService | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [state, setState] = useState<string>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize conversation service
  useEffect(() => {
    const conv = createIntegratedConversationService(
      {
        backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
        userId: `user-${Date.now()}`,
      },
      {
        onAgentSpeaking: (text) => {
          console.log('[Agent Speaking]:', text);
          addMessage('agent', text);
        },
        onAgentFinished: () => {
          console.log('[Agent Finished]');
        },
        onUserSpeaking: () => {
          console.log('[User Speaking]');
        },
        onTranscription: (text, isFinal, isInterruption) => {
          console.log('[Transcription]:', { text, isFinal, isInterruption });
          if (isFinal) {
            addMessage('user', text);
          }
        },
        onStateChange: (newState) => {
          console.log('[State Change]:', newState);
          setState(newState);
        },
        onError: (err) => {
          console.error('[Conversation Error]:', err);
          setError(err.message);
        },
      }
    );

    setConversation(conv);

    return () => {
      conv.stop();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'user' | 'agent' | 'system', content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleStart = async () => {
    if (!conversation) {
      setError('Conversation service not initialized');
      return;
    }

    try {
      setError(null);
      addMessage('system', 'Starting conversation...');

      await conversation.start(
        'You are a friendly and helpful AI assistant. Keep your responses concise and engaging.'
      );

      const sid = conversation.getSessionId();
      setSessionId(sid);
      setIsActive(true);

      addMessage('system', `Conversation started (Session: ${sid})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
      console.error('Error starting conversation:', err);
    }
  };

  const handleStop = async () => {
    if (!conversation) return;

    try {
      setError(null);
      addMessage('system', 'Stopping conversation...');

      await conversation.stop();

      setIsActive(false);
      setSessionId(null);

      addMessage('system', 'Conversation stopped');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop conversation');
      console.error('Error stopping conversation:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!conversation || !inputText.trim()) return;

    try {
      setError(null);
      const message = inputText.trim();
      setInputText('');

      addMessage('user', message);
      await conversation.sendMessage(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Error sending message:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStateBadgeColor = (state: string) => {
    switch (state) {
      case 'idle':
        return 'gray';
      case 'agentSpeaking':
        return 'blue';
      case 'userSpeaking':
        return 'green';
      case 'processing':
        return 'orange';
      default:
        return 'gray';
    }
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <Box>
          <Text fontSize="2xl" fontWeight="bold" mb={2}>
            Backend Conversation Example
          </Text>
          <HStack spacing={3}>
            <Badge colorScheme={isActive ? 'green' : 'red'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge colorScheme={getStateBadgeColor(state)}>{state}</Badge>
            {sessionId && (
              <Text fontSize="sm" color="gray.600">
                Session: {sessionId.slice(0, 8)}...
              </Text>
            )}
          </HStack>
        </Box>

        {/* Error Display */}
        {error && (
          <Box bg="red.50" color="red.800" p={3} borderRadius="md">
            <Text fontWeight="bold">Error:</Text>
            <Text fontSize="sm">{error}</Text>
          </Box>
        )}

        {/* Controls */}
        <HStack spacing={3}>
          <Button
            colorScheme="green"
            onClick={handleStart}
            isDisabled={isActive}
          >
            Start Conversation
          </Button>
          <Button
            colorScheme="red"
            onClick={handleStop}
            isDisabled={!isActive}
          >
            Stop Conversation
          </Button>
        </HStack>

        {/* Messages */}
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          p={4}
          h="500px"
          overflowY="auto"
          bg="gray.50"
        >
          <VStack spacing={3} align="stretch">
            {messages.length === 0 && (
              <Text color="gray.500" textAlign="center">
                No messages yet. Start a conversation to begin.
              </Text>
            )}

            {messages.map((msg, i) => (
              <Box
                key={i}
                bg={
                  msg.role === 'user'
                    ? 'blue.100'
                    : msg.role === 'agent'
                    ? 'green.100'
                    : 'gray.200'
                }
                p={3}
                borderRadius="md"
                alignSelf={
                  msg.role === 'user'
                    ? 'flex-end'
                    : msg.role === 'agent'
                    ? 'flex-start'
                    : 'center'
                }
                maxW={msg.role === 'system' ? '100%' : '80%'}
              >
                <Text fontWeight="bold" fontSize="sm" mb={1}>
                  {msg.role === 'user'
                    ? 'You'
                    : msg.role === 'agent'
                    ? 'Agent'
                    : 'System'}
                </Text>
                <Text>{msg.content}</Text>
                <Text fontSize="xs" color="gray.600" mt={1}>
                  {msg.timestamp.toLocaleTimeString()}
                </Text>
              </Box>
            ))}

            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        {/* Input */}
        <HStack>
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            isDisabled={!isActive}
          />
          <Button
            colorScheme="blue"
            onClick={handleSendMessage}
            isDisabled={!isActive || !inputText.trim()}
          >
            Send
          </Button>
        </HStack>

        {/* Info */}
        <Box bg="blue.50" p={4} borderRadius="md">
          <Text fontWeight="bold" mb={2}>
            How to use:
          </Text>
          <VStack align="start" spacing={1} fontSize="sm">
            <Text>1. Click "Start Conversation" to begin</Text>
            <Text>2. Type a message and press Enter or click Send</Text>
            <Text>3. The agent will respond via the backend</Text>
            <Text>4. Events are streamed in real-time via SSE</Text>
            <Text>5. Audio can be enabled via LiveKit (check console)</Text>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
