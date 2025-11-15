# Backend Integration Guide

This guide explains how to integrate the LoomLarge frontend with the new Python backend.

## Architecture Overview

```
┌─────────────────┐         SSE Events          ┌─────────────────┐
│                 │◄───────────────────────────┤│                 │
│  React Frontend │                             │  FastAPI        │
│                 │      HTTP REST API          │  Backend        │
│                 │────────────────────────────►│                 │
└────────┬────────┘                             └────────┬────────┘
         │                                               │
         │         LiveKit WebRTC                        │
         │         Audio/Video                           │
         └────────────────────┬──────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │                   │
                    │  LiveKit Server   │
                    │                   │
                    └───────────────────┘
```

## Key Technologies

1. **Server-Sent Events (SSE)** - Modern unidirectional push from server to client
   - More efficient than WebSockets for one-way streaming
   - Native browser support with `EventSource` API
   - Automatic reconnection

2. **LiveKit** - Real-time audio/video streaming
   - WebRTC-based for low latency
   - Handles audio I/O for conversations
   - Room-based architecture

3. **MCP (Model Context Protocol)** - AI integration
   - Server-side: Exposes backend tools to AI agents
   - Client-side: Calls AI tools from frontend

## Setup

### 1. Install Frontend Dependencies

```bash
npm install livekit-client
```

### 2. Start the Backend

```bash
cd ../py-latticework
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload
```

Backend will run on `http://localhost:8000`

### 3. Configure Frontend

Create a `.env.local` file in the frontend root:

```bash
VITE_BACKEND_URL=http://localhost:8000
```

## Usage

### Basic Conversation Flow

```typescript
import { createIntegratedConversationService } from './services/integratedConversationService';

// Create service
const conversation = createIntegratedConversationService(
  {
    backendUrl: 'http://localhost:8000',
    userId: 'user-123',
  },
  {
    onAgentSpeaking: (text) => console.log('Agent:', text),
    onTranscription: (text, isFinal) => console.log('User:', text),
    onStateChange: (state) => console.log('State:', state),
    onError: (error) => console.error('Error:', error),
  }
);

// Start conversation
await conversation.start('You are a helpful assistant');

// Send message
await conversation.sendMessage('Hello!');

// Stop conversation
await conversation.stop();
```

### SSE Event Handling

Events are automatically handled by the integrated service, but you can also subscribe directly:

```typescript
import { createBackendService } from './services/backendService';

const backend = createBackendService('http://localhost:8000');

// Subscribe to events
backend.subscribeToEvents(
  sessionId,
  (event) => {
    switch (event.event_type) {
      case 'agent_speaking':
        console.log('Agent speaking:', event.text);
        break;
      case 'transcription':
        console.log('Transcription:', event.text);
        break;
      case 'state_change':
        console.log('State changed to:', event.new_state);
        break;
    }
  },
  (error) => console.error('SSE error:', error)
);

// Unsubscribe when done
backend.unsubscribeFromEvents();
```

### LiveKit Integration

LiveKit is automatically connected by the integrated service, but you can access it:

```typescript
const livekit = conversation.getLiveKitService();

// Enable/disable microphone
await livekit.setMicrophoneEnabled(true);

// Enable/disable camera
await livekit.setCameraEnabled(false);

// Get room
const room = livekit.getRoom();
```

### MCP Tool Calls

Call backend MCP tools from the frontend:

```typescript
const mcp = conversation.getMCPService();

// List available tools
const tools = await mcp.listTools();

// Call a tool
const result = await mcp.callTool('start_conversation', {
  user_id: 'user-123',
  initial_context: 'You are helpful',
});
```

## Event Types

### SSE Events from Backend

All events have this base structure:
```typescript
{
  event_type: string;
  session_id: string;
  timestamp: string;
}
```

Event types:

1. **agent_speaking**
   ```typescript
   {
     event_type: 'agent_speaking',
     session_id: string,
     text: string,
     timestamp: string,
   }
   ```

2. **agent_finished**
   ```typescript
   {
     event_type: 'agent_finished',
     session_id: string,
     timestamp: string,
   }
   ```

3. **user_speaking**
   ```typescript
   {
     event_type: 'user_speaking',
     session_id: string,
     timestamp: string,
   }
   ```

4. **transcription**
   ```typescript
   {
     event_type: 'transcription',
     session_id: string,
     text: string,
     is_final: boolean,
     is_interruption: boolean,
     timestamp: string,
   }
   ```

5. **state_change**
   ```typescript
   {
     event_type: 'state_change',
     session_id: string,
     new_state: 'idle' | 'agentSpeaking' | 'userSpeaking' | 'processing',
     previous_state: string | null,
     timestamp: string,
   }
   ```

6. **error**
   ```typescript
   {
     event_type: 'error',
     session_id: string,
     error_message: string,
     error_code: string | null,
     timestamp: string,
   }
   ```

## Migration from Local Services

### Before (Local Only)
```typescript
import { createConversationService } from './latticework/conversation';

const conversation = createConversationService(tts, transcription, config, callbacks);
conversation.start(flowGenerator);
```

### After (Backend-Integrated)
```typescript
import { createIntegratedConversationService } from './services/integratedConversationService';

const conversation = createIntegratedConversationService(
  { backendUrl: 'http://localhost:8000' },
  callbacks
);
await conversation.start(initialContext);
```

## Best Practices

1. **Error Handling**: Always provide error callbacks
   ```typescript
   {
     onError: (error) => {
       console.error('Conversation error:', error);
       // Show user notification
     }
   }
   ```

2. **Cleanup**: Stop conversations when component unmounts
   ```typescript
   useEffect(() => {
     return () => {
       conversation.stop();
     };
   }, []);
   ```

3. **SSE Reconnection**: EventSource auto-reconnects, but handle errors gracefully

4. **LiveKit Audio**: Audio elements are auto-created, no manual DOM manipulation needed

5. **State Management**: Use callbacks to update React state
   ```typescript
   const [state, setState] = useState('idle');

   const conversation = createIntegratedConversationService(
     config,
     { onStateChange: setState }
   );
   ```

## Troubleshooting

### SSE Connection Issues
- Check CORS settings in backend
- Verify session_id is valid
- Check browser console for EventSource errors

### LiveKit Connection Issues
- Verify LiveKit credentials in backend `.env`
- Check LiveKit server is accessible
- Ensure token hasn't expired (1 hour default)

### Audio Not Working
- Check browser microphone permissions
- Verify LiveKit room is created
- Check audio elements are being created

## API Reference

See individual service files for detailed API:
- [backendService.ts](../src/services/backendService.ts)
- [livekitService.ts](../src/services/livekitService.ts)
- [mcpService.ts](../src/services/mcpService.ts)
- [integratedConversationService.ts](../src/services/integratedConversationService.ts)
