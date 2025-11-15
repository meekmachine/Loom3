# Quick Start Guide

Get up and running with the LoomLarge backend integration in 5 minutes.

## Prerequisites

- Node.js 18+ (for frontend)
- Python 3.11+ (for backend)
- LiveKit account (free tier available)
- Anthropic API key

## Step 1: Backend Setup (2 minutes)

```bash
# Navigate to backend (separate project)
cd ../py-latticework

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
ANTHROPIC_API_KEY=your-anthropic-key
CORS_ORIGINS=http://localhost:5173
```

```bash
# Start backend
uvicorn app.main:app --reload
```

Backend running at: `http://localhost:8000`

## Step 2: Frontend Setup (1 minute)

```bash
# Navigate to frontend (LoomLarge project)
cd ../LoomLarge

# Install dependencies (includes livekit-client)
npm install

# Create environment file
echo "VITE_BACKEND_URL=http://localhost:8000" > .env.local

# Start frontend
npm run dev
```

Frontend running at: `http://localhost:5173`

## Step 3: Test the Integration (2 minutes)

### Test Backend Health

Open browser: `http://localhost:8000/health`

Should see:
```json
{
  "status": "healthy",
  "livekit_configured": true,
  "mcp_enabled": true
}
```

### Test API Docs

Open: `http://localhost:8000/docs`

Interactive API documentation (Swagger UI)

### Test Frontend Integration

Create `src/examples/TestConversation.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { createIntegratedConversationService } from '../services/integratedConversationService';

export function TestConversation() {
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState<string[]>([]);
  const [conversation, setConversation] = useState<any>(null);

  useEffect(() => {
    // Create conversation service
    const conv = createIntegratedConversationService(
      {
        backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',
        userId: 'test-user',
      },
      {
        onAgentSpeaking: (text) => {
          setMessages((prev) => [...prev, `Agent: ${text}`]);
        },
        onTranscription: (text, isFinal) => {
          if (isFinal) {
            setMessages((prev) => [...prev, `User: ${text}`]);
          }
        },
        onStateChange: (state) => {
          setStatus(state);
        },
        onError: (error) => {
          console.error('Conversation error:', error);
          setMessages((prev) => [...prev, `Error: ${error.message}`]);
        },
      }
    );

    setConversation(conv);

    return () => {
      conv.stop();
    };
  }, []);

  const handleStart = async () => {
    if (!conversation) return;
    try {
      await conversation.start('You are a helpful assistant.');
      setMessages(['Conversation started']);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!conversation) return;
    try {
      await conversation.sendMessage('Hello, how are you?');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleStop = async () => {
    if (!conversation) return;
    try {
      await conversation.stop();
      setMessages((prev) => [...prev, 'Conversation stopped']);
    } catch (error) {
      console.error('Error stopping conversation:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>LoomLarge Backend Test</h1>

      <div style={{ marginBottom: '20px' }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={handleStart} style={{ marginRight: '10px' }}>
          Start Conversation
        </button>
        <button onClick={handleSend} style={{ marginRight: '10px' }}>
          Send Test Message
        </button>
        <button onClick={handleStop}>Stop Conversation</button>
      </div>

      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          height: '400px',
          overflowY: 'auto',
        }}
      >
        <h3>Messages:</h3>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '5px' }}>
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Add to your `App.tsx`:
```tsx
import { TestConversation } from './examples/TestConversation';

function App() {
  return <TestConversation />;
}
```

## Verification Checklist

- [ ] Backend health endpoint returns 200
- [ ] Frontend loads without errors
- [ ] Can start conversation
- [ ] Can send message
- [ ] Receives SSE events in browser console
- [ ] Can stop conversation
- [ ] LiveKit connection works (check browser console)

## Common Issues

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.11+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Frontend can't connect
```bash
# Verify backend URL
echo $VITE_BACKEND_URL

# Check CORS settings in backend .env
CORS_ORIGINS=http://localhost:5173
```

### LiveKit connection fails
- Verify credentials in backend `.env`
- Check LiveKit server is accessible
- Test token generation: `http://localhost:8000/api/livekit/token`

## Next Steps

1. **Read the Integration Guide**: [docs/BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md)
2. **Explore API Docs**: `http://localhost:8000/docs`
3. **Check Examples**: `src/examples/`
4. **Deploy**: [docs/DEPLOYMENT.md](./DEPLOYMENT.md)

## Development Workflow

```bash
# Terminal 1: Backend with auto-reload
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend with HMR
npm run dev

# Terminal 3: Watch logs
# Backend logs in Terminal 1
# Frontend console in browser DevTools
```

## Testing SSE Manually

```javascript
// Open browser console on http://localhost:5173
const eventSource = new EventSource('http://localhost:8000/api/events/test-session');

eventSource.addEventListener('message', (event) => {
  console.log('SSE Event:', JSON.parse(event.data));
});

eventSource.addEventListener('error', (error) => {
  console.error('SSE Error:', error);
});
```

## Testing LiveKit Manually

```javascript
// In browser console
import { createLiveKitService } from './services/livekitService';

const livekit = createLiveKitService({
  onTrackSubscribed: (track) => console.log('Track:', track),
  onError: (error) => console.error('Error:', error),
});

// Get token from backend first
const response = await fetch('http://localhost:8000/api/livekit/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identity: 'test-user',
    room_name: 'test-room',
  }),
});

const { token, url } = await response.json();

await livekit.connect({ url, token, roomName: 'test-room' });
await livekit.setMicrophoneEnabled(true);
```

## Getting Help

- **Backend Issues**: Check `backend/app/main.py` logs
- **Frontend Issues**: Check browser console
- **LiveKit Issues**: Check LiveKit dashboard
- **MCP Issues**: Check backend MCP server logs

For more detailed information, see:
- [Backend Integration Guide](./BACKEND_INTEGRATION.md)
- [Backend README](../backend/README.md)
- [Deployment Guide](./DEPLOYMENT.md)
