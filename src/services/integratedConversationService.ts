/**
 * Integrated Conversation Service
 * Combines local conversation service with backend LiveKit + MCP integration
 */

import { createBackendService, BackendService, ConversationEvent } from './backendService';
import { createLiveKitService, LiveKitService } from './livekitService';
import { createMCPService, MCPService } from './mcpService';

export interface IntegratedConversationConfig {
  backendUrl: string;
  enableLiveKit?: boolean;
  userId?: string;
}

export interface IntegratedConversationCallbacks {
  onAgentSpeaking?: (text: string) => void;
  onAgentFinished?: () => void;
  onUserSpeaking?: () => void;
  onTranscription?: (text: string, isFinal: boolean, isInterruption: boolean) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
}

export class IntegratedConversationService {
  private backend: BackendService;
  private livekit: LiveKitService;
  private mcp: MCPService;
  private callbacks: IntegratedConversationCallbacks;

  private sessionId: string | null = null;
  private isRunning = false;

  constructor(config: IntegratedConversationConfig, callbacks: IntegratedConversationCallbacks = {}) {
    this.backend = createBackendService(config.backendUrl);
    this.livekit = createLiveKitService({
      onError: (error) => callbacks.onError?.(error),
    });
    this.mcp = createMCPService(config.backendUrl);
    this.callbacks = callbacks;
  }

  /**
   * Start a conversation session
   */
  async start(initialContext?: string): Promise<void> {
    if (this.isRunning) {
      console.warn('[IntegratedConversationService] Already running');
      return;
    }

    try {
      console.log('[IntegratedConversationService] Starting conversation');

      // Start conversation on backend
      const response = await this.backend.startConversation({
        initial_context: initialContext,
        enable_livekit: true,
      });

      this.sessionId = response.session_id;

      console.log('[IntegratedConversationService] Session started:', this.sessionId);

      // Connect to LiveKit if enabled
      if (response.livekit_token && response.livekit_room_name) {
        await this.livekit.connect({
          url: 'wss://your-livekit-server.livekit.cloud', // From backend config
          token: response.livekit_token,
          roomName: response.livekit_room_name,
        });

        // Enable microphone
        await this.livekit.setMicrophoneEnabled(true);
      }

      // Subscribe to SSE events
      this.backend.subscribeToEvents(
        this.sessionId,
        (event) => this.handleEvent(event),
        (error) => this.callbacks.onError?.(new Error('SSE error'))
      );

      this.isRunning = true;

      console.log('[IntegratedConversationService] Started successfully');
    } catch (error) {
      console.error('[IntegratedConversationService] Error starting:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop the conversation
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[IntegratedConversationService] Stopping');

    try {
      // Stop backend session
      if (this.sessionId) {
        await this.backend.stopConversation(this.sessionId);
      }

      // Unsubscribe from events
      this.backend.unsubscribeFromEvents();

      // Disconnect from LiveKit
      this.livekit.disconnect();

      this.isRunning = false;
      this.sessionId = null;

      console.log('[IntegratedConversationService] Stopped');
    } catch (error) {
      console.error('[IntegratedConversationService] Error stopping:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Send a message
   */
  async sendMessage(text: string, isInterruption = false): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    try {
      await this.backend.sendMessage({
        session_id: this.sessionId,
        content: text,
        is_interruption: isInterruption,
      });
    } catch (error) {
      console.error('[IntegratedConversationService] Error sending message:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Handle SSE events from backend
   */
  private handleEvent(event: ConversationEvent): void {
    console.log('[IntegratedConversationService] Event:', event.event_type);

    switch (event.event_type) {
      case 'agent_speaking':
        this.callbacks.onAgentSpeaking?.(event.text);
        break;

      case 'agent_finished':
        this.callbacks.onAgentFinished?.();
        break;

      case 'user_speaking':
        this.callbacks.onUserSpeaking?.();
        break;

      case 'transcription':
        this.callbacks.onTranscription?.(
          event.text,
          event.is_final,
          event.is_interruption || false
        );
        break;

      case 'state_change':
        this.callbacks.onStateChange?.(event.new_state);
        break;

      case 'error':
        this.callbacks.onError?.(new Error(event.error_message));
        break;

      default:
        console.warn('[IntegratedConversationService] Unknown event type:', event.event_type);
    }
  }

  /**
   * Get MCP service for tool calls
   */
  getMCPService(): MCPService {
    return this.mcp;
  }

  /**
   * Get LiveKit service
   */
  getLiveKitService(): LiveKitService {
    return this.livekit;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Factory function
 */
export function createIntegratedConversationService(
  config: IntegratedConversationConfig,
  callbacks?: IntegratedConversationCallbacks
): IntegratedConversationService {
  return new IntegratedConversationService(config, callbacks);
}
