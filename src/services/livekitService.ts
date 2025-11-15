/**
 * LiveKit Service
 * Handles real-time audio/video communication with the backend
 */

import { Room, RoomEvent, Track, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';

export interface LiveKitConfig {
  url: string;
  token: string;
  roomName: string;
}

export interface LiveKitCallbacks {
  onTrackSubscribed?: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
  onTrackUnsubscribed?: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onError?: (error: Error) => void;
}

export class LiveKitService {
  private room: Room | null = null;
  private config: LiveKitConfig | null = null;
  private callbacks: LiveKitCallbacks = {};

  constructor(callbacks: LiveKitCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to a LiveKit room
   */
  async connect(config: LiveKitConfig): Promise<void> {
    if (this.room) {
      console.warn('[LiveKitService] Already connected');
      return;
    }

    this.config = config;
    this.room = new Room();

    // Set up event listeners
    this.setupEventListeners();

    try {
      console.log('[LiveKitService] Connecting to room:', config.roomName);

      await this.room.connect(config.url, config.token);

      console.log('[LiveKitService] Connected successfully');
    } catch (error) {
      console.error('[LiveKitService] Connection error:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from the room
   */
  disconnect(): void {
    if (!this.room) return;

    console.log('[LiveKitService] Disconnecting');

    this.room.disconnect();
    this.room = null;
    this.config = null;
  }

  /**
   * Enable/disable local audio
   */
  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room');
    }

    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  /**
   * Enable/disable local video
   */
  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room');
    }

    await this.room.localParticipant.setCameraEnabled(enabled);
  }

  /**
   * Get the Room instance
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.room?.state === 'connected';
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.room) return;

    // Track subscribed
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[LiveKitService] Track subscribed:', track.kind);

      // Auto-attach audio tracks
      if (track.kind === Track.Kind.Audio) {
        const audioElement = track.attach();
        document.body.appendChild(audioElement);
      }

      this.callbacks.onTrackSubscribed?.(track, publication, participant);
    });

    // Track unsubscribed
    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('[LiveKitService] Track unsubscribed:', track.kind);

      // Detach audio tracks
      if (track.kind === Track.Kind.Audio) {
        track.detach();
      }

      this.callbacks.onTrackUnsubscribed?.(track, publication, participant);
    });

    // Disconnected
    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKitService] Disconnected');
      this.callbacks.onDisconnected?.();
    });

    // Reconnecting
    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('[LiveKitService] Reconnecting...');
      this.callbacks.onReconnecting?.();
    });

    // Reconnected
    this.room.on(RoomEvent.Reconnected, () => {
      console.log('[LiveKitService] Reconnected');
      this.callbacks.onReconnected?.();
    });

    // Connection quality changed
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      console.log('[LiveKitService] Connection quality:', quality, participant.identity);
    });
  }
}

/**
 * Factory function to create LiveKit service
 */
export function createLiveKitService(callbacks?: LiveKitCallbacks): LiveKitService {
  return new LiveKitService(callbacks);
}
