/**
 * Backend Service
 * Handles communication with the Python FastAPI backend
 */

export interface BackendConfig {
  baseUrl: string;
}

export interface StartConversationRequest {
  user_id?: string;
  initial_context?: string;
  enable_livekit?: boolean;
}

export interface StartConversationResponse {
  session_id: string;
  livekit_token?: string;
  livekit_room_name?: string;
}

export interface SendMessageRequest {
  session_id: string;
  content: string;
  is_interruption?: boolean;
}

export interface SendMessageResponse {
  session_id: string;
  message_id: string;
  state: string;
}

export interface ConversationEvent {
  event_type: string;
  session_id: string;
  timestamp: string;
  [key: string]: any;
}

export class BackendService {
  private baseUrl: string;
  private eventSource: EventSource | null = null;

  constructor(config: BackendConfig) {
    this.baseUrl = config.baseUrl;
  }

  /**
   * Start a new conversation session
   */
  async startConversation(request: StartConversationRequest): Promise<StartConversationResponse> {
    const response = await fetch(`${this.baseUrl}/api/conversation/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to start conversation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await fetch(`${this.baseUrl}/api/conversation/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Stop a conversation session
   */
  async stopConversation(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/conversation/session/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to stop conversation: ${response.statusText}`);
    }
  }

  /**
   * Subscribe to conversation events via SSE
   */
  subscribeToEvents(
    sessionId: string,
    onEvent: (event: ConversationEvent) => void,
    onError?: (error: Event) => void
  ): void {
    // Close existing connection
    this.unsubscribeFromEvents();

    // Create new EventSource
    this.eventSource = new EventSource(`${this.baseUrl}/api/events/${sessionId}`);

    // Handle messages
    this.eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (error) {
        console.error('[BackendService] Error parsing SSE event:', error);
      }
    });

    // Handle errors
    this.eventSource.addEventListener('error', (event) => {
      console.error('[BackendService] SSE error:', event);
      onError?.(event);
    });

    console.log('[BackendService] Subscribed to events for session:', sessionId);
  }

  /**
   * Unsubscribe from conversation events
   */
  unsubscribeFromEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[BackendService] Unsubscribed from events');
    }
  }

  /**
   * Get LiveKit token
   */
  async getLiveKitToken(
    identity: string,
    roomName: string,
    participantName?: string
  ): Promise<{ token: string; url: string }> {
    const response = await fetch(`${this.baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity,
        room_name: roomName,
        participant_name: participantName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get LiveKit token: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Factory function to create backend service
 */
export function createBackendService(baseUrl: string): BackendService {
  return new BackendService({ baseUrl });
}
